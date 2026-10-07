import { calendarDay } from './daily-streaks.ts'

function monday(day: number): number {
  const weekday = new Date(day * 86_400_000).getUTCDay()
  return day - (weekday + 6) % 7
}

export function computeWeeklyStreaks(dates: readonly string[], today: string, target: number) {
  if (!Number.isInteger(target) || target < 1 || target > 7) {
    throw new RangeError('Weekly target must be an integer from one to seven')
  }
  const todayDay = calendarDay(today)
  const thisWeek = monday(todayDay)
  const counts = new Map<number, number>()
  for (const day of new Set(dates.map(calendarDay))) {
    if (day > todayDay) continue
    const week = monday(day)
    counts.set(week, (counts.get(week) ?? 0) + 1)
  }
  const successfulWeeks = [...counts.keys()]
    .filter(week => counts.get(week)! >= target)
    .sort((left, right) => left - right)
  let current = 0
  let longest = 0
  let run = 0
  let previous: number | undefined
  for (const week of successfulWeeks) {
    run = previous !== undefined && week === previous + 7 ? run + 1 : 1
    longest = Math.max(longest, run)
    current = week >= thisWeek - 7 ? run : 0
    previous = week
  }
  return { current, longest, completedThisWeek: counts.get(thisWeek) ?? 0 }
}
