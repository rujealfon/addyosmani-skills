import { calendarDay } from './daily-streaks.ts'

export const TRACKER_LIMITS = Object.freeze({
  maxJsonLength: 1_048_576,
  maxHabits: 64,
  maxCompletionsPerHabit: 20_000,
  maxTotalCompletions: 60_000,
})

export type Schedule = { kind: 'daily' } | { kind: 'weekly'; targetDays: number }
export interface Habit {
  id: string
  name: string
  thresholdDescription: string
  startedOn: string
  schedule: Schedule
}
export interface TrackerDocument {
  schemaVersion: 2
  trackingStartedOn: string
  habits: Habit[]
  completions: Record<string, string[]>
}

function requireValid(condition: unknown): asserts condition {
  if (!condition) throw new RangeError('Invalid tracker document')
}
function record(value: unknown): Record<string, unknown> {
  requireValid(value !== null && typeof value === 'object' && !Array.isArray(value))
  return value as Record<string, unknown>
}
function exactKeys(value: Record<string, unknown>, keys: string[]) {
  requireValid(Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key)))
}
function date(value: unknown): string {
  requireValid(typeof value === 'string')
  calendarDay(value)
  return value
}
function text(value: unknown, maxLength: number): string {
  requireValid(typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength)
  return value.trim()
}

export function starterDocument(today: string): TrackerDocument {
  date(today)
  return {
    schemaVersion: 2, trackingStartedOn: today,
    habits: [
      { id: 'reading', name: 'Reading', thresholdDescription: 'At least 20 minutes', startedOn: today, schedule: { kind: 'daily' } },
      { id: 'sleep', name: 'Sleep', thresholdDescription: 'At least 7 hours. Log on the day you wake up.', startedOn: today, schedule: { kind: 'daily' } },
      { id: 'exercise', name: 'Exercise', thresholdDescription: 'At least 30 minutes', startedOn: today, schedule: { kind: 'weekly', targetDays: 3 } },
    ],
    completions: { reading: [], sleep: [], exercise: [] },
  }
}

export function validateDocument(input: unknown): TrackerDocument {
  const value = record(input)
  exactKeys(value, ['schemaVersion', 'trackingStartedOn', 'habits', 'completions'])
  requireValid(value.schemaVersion === 2 && Array.isArray(value.habits))
  requireValid(value.habits.length <= TRACKER_LIMITS.maxHabits)
  const trackingStartedOn = date(value.trackingStartedOn)
  const habits: Habit[] = value.habits.map((inputHabit: unknown) => {
    const habit = record(inputHabit)
    exactKeys(habit, ['id', 'name', 'thresholdDescription', 'startedOn', 'schedule'])
    requireValid(typeof habit.id === 'string' && /^[a-z][a-z0-9-]{0,79}$/.test(habit.id))
    const startedOn = date(habit.startedOn)
    requireValid(startedOn >= trackingStartedOn)
    const schedule = record(habit.schedule)
    let parsedSchedule: Schedule
    if (schedule.kind === 'daily') {
      exactKeys(schedule, ['kind'])
      parsedSchedule = { kind: 'daily' }
    } else {
      exactKeys(schedule, ['kind', 'targetDays'])
      requireValid(schedule.kind === 'weekly' && typeof schedule.targetDays === 'number'
        && Number.isInteger(schedule.targetDays) && schedule.targetDays >= 1 && schedule.targetDays <= 7)
      parsedSchedule = { kind: 'weekly', targetDays: schedule.targetDays }
    }
    return { id: habit.id, name: text(habit.name, 120), thresholdDescription: text(habit.thresholdDescription, 240), startedOn, schedule: parsedSchedule }
  })
  requireValid(new Set(habits.map(habit => habit.id)).size === habits.length)
  const entries = record(value.completions)
  exactKeys(entries, habits.map(habit => habit.id))
  // Bound the entire workload before validating or deduplicating any date list.
  let totalCompletions = 0
  for (const habit of habits) {
    const list = entries[habit.id]
    requireValid(Array.isArray(list) && list.length <= TRACKER_LIMITS.maxCompletionsPerHabit)
    totalCompletions += list.length
    requireValid(totalCompletions <= TRACKER_LIMITS.maxTotalCompletions)
  }
  const completions = Object.fromEntries(habits.map(habit => {
    const list = entries[habit.id]
    requireValid(Array.isArray(list))
    const dates = list.map((entry: unknown) => {
      const completedOn = date(entry)
      requireValid(completedOn >= habit.startedOn)
      return completedOn
    })
    return [habit.id, [...new Set(dates)].sort()]
  }))
  return { schemaVersion: 2, trackingStartedOn, habits, completions }
}

export function migrateVersionOne(input: unknown): TrackerDocument {
  const value = record(input)
  exactKeys(value, ['schemaVersion', 'trackingStartedOn', 'completions'])
  requireValid(value.schemaVersion === 1)
  const document = starterDocument(date(value.trackingStartedOn))
  return validateDocument({ ...document, completions: value.completions })
}
