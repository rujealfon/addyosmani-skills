import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createTrackerState } from '../../app/utils/tracker-state.ts'

function setup(flag: unknown = false) {
  let value: string | null = null
  let blocked = false
  const storage = { getItem: () => value, setItem: (_key: string, next: string) => {
    if (blocked) throw new Error('full')
    value = next
  } }
  const state = createTrackerState(() => storage, () => new Date(2026, 9, 7, 12), flag)
  return { state, storage, block: (next: boolean) => { blocked = next } }
}

test('hydration defaults off and malformed flag values cannot enable it', () => {
  for (const flag of [undefined, false, 'false', 'TRUE', '1', {}]) {
    const { state } = setup(flag)
    state.refresh()
    state.addHydration()
    assert.equal(state.canAddHydration.value, false)
    assert.equal(state.document.value?.habits.length, 3)
  }
})

test('enabled hydration is opt-in, added once, and uses existing daily streak rules', () => {
  for (const flag of [true, 'true']) {
    const { state } = setup(flag)
    state.refresh()
    assert.equal(state.document.value?.habits.length, 3)
    assert.equal(state.canAddHydration.value, true)
    state.addHydration()
    state.addHydration()
    assert.equal(state.document.value?.habits.length, 4)
    assert.equal(state.canAddHydration.value, false)
    state.toggle('hydration', true)
    const row = state.rows.value.find(row => row.habit.id === 'hydration')!
    assert.equal(row.stats.current, 1)
    assert.equal(row.habit.startedOn, '2026-10-07')
    assert.deepEqual(row.habit.schedule, { kind: 'daily' })
  }
})

test('turning the flag off preserves hydration history and permits checkoffs', () => {
  const { state, storage } = setup(true)
  state.refresh()
  state.addHydration()
  state.toggle('hydration', true)
  const rollback = createTrackerState(() => storage, () => new Date(2026, 9, 7, 12))
  rollback.refresh()
  assert.equal(rollback.canAddHydration.value, false)
  assert.equal(rollback.rows.value.find(row => row.habit.id === 'hydration')?.stats.current, 1)
  rollback.toggle('hydration', false)
  assert.deepEqual(rollback.document.value?.completions.hydration, [])
})

test('a failed hydration addition remains retryable through automatic refresh', () => {
  const { state, block } = setup(true)
  state.refresh()
  block(true)
  state.addHydration()
  assert.equal(state.document.value?.habits.length, 3)
  assert.equal(state.error.value?.code, 'write-failed')
  block(false)
  state.refresh()
  state.retry()
  assert.equal(state.document.value?.habits.length, 4)
  assert.equal(state.error.value, null)
})
