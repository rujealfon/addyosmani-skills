import { calendarDay } from './daily-streaks.ts'
import { migrateVersionOne, starterDocument, TRACKER_LIMITS, validateDocument } from './tracker-model.ts'
import type { TrackerDocument } from './tracker-model.ts'

export const STORAGE_KEY = 'habit-tracker:v1'
export interface StoragePort {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}
export type StorageErrorCode = 'unavailable' | 'invalid-data' | 'unsupported-version' | 'write-failed'
export type Failure = { ok: false; error: { code: StorageErrorCode; message: string } }
export type SaveResult = { ok: true; data: TrackerDocument } | Failure
export type LoadResult = { ok: true; data: TrackerDocument; source: 'loaded' | 'initialized' | 'migrated' } | Failure

const messages: Record<StorageErrorCode, string> = {
  unavailable: 'Your browser could not open saved habits. Allow site storage, then try again.',
  'invalid-data': 'Saved habits could not be read safely. Keep your site data intact; retry after restoring a valid copy.',
  'unsupported-version': 'These habits use an unsupported format. Keep your site data intact and use a compatible app version.',
  'write-failed': 'Your change could not be saved. Check available browser storage, then try again.',
}
export function storageFailure(code: StorageErrorCode): Failure {
  return { ok: false, error: { code, message: messages[code] } }
}

function decode(raw: string): LoadResult {
  if (raw.length > TRACKER_LIMITS.maxJsonLength) return storageFailure('invalid-data')
  try {
    const input: unknown = JSON.parse(raw)
    if (!input || typeof input !== 'object' || !('schemaVersion' in input)) {
      return storageFailure('invalid-data')
    }
    if (input.schemaVersion === 2) {
      return { ok: true, data: validateDocument(input), source: 'loaded' }
    }
    if (input.schemaVersion === 1) {
      return { ok: true, data: migrateVersionOne(input), source: 'migrated' }
    }
    return storageFailure(typeof input.schemaVersion === 'number' ? 'unsupported-version' : 'invalid-data')
  } catch {
    return storageFailure('invalid-data')
  }
}

export function save(storage: StoragePort, document: unknown): SaveResult {
  let data: TrackerDocument
  let serialized: string
  try {
    data = validateDocument(document)
    serialized = JSON.stringify(data)
    if (serialized.length > TRACKER_LIMITS.maxJsonLength) return storageFailure('invalid-data')
  } catch {
    return storageFailure('invalid-data')
  }
  let existing: string | null
  try {
    existing = storage.getItem(STORAGE_KEY)
  } catch {
    return storageFailure('unavailable')
  }
  if (existing !== null) {
    const prior = decode(existing)
    if (!prior.ok) return prior
  }
  try {
    storage.setItem(STORAGE_KEY, serialized)
    return { ok: true, data }
  } catch {
    return storageFailure('write-failed')
  }
}

export function load(storage: StoragePort, today: string): LoadResult {
  try {
    calendarDay(today)
  } catch {
    return storageFailure('invalid-data')
  }
  let raw: string | null
  try {
    raw = storage.getItem(STORAGE_KEY)
  } catch {
    return storageFailure('unavailable')
  }
  if (raw === null) {
    const saved = save(storage, starterDocument(today))
    return saved.ok ? { ...saved, source: 'initialized' } : saved
  }
  const result = decode(raw)
  if (!result.ok || result.source === 'loaded') return result
  const saved = save(storage, result.data)
  return saved.ok ? { ...saved, source: 'migrated' } : saved
}
