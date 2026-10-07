# Habit tracker specification

Status: Product specification with an implemented minimal Today slice. The storage contract was revised by the later request to handle schema upgrades. This document specifies one personal habit-tracking feature, including its persistence and history.

## Objectives

Build a phone-friendly habit tracker for one person who wants to stay consistent. Opening the tracker, checking off a habit, and seeing progress should take only a few seconds.

The confirmed habits are:

| Habit | Completion threshold | Schedule | Streak unit |
| --- | --- | --- | --- |
| Reading | At least 20 minutes | Every day | Days |
| Sleep | At least seven hours | Every day | Days |
| Exercise | At least 30 minutes | Three times per Monday–Sunday week | Weeks |

Sleep belongs to the date the user wakes up. Seven hours from Monday night to Tuesday morning completes Tuesday's sleep goal. Completions are self-reported with checkboxes; duration measurement is unnecessary.

All habit data stays in localStorage in this device's browser. There are no accounts, cloud sync, or reminders. The tracker retains completion history and each habit's longest streak after the current streak breaks.

## Assumptions and proposed defaults

- Use the existing Nuxt/Vue application as a mobile-first web app. Browser storage belongs to this browser and origin, so another browser on the same phone has separate data.
- Initialize three starter habits. Store their definitions in the versioned document. Habit creation is planned separately; creation, removal, renaming, and target-editing controls are outside the current minimal Today slice.
- Allow at most one qualifying exercise completion per calendar date. Three qualifying dates meet the weekly target; additional dates remain in history but do not add extra streak weeks.
- A day ends at local midnight. A week ends when the following Monday begins. Use the device's local calendar, including daylight-saving changes.
- Tracking starts on first successful initialization. Earlier dates cannot be edited. The first partial exercise week still requires three qualifying days and counts toward streaks if achieved.
- Offer Today and History as the only core screens. Historical edits use the same checkboxes as today's edits.
- Store calendar dates as entered. If the device time zone changes, existing completion dates retain their labels; current date and cutoff calculations use the new local zone.

## Technology and commands

The repository currently declares Nuxt `^4.6.0`, Vue `^3.5.43`, and Vue Router `^5.3.1`, with a pnpm lockfile. Use TypeScript and the existing framework. No backend or database is required.

Existing commands, run from the repository root:

```sh
pnpm dev --host 0.0.0.0
pnpm build
pnpm generate
pnpm preview --host 0.0.0.0
```

Proposed verification commands after Vitest and Playwright are configured during implementation:

```sh
pnpm exec vitest run --coverage
pnpm exec playwright test --project=chromium
pnpm exec playwright test --project=webkit
```

The repository currently has no test or lint scripts. These proposed test commands are not runnable acceptance evidence yet. Do not claim tests passed before the tools and configurations exist.

## Project structure and code style

Suggested locations within the existing Nuxt structure:

```text
app/pages/                 Today and History routes
app/components/            Habit checkboxes and progress displays
app/composables/           Reactive tracker state and browser persistence
app/utils/                Date, validation, and streak calculations
tests/unit/               Calendar and streak cases
tests/integration/        Storage and component behavior
e2e/                      Browser workflows
SPEC.md                   Product and behavioral contract
```

Keep calendar and streak calculations pure and independent of Vue and storage. Pass the current local date into calculations rather than reading the clock inside them. Use camelCase for functions and variables, PascalCase for types and Vue components, and descriptive habit identifiers. Follow the repository's existing formatting when implementing.

Example of the intended TypeScript style, not application code:

```ts
type HabitId = string

function isWeekComplete(completedDates: readonly string[]): boolean {
  return new Set(completedDates).size >= 3
}
```

The example assumes validated dates already filtered to one week. The implementation must also validate calendar dates and exclude future entries.

## localStorage module contract

The authoritative interface and schema are in [docs/storage-contract.md](docs/storage-contract.md), written before this slice's implementation. `load(storage, today)` and `save(storage, document)` return typed success or failure results through an injected storage port. They never publish an unsaved document to the UI.

The stable key remains `habit-tracker:v1`; the current document has `schemaVersion: 2`, document-level `trackingStartedOn`, a `habits` array with identifiers, labels, thresholds, start dates and daily/weekly schedules, and a completion map keyed by those identifiers. Current and longest streaks are derived, never persisted.

Missing data creates and saves the three starter habits. Valid original version-1 data is validated and migrated to version 2 while retaining its original start date and completion history. Unknown versions and invalid stored data produce an explicit error without overwriting the original. Failed initialization, migration, or saves retain the last saved value; retry is available. There is no reset control in the minimal UI.

Browser access is client-only. Validate all data at the storage boundary, use sorted unique calendar labels, preserve future records following clock changes, and reject completions before a habit's start date. Read valid changes from other tabs; concurrent valid writers use latest-whole-document-write wins. Tell users that clearing site data loses their history. Do not transmit habit data or call `localStorage.clear()`.

## Core screens and states

### Today

- Show the current local date and the three habit thresholds beside labeled checkboxes.
- Show reading and sleep completion for today, current daily streak, and longest daily streak.
- Show exercise completion for today, this week's progress toward three qualifying days, current weekly streak, and longest weekly streak. Display units explicitly.
- A check marks the threshold met; an uncheck reverses it. Recompute all affected progress immediately after a successful save.
- Provide a clear link to History and a short statement that data is saved in this browser on this device.

### History

- Provide a simple local-date picker from the tracking start through today. Future dates and dates before tracking began cannot receive new entries.
- Show the selected date's three checkboxes, with sleep attributed to the wake-up date.
- Show the selected week's Monday–Sunday range, exercise completion dates, and target progress.
- Historical edits change the saved record and recalculate current and longest streaks. Removing a past completion can reduce a previously displayed longest streak.
- Provide a direct return to Today. The user must not need to navigate through statistics screens to log a habit.

### Shared states

| State | Required behavior |
| --- | --- |
| Loading | Show a neutral loading state; disable edits until storage is read. |
| First use | Show empty checkboxes, zero streaks, and a brief explanation of the thresholds. |
| Ready | Render saved completions and derived progress. |
| Save failure | Preserve saved state, explain that the edit was not saved, and allow retry. |
| Invalid or unsupported storage | Preserve stored data and show recovery guidance; reset requires confirmation. |
| Storage unavailable | Explain that persistent tracking is unavailable; do not offer an unannounced temporary history. |

Use touch-friendly controls, visible focus, keyboard-accessible checkboxes, and accessible labels. Do not rely only on color to indicate success or a missed target. Re-evaluate the local date on app focus and at midnight while open so stale screens do not attribute new checks to yesterday.

## Streak rules

### Daily reading and sleep

1. Each completed local date contributes one day. Duplicate checks cannot increase the streak.
2. If today is complete, the current streak is the consecutive completed run ending today.
3. If today is incomplete, it is still open. The current streak is the run ending yesterday, or zero if yesterday was incomplete. An uncompleted first day displays zero.
4. Once a day ends incomplete, the current streak resets to zero. A later completion begins a new run at one.
5. The longest streak is the longest consecutive completed run from the tracking start through today.

### Weekly exercise

1. Group qualifying dates into local Monday–Sunday weeks. A week is successful when at least three distinct dates are complete.
2. A successful current week contributes one week immediately and extends the consecutive successful run ending with it.
3. An unfinished current week does not break the streak while it is open. Display the run ending with the previous week, or zero if that week was unsuccessful.
4. At the start of Monday, a closed week with fewer than three qualifying dates breaks the streak. Three or more dates preserve it.
5. The longest streak is the longest consecutive run of successful weeks. A fourth workout does not add another week.

Backdating or unchecking recomputes both current and longest streaks from history. There are no grace days, freezes, or permanent records of obsolete longest streaks. Calendar adjacency must use calendar arithmetic, not an assumption that every local day is exactly 24 hours.

Examples for acceptance:

- Reading completed Monday–Wednesday displays three on Wednesday and still three on an incomplete Thursday. If Thursday ends incomplete, Friday displays zero until Friday is completed, then one.
- If Thursday was actually completed and is logged later, the Monday–Friday run becomes five when Friday is also complete.
- Exercise on Monday, Wednesday, and Saturday makes one successful week. A following week with only two qualifying dates retains the previous streak during Sunday, then resets on Monday.
- Correcting that closed week to three qualifying dates restores the weekly run. Unchecking one of those dates breaks it again.

## Testing strategy

The current slice uses Node 22.23.3's built-in TypeScript-compatible test runner through `npm test`, without added dependencies. Tests live in `tests/unit/`, including storage and reactive-state integration checks. Vitest and Playwright remain optional proposed tooling for later slices; browser checks for this slice use the connected Chrome browser. Test with an injected evaluation date rather than waiting for actual midnight.

Unit tests must cover:

- Daily runs with today complete, today pending, a closed missed day, isolated completions, and a longer run elsewhere in history.
- Weekly runs at zero, two, three, and four qualifying dates; duplicate dates; a pending week; a closed failed week; and a partial first week.
- Backdated checks and historical unchecks changing both current and longest streaks.
- Monday boundaries, month and year transitions, leap days, daylight-saving changes, and device time zone changes.
- Wake-up-date attribution, rejection of invalid dates, disabled edits outside the tracking range, and retained future records after a clock change.

Integration tests must cover initialization, validated JSON round trips, reload persistence, derived-state recalculation, cross-tab storage events, malformed and unsupported documents, storage access failures, and quota/write failures. Verify failed writes do not appear saved and unrelated localStorage keys survive a confirmed reset.

Browser tests must cover the complete mobile flow: first use, checking all habits, reload, History edits, streak restoration, unchecking, and returning to Today. Verify midnight/focus refresh, keyboard use, visible status text, and usable layout at a 320 CSS-pixel viewport. Test Chromium and WebKit; manually check the intended phone browser before release.

Coverage expectations are behavioral: every streak rule and storage error path above must have an assertion. A percentage alone is not acceptance. Inspect requests during use and confirm that no habit history is transmitted. Run the production build and review the browser console for hydration or runtime errors.

## Boundaries

- Always: validate stored data and date edits; preserve history on errors; derive streaks from completions; use local calendar rules; keep controls accessible; run the relevant tests and production build before shipping.
- Ask first: change confirmed goals or streak semantics; expand the habit list or screen scope; change the schema after implementation; add dependencies beyond the proposed test tooling; introduce an external service or deployment.
- Never: transmit habit data; silently erase invalid history; introduce accounts, analytics, or reminders; modify unrelated storage; remove failing tests to obtain a passing result; implement beyond this approved scope.

## Explicit non-goals

- Accounts, authentication, cloud storage, sync across devices or browsers, and sharing.
- Reminders, push notifications, email, social features, rewards, and streak freezes.
- Habit creation, configurable thresholds or schedules, and multiple exercise sessions per date.
- Timers, duration logs, wearable integrations, and automatic sleep or workout detection.
- Export/import, backups, advanced statistics, and a dedicated settings screen.
- Native mobile packaging, guaranteed offline app loading, and service-worker installation.
- Concurrent-edit merging, timezone-history tracking, and protection against manual device clock changes.

## Success criteria

The feature is complete when all three habits can be checked from Today with one action each, records survive reload in the same browser, historical edits recalculate streaks correctly, and all listed streak and persistence tests pass. A closed miss resets only the affected habit's current streak while its completion history remains available. Daily and weekly units are clear, the phone layout is usable, failed saves cannot masquerade as success, and no habit data leaves the device through the application.

## Open questions for spec review

The interview settled the habit goals, schedules, streak reset behavior, backdating, local-only storage, and absence of reminders. Review these proposed defaults before implementation:

1. Does one qualifying exercise session per date match the intended weekly target?
2. Should the first partial week require all three exercise dates, even when tracking starts late in the week?
3. Are fixed habits, midnight cutoffs, and the two-screen web app sufficient for the first version?

This document stops at Specify. Implementation planning and application code follow only after spec review.
