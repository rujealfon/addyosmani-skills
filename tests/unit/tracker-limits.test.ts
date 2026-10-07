import assert from 'node:assert/strict'
import { test } from 'node:test'
import { starterDocument } from '../../app/utils/tracker-model.ts'
import { load, save } from '../../app/utils/tracker-storage.ts'

function stored(raw: string | null) {
  let writes = 0
  let value = raw
  return { getItem: () => value, setItem: (_key: string, next: string) => { value = next; writes++ },
    value: () => value, writes: () => writes }
}

function assertAcceptedOrPreserved(document: unknown, accepted: boolean) {
  const raw = JSON.stringify(document)
  const storage = stored(raw)
  assert.equal(load(storage, '2026-10-07').ok, accepted)
  assert.equal(storage.value(), raw)
  if (!accepted) {
    assert.equal(save(storage, starterDocument('2026-10-07')).ok, false)
    assert.equal(storage.value(), raw)
    assert.equal(storage.writes(), 0)
  }
  const target = stored(JSON.stringify(starterDocument('2026-10-07')))
  const prior = target.value()
  assert.equal(save(target, document).ok, accepted)
  if (!accepted) {
    assert.equal(target.value(), prior)
    assert.equal(target.writes(), 0)
  }
}

test('raw JSON length is accepted below/at the limit and preserved above it', () => {
  const document = starterDocument('2026-10-07')
  for (const length of [1_048_575, 1_048_576, 1_048_577]) {
    const raw = JSON.stringify(document).padEnd(length, ' ')
    const storage = stored(raw)
    const result = load(storage, '2026-10-07')
    assert.equal(result.ok, length <= 1_048_576)
    assert.equal(storage.value(), raw)
    assert.equal(storage.writes(), 0)
    if (!result.ok) {
      assert.equal(result.error.code, 'invalid-data')
      assert.equal(save(storage, document).ok, false)
      assert.equal(storage.value(), raw)
    }
  }
})

test('habit counts are bounded on load and save', () => {
  for (const count of [63, 64, 65]) {
    const document = starterDocument('2026-10-07')
    document.habits = Array.from({ length: count }, (_, index) => ({ ...document.habits[0]!, id: `habit-${index}` }))
    document.completions = Object.fromEntries(document.habits.map(habit => [habit.id, []]))
    assertAcceptedOrPreserved(document, count <= 64)
  }
})

test('per-habit completion counts are bounded before deduplication', () => {
  for (const count of [19_999, 20_000, 20_001]) {
    const document = starterDocument('2026-10-07')
    document.completions.reading = Array(count).fill('2026-10-07')
    assertAcceptedOrPreserved(document, count <= 20_000)
  }
})

test('total completion counts are bounded even when individual lists fit', () => {
  for (const count of [59_999, 60_000, 60_001]) {
    const document = starterDocument('2026-10-07')
    document.habits.push({ ...document.habits[0]!, id: 'extra' })
    document.completions = Object.fromEntries(document.habits.map((habit, index) => [habit.id,
      Array(Math.floor(count / 4) + (index < count % 4 ? 1 : 0)).fill('2026-10-07'),
    ]))
    assertAcceptedOrPreserved(document, count <= 60_000)
  }
})

test('legacy migration enforces the same completion limits without losing the original', () => {
  for (const count of [19_999, 20_000, 20_001]) {
    const legacy = { schemaVersion: 1, trackingStartedOn: '2026-10-07',
      completions: { reading: Array(count).fill('2026-10-07'), sleep: [], exercise: [] } }
    const raw = JSON.stringify(legacy)
    const storage = stored(raw)
    const result = load(storage, '2026-10-07')
    assert.equal(result.ok, count <= 20_000)
    if (result.ok) {
      assert.equal(result.source, 'migrated')
      assert.deepEqual(result.data.completions.reading, ['2026-10-07'])
    } else {
      assert.equal(result.error.code, 'invalid-data')
      assert.equal(storage.value(), raw)
      assert.equal(storage.writes(), 0)
    }
  }
})

test('the reviewed oversized duplicate-date and habit payloads are rejected without writes', () => {
  const duplicateDates = starterDocument('2026-10-07')
  duplicateDates.completions.reading = Array(100_000).fill('2026-10-07')
  assertAcceptedOrPreserved(duplicateDates, false)
  const manyHabits = starterDocument('2026-10-07')
  manyHabits.habits = Array.from({ length: 5000 }, (_, index) => ({ ...manyHabits.habits[0]!, id: `h-${index}` }))
  manyHabits.completions = Object.fromEntries(manyHabits.habits.map(habit => [habit.id, []]))
  assertAcceptedOrPreserved(manyHabits, false)
})
