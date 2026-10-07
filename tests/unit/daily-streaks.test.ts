import assert from 'node:assert/strict'
import { test } from 'node:test'
import { computeDailyStreaks } from '../../app/utils/daily-streaks.ts'

test('empty history has no current or longest streak', () => {
  assert.deepEqual(computeDailyStreaks([], '2026-10-07'), { current: 0, longest: 0 })
})

test('completing today extends consecutive completed days', () => {
  assert.deepEqual(
    computeDailyStreaks(['2026-10-05', '2026-10-06', '2026-10-07'], '2026-10-07'),
    { current: 3, longest: 3 },
  )
})

test('today not done yet preserves the streak ending yesterday', () => {
  assert.deepEqual(
    computeDailyStreaks(['2026-10-05', '2026-10-06'], '2026-10-07'),
    { current: 2, longest: 2 },
  )
})

test('a missed closed day resets current streak but retains the longest', () => {
  assert.deepEqual(
    computeDailyStreaks(['2026-10-04', '2026-10-05'], '2026-10-07'),
    { current: 0, longest: 2 },
  )
})

test('completing today after a missed day starts a new streak of one', () => {
  assert.deepEqual(
    computeDailyStreaks(['2026-10-04', '2026-10-05', '2026-10-07'], '2026-10-07'),
    { current: 1, longest: 2 },
  )
})

test('backdating joins runs and unchecking breaks them again', () => {
  const corrected = ['2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07']
  assert.deepEqual(computeDailyStreaks(corrected, '2026-10-07'), { current: 4, longest: 4 })
  assert.deepEqual(
    computeDailyStreaks(corrected.filter(date => date !== '2026-10-06'), '2026-10-07'),
    { current: 1, longest: 2 },
  )
})

test('unsorted and duplicate dates count once without mutating the input', () => {
  const dates = Object.freeze(['2026-10-07', '2026-10-05', '2026-10-06', '2026-10-06'])
  assert.deepEqual(computeDailyStreaks(dates, '2026-10-07'), { current: 3, longest: 3 })
  assert.deepEqual(dates, ['2026-10-07', '2026-10-05', '2026-10-06', '2026-10-06'])
})

test('future completions do not contribute to current or longest streaks', () => {
  assert.deepEqual(
    computeDailyStreaks(['2026-10-06', '2026-10-08', '2026-10-09', '2026-10-10'], '2026-10-07'),
    { current: 1, longest: 1 },
  )
  assert.deepEqual(computeDailyStreaks(['2026-10-08'], '2026-10-07'), { current: 0, longest: 0 })
})

test('calendar adjacency crosses year and leap-day boundaries', () => {
  assert.deepEqual(
    computeDailyStreaks(['2025-12-31', '2026-01-01'], '2026-01-01'),
    { current: 2, longest: 2 },
  )
  assert.deepEqual(
    computeDailyStreaks(['2024-02-28', '2024-02-29', '2024-03-01'], '2024-03-01'),
    { current: 3, longest: 3 },
  )
})

test('calendar labels remain consecutive across daylight-saving transitions', () => {
  assert.deepEqual(
    computeDailyStreaks(['2026-03-07', '2026-03-08', '2026-03-09'], '2026-03-09'),
    { current: 3, longest: 3 },
  )
  assert.deepEqual(
    computeDailyStreaks(['2026-10-31', '2026-11-01', '2026-11-02'], '2026-11-02'),
    { current: 3, longest: 3 },
  )
})

test('invalid dates and date formats are rejected instead of normalized', () => {
  for (const date of ['2026-02-29', '2026-02-30', '2026-13-01', '2026-1-01', 'invalid']) {
    assert.throws(() => computeDailyStreaks([date], '2026-10-07'), RangeError)
    assert.throws(() => computeDailyStreaks([], date), RangeError)
  }
})
