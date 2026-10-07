export function calendarDay(date: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new RangeError(`Expected a YYYY-MM-DD calendar date: ${date}`)
  }

  const parsed = new Date(`${date}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new RangeError(`Invalid calendar date: ${date}`)
  }

  // UTC is only a coordinate for calendar labels, not the user's local timestamps.
  return parsed.getTime() / 86_400_000
}

/** Derive daily streaks using local YYYY-MM-DD labels and an explicit local today. */
export function computeDailyStreaks(completedDates: readonly string[], today: string) {
  const todayDay = calendarDay(today)
  const days = [...new Set(completedDates.map(calendarDay))]
    .filter(day => day <= todayDay)
    .sort((left, right) => left - right)

  let current = 0
  let longest = 0
  let run = 0
  let previous: number | undefined

  for (const day of days) {
    run = previous !== undefined && day === previous + 1 ? run + 1 : 1
    longest = Math.max(longest, run)
    // Today is still open, so a run ending yesterday remains current.
    current = day >= todayDay - 1 ? run : 0
    previous = day
  }

  return { current, longest }
}
