import assert from 'node:assert/strict'
import { test } from 'node:test'
import { load, save, STORAGE_KEY } from '../../app/utils/tracker-storage.ts'

function memoryStorage(initial: string | null = null) {
  const values = new Map<string, string>([['unrelated-key', 'keep me']])
  if (initial !== null) values.set(STORAGE_KEY, initial)
  let writes = 0
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, next: string) => { values.set(key, next); writes++ },
    value: () => values.get(STORAGE_KEY) ?? null,
    writes: () => writes,
  }
}

test('missing data initializes and saves all three starter habits once', () => {
  const storage = memoryStorage()
  const result = load(storage, '2026-10-07')
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.source, 'initialized')
  assert.equal(result.data.schemaVersion, 2)
  assert.deepEqual(result.data.habits.map(habit => habit.id), ['reading', 'sleep', 'exercise'])
  assert.deepEqual(load(storage, '2026-10-08'), { ok: true, data: result.data, source: 'loaded' })
  assert.equal(storage.writes(), 1)
  assert.equal(STORAGE_KEY, 'habit-tracker:v1')
  assert.equal(storage.getItem('unrelated-key'), 'keep me')
})

test('version one migrates without losing history and migration is idempotent', () => {
  const storage = memoryStorage(JSON.stringify({
    schemaVersion: 1, trackingStartedOn: '2026-10-01',
    completions: { reading: ['2026-10-02'], sleep: [], exercise: ['2026-10-03'] },
  }))
  const result = load(storage, '2026-10-07')
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.source, 'migrated')
  assert.equal(result.data.habits[0]?.startedOn, '2026-10-01')
  assert.deepEqual(result.data.completions.reading, ['2026-10-02'])
  assert.deepEqual(result.data.completions.exercise, ['2026-10-03'])
  assert.equal(load(storage, '2026-10-07').ok, true)
  assert.equal(storage.writes(), 1)
})

test('save canonicalizes dates, retains future records, and does not mutate its input', () => {
  const storage = memoryStorage()
  const result = load(storage, '2026-10-07')
  assert.ok(result.ok)
  const candidate = { ...result.data, completions: {
    ...result.data.completions, reading: ['2026-10-09', '2026-10-07', '2026-10-07'],
  } }
  const saved = save(storage, candidate)
  assert.ok(saved.ok)
  assert.deepEqual(saved.data.completions.reading, ['2026-10-07', '2026-10-09'])
  assert.equal(candidate.completions.reading.length, 3)
  assert.deepEqual(load(storage, '2026-10-07'), { ok: true, data: saved.data, source: 'loaded' })
})

test('malformed and unsupported stored data are preserved on load and save', () => {
  const valid = load(memoryStorage(), '2026-10-07')
  assert.ok(valid.ok)
  for (const raw of ['{bad', 'null', '{"schemaVersion":0}', '{"schemaVersion":99}']) {
    const storage = memoryStorage(raw)
    assert.equal(load(storage, '2026-10-07').ok, false)
    assert.equal(save(storage, valid.data).ok, false)
    assert.equal(storage.value(), raw)
    assert.equal(storage.writes(), 0)
  }
  const newer = load(memoryStorage('{"schemaVersion":99}'), '2026-10-07')
  assert.ok(!newer.ok)
  assert.equal(newer.error.code, 'unsupported-version')
})

test('invalid schemas cannot replace saved history', () => {
  const storage = memoryStorage()
  const result = load(storage, '2026-10-07')
  assert.ok(result.ok)
  const original = storage.value()
  const invalid = [
    { ...result.data, extra: true },
    { ...result.data, trackingStartedOn: '2026-02-30' },
    { ...result.data, habits: [...result.data.habits, result.data.habits[0]] },
    { ...result.data, completions: { ...result.data.completions, unknown: [] } },
    { ...result.data, completions: { ...result.data.completions, reading: ['2026-10-06'] } },
    { ...result.data, habits: result.data.habits.map(habit => ({ ...habit, name: ' ' })) },
    { ...result.data, habits: result.data.habits.map(habit => ({ ...habit, schedule: { kind: 'weekly', targetDays: 8 } })) },
  ]
  for (const candidate of invalid) {
    assert.equal(save(storage, candidate).ok, false)
    assert.equal(storage.value(), original)
  }
})

test('read failures and write failures return explicit errors', () => {
  const inaccessible = { getItem: () => { throw new Error('denied') }, setItem: () => {} }
  const read = load(inaccessible, '2026-10-07')
  assert.ok(!read.ok)
  assert.equal(read.error.code, 'unavailable')
  const full = { getItem: () => null, setItem: () => { throw new Error('quota') } }
  const initialized = load(full, '2026-10-07')
  assert.ok(!initialized.ok)
  assert.equal(initialized.error.code, 'write-failed')
  const legacy = JSON.stringify({ schemaVersion: 1, trackingStartedOn: '2026-10-01',
    completions: { reading: [], sleep: [], exercise: [] } })
  const migration = load({ ...full, getItem: () => legacy }, '2026-10-07')
  assert.ok(!migration.ok)
  assert.equal(migration.error.code, 'write-failed')
})
