import { computed, ref, shallowRef } from 'vue'
import { computeDailyStreaks } from './daily-streaks.ts'
import { computeWeeklyStreaks } from './weekly-streaks.ts'
import { load, save, storageFailure } from './tracker-storage.ts'
import type { Failure, StoragePort } from './tracker-storage.ts'
import type { TrackerDocument } from './tracker-model.ts'

export function localDate(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export function createTrackerState(getStorage: () => StoragePort, now = () => new Date(), hydrationFlag: unknown = false) {
  const document = shallowRef<TrackerDocument | null>(null)
  const today = ref('')
  const ready = ref(false)
  const error = shallowRef<Failure['error'] | null>(null)
  const announcement = ref('')
  type Intent = { kind: 'checkoff'; id: string; done: boolean } | { kind: 'hydration' }
  let pending: { intent: Intent; date: string; error: Failure['error'] } | null = null
  const canAddHydration = computed(() => (hydrationFlag === true || hydrationFlag === 'true')
    && ready.value && !!document.value && !document.value.habits.some(habit => habit.id === 'hydration'))
  const rows = computed(() => (document.value?.habits ?? []).map(habit => {
    const dates = document.value!.completions[habit.id]!
    const stats = habit.schedule.kind === 'daily'
      ? computeDailyStreaks(dates, today.value)
      : computeWeeklyStreaks(dates, today.value, habit.schedule.targetDays)
    return { habit, done: dates.includes(today.value), eligible: habit.startedOn <= today.value, stats }
  }))

  function refresh() {
    today.value = localDate(now())
    if (pending && pending.date !== today.value) {
      pending = null
      announcement.value = 'The day changed. Check today’s habits before marking them done.'
    }
    let result
    try {
      result = load(getStorage(), today.value)
    } catch {
      result = storageFailure('unavailable')
    }
    ready.value = result.ok
    error.value = result.ok ? pending?.error ?? null : result.error
    if (result.ok) document.value = result.data
  }

  function addHydration() {
    refresh()
    if (!canAddHydration.value || !document.value) return
    pending = null
    error.value = null
    const candidate: TrackerDocument = { ...document.value,
      habits: [...document.value.habits, { id: 'hydration', name: 'Hydration',
        thresholdDescription: 'Reach your personal daily hydration goal', startedOn: today.value,
        schedule: { kind: 'daily' } }],
      completions: { ...document.value.completions, hydration: [] },
    }
    persist(candidate, { kind: 'hydration' }, 'Hydration habit added. Saved on this device.')
  }

  function toggle(id: string, done: boolean) {
    refresh()
    if (!ready.value || !document.value) return
    const habit = document.value.habits.find(habit => habit.id === id)
    if (!habit || habit.startedOn > today.value) return
    // A new explicit checkbox action replaces the previous failed intent.
    pending = null
    error.value = null
    const dates = new Set(document.value.completions[id])
    if (done) dates.add(today.value)
    else dates.delete(today.value)
    const candidate = { ...document.value, completions: {
      ...document.value.completions, [id]: [...dates].sort(),
    } }
    persist(candidate, { kind: 'checkoff', id, done }, `${habit.name} ${done ? 'marked done' : 'marked not done'} for today. Saved on this device.`)
  }

  function persist(candidate: TrackerDocument, intent: Intent, message: string) {
    let result
    try {
      result = save(getStorage(), candidate)
    } catch {
      result = storageFailure('unavailable')
    }
    if (!result.ok) {
      error.value = result.error
      ready.value = result.error.code === 'write-failed'
      pending = { intent, date: today.value, error: result.error }
      return
    }
    document.value = result.data
    announcement.value = message
  }

  function retry() {
    const intent = pending
    if (intent && intent.date !== localDate(now())) {
      refresh()
    } else if (intent) {
      if (intent.intent.kind === 'hydration') addHydration()
      else toggle(intent.intent.id, intent.intent.done)
    } else {
      refresh()
    }
  }

  return { document, today, ready, error, announcement, rows, refresh, toggle, retry, canAddHydration, addHydration }
}
