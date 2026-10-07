import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createTrackerState } from '../../app/utils/tracker-state.ts'

function setup() {
  let value: string | null = null
  let blocked = false
  const storage = {
    getItem: () => value,
    setItem: (_key: string, next: string) => {
      if (blocked) throw new Error('full')
      value = next
    },
  }
  return { state: createTrackerState(() => storage, () => new Date(2026, 9, 7, 12)),
    block: (next: boolean) => { blocked = next }, set: (next: string) => { value = next } }
}

test('check and uncheck publish saved state and derived streaks', () => {
  const { state } = setup()
  assert.equal(state.document.value, null)
  state.refresh()
  state.toggle('reading', true)
  state.toggle('reading', true)
  assert.deepEqual(state.document.value?.completions.reading, ['2026-10-07'])
  assert.equal(state.rows.value[0]?.stats.current, 1)
  state.toggle('reading', false)
  assert.deepEqual(state.document.value?.completions.reading, [])
  assert.equal(state.rows.value[0]?.stats.current, 0)
})

test('failed saves leave checkboxes and stats unchanged; retry applies the intent once', () => {
  const { state, block } = setup()
  state.refresh()
  block(true)
  state.toggle('reading', true)
  assert.equal(state.rows.value[0]?.done, false)
  assert.equal(state.rows.value[0]?.stats.current, 0)
  assert.equal(state.error.value?.code, 'write-failed')
  block(false)
  state.retry()
  assert.equal(state.rows.value[0]?.done, true)
  assert.equal(state.rows.value[0]?.stats.current, 1)
  assert.equal(state.error.value, null)
})

test('another tab corrupting storage disables edits and preserves the value', () => {
  const { state, set } = setup()
  state.refresh()
  set('{bad')
  state.toggle('reading', true)
  assert.equal(state.ready.value, false)
  assert.equal(state.error.value?.code, 'invalid-data')
  assert.equal(state.rows.value[0]?.done, false)
})

test('a retry after midnight does not silently complete a different date', () => {
  let now = new Date(2026, 9, 7, 12)
  let blocked = false
  let value: string | null = null
  const state = createTrackerState(() => ({ getItem: () => value, setItem: (_key, next) => {
    if (blocked) throw new Error('full')
    value = next
  } }), () => now)
  state.refresh()
  blocked = true
  state.toggle('reading', true)
  now = new Date(2026, 9, 8, 1)
  blocked = false
  state.retry()
  assert.deepEqual(state.document.value?.completions.reading, [])
  assert.match(state.announcement.value, /day changed/i)
})
