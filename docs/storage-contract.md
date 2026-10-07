# Local habit storage contract

## Public interface

The storage module is synchronous, framework-independent, and accepts an injected `StoragePort` containing `getItem(key)` and `setItem(key, value)`. Browser access belongs to the client-side UI controller. It never reads browser globals during server rendering.

```ts
load(storage: StoragePort, today: string): LoadResult
save(storage: StoragePort, document: TrackerDocument): SaveResult
```

`today` is a real device-local `YYYY-MM-DD` date, supplied by the caller. Both functions return discriminated unions, never routine storage exceptions:

- Load success: `{ ok: true, data, source: 'loaded' | 'initialized' | 'migrated' }`.
- Save success: `{ ok: true, data }`, containing the validated canonical document that was saved.
- Failure: `{ ok: false, error: { code, message } }`. Codes are `unavailable`, `invalid-data`, `unsupported-version`, and `write-failed`. Failures carry no new saved document.

The UI may publish a mutation only after save succeeds. Checkbox actions must be idempotent, and failed writes retain the previous saved state. Retry uses the same candidate or reloads storage, depending on which action failed.

## Schema

Retain the stable key `habit-tracker:v1` so upgrades can find prior data. The JSON document's `schemaVersion`, rather than its key, identifies its format. The current version is 2:

```json
{
  "schemaVersion": 2,
  "trackingStartedOn": "2026-10-07",
  "habits": [
    {
      "id": "reading",
      "name": "Reading",
      "thresholdDescription": "At least 20 minutes",
      "startedOn": "2026-10-07",
      "schedule": { "kind": "daily" }
    }
  ],
  "completions": { "reading": ["2026-10-07"] }
}
```

Habit IDs are unique lowercase letters, digits, and hyphens, beginning with a letter, up to 80 characters. Names and threshold descriptions are nonblank strings up to 120 and 240 characters. Schedules are `{ kind: 'daily' }` or `{ kind: 'weekly', targetDays: 1..7 }` with an integer target. Habit start dates are on or after document start. Completion keys must match the habit IDs exactly, and every entry must be a valid calendar date on or after that habit's start date. Lists are canonicalized by deduplicating and sorting; caller input is never mutated. Unknown fields are rejected to avoid silently discarding data from an incompatible producer.

An empty habits array and completion map are valid. Starter initialization creates Reading, Sleep, and Exercise with the confirmed goals. Sleep is entered on the wake-up date. Exercise has a target of three distinct dates per Monday–Sunday week. Stats are derived, never persisted. Future completion labels caused by a device clock change are preserved and excluded by streak calculations until their date arrives.

## Missing data and upgrades

| Stored state | Load behavior |
| --- | --- |
| Key missing | Create all three starter habits with today's local start date; save once; return `initialized` only after a successful write. |
| Valid version 2 | Validate and return `loaded`; no read-time write. |
| Original version 1 | Validate `{ schemaVersion: 1, trackingStartedOn, completions: { reading, sleep, exercise } }`; add starter definitions using the original start date; preserve completion history; save version 2; return `migrated` only after successful save. |
| Unknown older or newer version | Return `unsupported-version`; preserve the original value. No guessing at missing fields. |
| Malformed JSON or invalid fields | Return `invalid-data`; preserve the original value. |
| Storage cannot be read | Return `unavailable`; do not initialize a temporary history. |
| Initialization, migration, or save cannot write | Return `write-failed`; the prior value remains authoritative. |

Migration is idempotent: a second load sees version 2 and does not write again. `save` validates its candidate and checks existing stored data before writing, refusing to overwrite malformed or unsupported documents. It is not a compare-and-swap transaction; concurrent valid writers use latest-whole-document-write wins. The UI reloads valid storage events and disables editing when another tab replaces data with an invalid document.

No reset is exposed in this minimal UI. Recoverable access errors offer retry; corrupt or unsupported data instructs the user to preserve their site data. Never call `localStorage.clear()`. Habit data is neither sent to a server nor recorded in logs. Clearing browser site data destroys history; localStorage is not a backup. This does not guarantee the app itself can load offline.

## UI contract

Today is a single mobile-first screen with a dated heading, progress count, and one list row per habit. Each row has a labeled native checkbox, threshold, completion state, current streak, and longest streak. Weekly rows also show the current Monday–Sunday progress. Labels provide an ample touch target. Keyboard focus is visible; success uses text as well as color; changes are announced in a polite live region and failures in an alert.

The visual system uses a pale blue-gray canvas (`#eef3f8`), white content (`#ffffff`), dark ink (`#172e46`), secondary ink (`#526579`), blue action (`#1759b8`), and red error (`#a32626`). Use locally available sans-serif text, a single left-aligned reading column, a spacing scale in quarter-rem increments, and no external fonts, imagery, animation, or ornamental dashboard cards.

Load on mount; refresh on focus and local midnight; reschedule the next midnight rather than assuming a 24-hour interval. Dispose timers and event listeners on unmount. Existing completion labels retain their meaning when time zones change. On a failed save, reset the native checkbox and retain the previous stats; keep a retry action for the failed candidate.

This contract supersedes SPEC.md's fixed-identifier version-1 storage section for this slice. The schema supports future creation, but the current requested UI exposes only the habit list, today's checkoffs, and streaks. History editing, habit creation controls, and deployment remain later slices.
