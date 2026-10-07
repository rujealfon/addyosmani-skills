import assert from 'node:assert/strict'
import { test } from 'node:test'
import { computeWeeklyStreaks } from '../../app/utils/weekly-streaks.ts'

test('weekly progress requires distinct qualifying dates and counts success once', () => {
  assert.deepEqual(computeWeeklyStreaks(['2026-10-05', '2026-10-07', '2026-10-07'], '2026-10-07', 3),
    { current: 0, longest: 0, completedThisWeek: 2 })
  assert.deepEqual(computeWeeklyStreaks(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08'], '2026-10-08', 3),
    { current: 1, longest: 1, completedThisWeek: 4 })
})

test('an open unfinished week preserves the previous streak and a closed miss resets it', () => {
  const dates = ['2026-09-28', '2026-09-30', '2026-10-02', '2026-10-05', '2026-10-07']
  assert.deepEqual(computeWeeklyStreaks(dates, '2026-10-11', 3),
    { current: 1, longest: 1, completedThisWeek: 2 })
  assert.deepEqual(computeWeeklyStreaks(dates, '2026-10-12', 3),
    { current: 0, longest: 1, completedThisWeek: 0 })
  assert.deepEqual(computeWeeklyStreaks([...dates, '2026-10-10'], '2026-10-12', 3),
    { current: 2, longest: 2, completedThisWeek: 0 })
})

test('week grouping crosses years and excludes future completions', () => {
  assert.deepEqual(computeWeeklyStreaks(['2025-12-29', '2025-12-31', '2026-01-02', '2026-01-05'], '2026-01-04', 3),
    { current: 1, longest: 1, completedThisWeek: 3 })
  assert.deepEqual(computeWeeklyStreaks([], '2026-10-07', 3),
    { current: 0, longest: 0, completedThisWeek: 0 })
})

test('weekly targets one through seven are supported and invalid targets rejected', () => {
  for (let target = 1; target <= 7; target++) {
    const dates = Array.from({ length: target }, (_, index) => `2026-10-${String(5 + index).padStart(2, '0')}`)
    assert.equal(computeWeeklyStreaks(dates, '2026-10-11', target).current, 1)
  }
  for (const target of [0, 8, 2.5]) {
    assert.throws(() => computeWeeklyStreaks([], '2026-10-07', target), RangeError)
  }
})
