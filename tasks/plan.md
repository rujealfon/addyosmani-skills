# Habit tracker implementation plan

Status: Ready for review. Planning only; no application code has been changed.

## Overview

Turn [SPEC.md](../SPEC.md) into small, verifiable slices in the existing Nuxt/Vue app: add a habit, mark a day done, compute daily and weekly streaks, show stats, and persist records to localStorage. Then complete history editing and the storage and calendar edge cases required by the spec.

This file is the task list target designated by the user's request. Track completion here rather than maintaining a duplicate `tasks/todo.md`. All tasks begin unchecked. Each task should fit one focused session and touch no more than five files; split it further if implementation exceeds that scope.

## Scope reconciliation and proposed decisions

The newest request explicitly includes adding a habit. SPEC.md currently excludes habit creation and uses fixed habit identifiers. Treat creation as a requested scope expansion, and update the spec in Task 1 before implementing it. Keep reading, sleep, and exercise as starter habits with their confirmed thresholds. Do not reinterpret “show stats” as a new analytics dashboard: it means current streak, longest streak, daily completion, and weekly progress on Today and History.

Proposed creation contract for review:

- An inline Add habit form on Today asks for a nonblank name, a short completion-threshold description, and a schedule: daily or a target of one to seven qualifying days per Monday–Sunday week.
- Each new habit gets an immutable generated ID and a local `startedOn` date. The label and threshold are descriptive; completion remains a checkbox. Allow one completion per habit per date.
- New habits follow the existing daily or weekly streak rules from their own start dates. Earlier history is unavailable for that habit. No rename, delete, or schedule editing in this version.
- Revise the draft version-1 document to include a `habits` array of `{ id, name, thresholdDescription, schedule, startedOn }`, where schedule is `{ kind: "daily" }` or `{ kind: "weekly", targetDays: 3 }`. Retain document-level `trackingStartedOn` and the completion map keyed by habit ID. No deployed version or saved application data exists yet, so this is a draft schema revision, not a runtime migration.
- Keep midnight cutoffs and the full target for a partial first week as proposed in SPEC.md. Ask for changes during plan review if these defaults are unsuitable.

## Architecture and dependency ordering

Use pure TypeScript for document validation, local calendar arithmetic, and streak derivation. Use a client-only Nuxt composable to own saved state and localStorage writes. Pages and components consume that state; they do not maintain separate streak counters. The existing starter `app/app.vue` will become the route shell.

Persist as soon as the first usable screen exists. Every later mutation follows the same rule: validate the candidate document, save it, then publish the new state. Save failures must not appear as successful edits. Keep the storage key `habit-tracker:v1`; do not store derived stats.

```text
T01 Spec alignment -> T02 Test harness -> T03 Document/calendar contract
T03 -> T04 Saved starter screen -> T05 Add habit -> T06 Mark today
T06 -> T07 Daily streaks
T06 -> T08 Weekly streaks
T07 + T08 -> T09 Show stats -> T10 History editing
T10 -> T11 Storage recovery -> T12 Clock/tab refresh
T02 + T05..T12 -> T13 Browser acceptance
```

The execution order below is sequential. T07 and T08 are independent after T06, but no parallel agents are needed. The only infrastructure-first work is the test harness and shared data/calendar contract; each subsequent slice exposes a usable behavior or verifies a specific failure path.

## Verification conventions

- After T02, run each task's focused test command. Use an injected local evaluation date for deterministic calendar tests.
- Run `pnpm build` at each checkpoint and after changes to routing or browser initialization.
- The Vitest and Playwright commands below become runnable only after T02. Its configuration must define Chromium and WebKit projects and a local web server for browser tests.
- Checkpoints collect verification evidence and provide review points. Stop for unresolved acceptance failures or scope decisions, rather than marking a checkpoint complete.

## Tasks

### T01: Align the specification with habit creation

- [ ] Complete T01.

**Description:** Resolve the fixed-habit contradiction before code depends on it.

**Acceptance criteria:**
- [ ] SPEC.md describes starter habits plus the proposed creation form, validation, and per-habit start dates.
- [ ] Its JSON example, identifier rules, screens, and non-goals agree on the extensible schema; editing and deletion remain excluded.
- [ ] The first-partial-week and one-completion-per-date defaults are recorded consistently, and any requested changes are settled before dependent code.

**Verification:** Review `git diff -- SPEC.md tasks/plan.md` for contradictory scope or schema statements. No runtime tests are needed for this documentation task.

**Dependencies:** None.
**Files likely touched:** `SPEC.md`, `tasks/plan.md`.
**Estimated scope:** Small, two files.

### T02: Configure a runnable test harness

- [ ] Complete T02.

**Description:** Make the planned checks executable without implementing product behavior.

**Acceptance criteria:**
- [ ] Vitest can run TypeScript unit and integration tests with coverage support.
- [ ] Playwright defines Chromium and WebKit projects and can launch the local Nuxt server.
- [ ] A smoke test loads the existing app without runtime errors; the production build succeeds.

**Verification:** `pnpm exec vitest run --passWithNoTests`; `pnpm exec playwright test e2e/smoke.spec.ts --project=chromium`; `pnpm build`. The no-tests flag is only a harness check, never evidence of product correctness.

**Dependencies:** T01.
**Files likely touched:** `package.json`, `pnpm-lock.yaml`, `vitest.config.ts`, `playwright.config.ts`, `e2e/smoke.spec.ts`.
**Estimated scope:** Medium, five files.

### T03: Define the document and calendar contract

- [ ] Complete T03.

**Description:** Establish the validated shared model that creation, persistence, and streaks will use.

**Acceptance criteria:**
- [ ] A valid document contains unique habit IDs, supported schedules, per-habit start dates, and sorted unique completion dates linked to existing habits.
- [ ] Validation rejects malformed documents, unsupported versions, invalid dates, invalid weekly targets, and completions before a habit's start; retained future records are not discarded after clock changes.
- [ ] Local-date helpers find adjacent dates and Monday week boundaries across leap days, year boundaries, and daylight-saving changes without assuming 24-hour days.

**Verification:** `pnpm exec vitest run tests/unit/tracker-model.test.ts tests/unit/calendar.test.ts`.

**Dependencies:** T02.
**Files likely touched:** `app/utils/tracker-model.ts`, `app/utils/calendar.ts`, `tests/unit/tracker-model.test.ts`, `tests/unit/calendar.test.ts`.
**Estimated scope:** Medium, four files.

### Checkpoint A: Contract ready

- [ ] T01–T03 acceptance criteria met; spec and plan agree on habit creation.
- [ ] `pnpm exec vitest run` and `pnpm build` pass.
- [ ] Review schema validation and local-calendar examples before building mutation flows.

### T04: Persist the starter tracker to localStorage

- [ ] Complete T04.

**Description:** Replace the welcome screen with a read-only Today screen backed by real saved state.

**Acceptance criteria:**
- [ ] A missing key saves a document containing the three starter habits and local start dates, and reload restores it without reseeding.
- [ ] The client-only load has loading, ready, and storage-error states; edits stay disabled until ready, and server rendering never reads localStorage.
- [ ] Today shows the saved habit names and thresholds plus the device-local storage statement; no habit data is transmitted.

**Verification:** `pnpm exec vitest run tests/integration/persistence.test.ts`; `pnpm build`; manually reload Today and inspect the saved document.

**Dependencies:** T03.
**Files likely touched:** `app/app.vue`, `app/pages/index.vue`, `app/utils/tracker-storage.ts`, `app/composables/useTracker.ts`, `tests/integration/persistence.test.ts`.
**Estimated scope:** Medium, five files.

### T05: Add a habit

- [ ] Complete T05.

**Description:** Deliver an end-to-end creation flow, including a successful localStorage write.

**Acceptance criteria:**
- [ ] The inline form accepts a trimmed nonblank name and threshold description plus a daily or valid weekly schedule; invalid input shows a useful error without adding a habit.
- [ ] A valid submission generates a unique immutable ID, sets its local start date, and displays exactly one new habit after a successful save; cancel makes no change.
- [ ] Reload retains the added habit; a failed save retains the form input and previous saved list and offers retry.

**Verification:** `pnpm exec vitest run tests/integration/add-habit.test.ts`; manually add one daily and one weekly habit, then reload.

**Dependencies:** T04.
**Files likely touched:** `app/components/AddHabitForm.vue`, `app/pages/index.vue`, `app/composables/useTracker.ts`, `tests/integration/add-habit.test.ts`.
**Estimated scope:** Medium, four files.

### T06: Mark a day done

- [ ] Complete T06.

**Description:** Allow one-touch check and uncheck actions for today's date.

**Acceptance criteria:**
- [ ] Every habit has a labeled checkbox that adds or removes today's date once; repeated checks never create duplicates.
- [ ] Sleep is recorded on the wake-up date; actions before a habit's start or after the current evaluation date are rejected.
- [ ] A successful edit survives reload; a write failure leaves the displayed completion at its last saved value and offers retry.

**Verification:** `pnpm exec vitest run tests/integration/mark-day.test.ts`; manually check, reload, uncheck, and reload using keyboard and touch controls.

**Dependencies:** T05.
**Files likely touched:** `app/components/HabitRow.vue`, `app/pages/index.vue`, `app/composables/useTracker.ts`, `tests/integration/mark-day.test.ts`.
**Estimated scope:** Medium, four files.

### Checkpoint B: Saved core flow

- [ ] T04–T06 acceptance criteria met; starter initialization, habit creation, and check/uncheck survive reload.
- [ ] `pnpm exec vitest run` and `pnpm build` pass.
- [ ] Review failed-write behavior and the absence of duplicate or transmitted completions.

### T07: Compute daily streaks

- [ ] Complete T07.

**Description:** Derive current and longest daily streaks from saved completion dates.

**Acceptance criteria:**
- [ ] A completed today extends its run; a pending today preserves yesterday's run; a closed missed day resets the current streak.
- [ ] Longest streak scans the full eligible history; empty histories return zero, duplicate dates do not count twice, and retained future dates do not contribute.
- [ ] Backdating restores connected runs and unchecking can reduce both current and longest streaks; calculations honor each habit's start and calendar adjacency.

**Verification:** `pnpm exec vitest run tests/unit/daily-streaks.test.ts`, including the Monday–Friday examples in SPEC.md.

**Dependencies:** T06.
**Files likely touched:** `app/utils/daily-streaks.ts`, `tests/unit/daily-streaks.test.ts`.
**Estimated scope:** Small, two files.

### T08: Compute weekly streaks

- [ ] Complete T08.

**Description:** Derive weekly streaks and progress for any supported weekly target.

**Acceptance criteria:**
- [ ] Group distinct qualifying dates by Monday–Sunday week; count a successful week exactly once when its target is met, including a successful open week.
- [ ] A pending week preserves the preceding run; an unsuccessful closed week resets it at Monday; the partial first week follows the reviewed default.
- [ ] Derive longest runs and counts for targets one through seven, excluding future records; historical corrections restore or break runs without stored counters.

**Verification:** `pnpm exec vitest run tests/unit/weekly-streaks.test.ts`, including two/three/four-day exercise cases and month/year boundaries.

**Dependencies:** T06.
**Files likely touched:** `app/utils/weekly-streaks.ts`, `tests/unit/weekly-streaks.test.ts`.
**Estimated scope:** Small, two files.

### T09: Show stats on Today

- [ ] Complete T09.

**Description:** Connect saved habits and streak derivation to the main screen without adding an analytics dashboard.

**Acceptance criteria:**
- [ ] Every habit shows current and longest streak with explicit day/week units; weekly habits also show this week's qualifying-day count and target.
- [ ] Stats recompute after a saved check/uncheck or habit creation; a failed write does not change them, and no counters are persisted.
- [ ] First-use zero states, pending periods, and completed targets are understandable through text as well as color at a 320 CSS-pixel viewport.

**Verification:** `pnpm exec vitest run tests/integration/stats.test.ts`; manually verify daily and weekly stats with controlled history fixtures.

**Dependencies:** T07, T08.
**Files likely touched:** `app/components/HabitRow.vue`, `app/composables/useTracker.ts`, `tests/integration/stats.test.ts`.
**Estimated scope:** Medium, three files.

### Checkpoint C: Streaks visible

- [ ] T07–T09 acceptance criteria met; all daily and weekly examples have assertions.
- [ ] `pnpm exec vitest run` and `pnpm build` pass.
- [ ] Review pending-period behavior, longest-streak recalculation, and readable units on a phone-sized screen.

### T10: Edit history

- [ ] Complete T10.

**Description:** Add the second core screen for correcting past completions.

**Acceptance criteria:**
- [ ] History selects a date between tracking start and today, enables habits only from their own start date, and prevents future edits.
- [ ] Saved historical check/uncheck actions recalculate Today stats; sleep retains wake-up-date attribution.
- [ ] Show the selected Monday–Sunday range and weekly progress, with direct navigation between History and Today and no separate stats screen.

**Verification:** `pnpm exec vitest run tests/integration/history.test.ts`; manually fill a missed log to restore a streak, then remove it to break the streak.

**Dependencies:** T09.
**Files likely touched:** `app/pages/history.vue`, `app/pages/index.vue`, `app/composables/useTracker.ts`, `tests/integration/history.test.ts`.
**Estimated scope:** Medium, four files.

### T11: Complete storage recovery states

- [ ] Complete T11.

**Description:** Make storage failures recoverable while preserving existing history.

**Acceptance criteria:**
- [ ] Malformed JSON, invalid documents, unsupported versions, unavailable storage, and quota/write failures show distinct useful guidance without overwriting stored values.
- [ ] Retry reloads or resaves as appropriate, without duplicating habits or completions or exposing unsaved edits as successful.
- [ ] If a reset action is provided, cancellation preserves history and explicit confirmation removes only the tracker key; explain that clearing site data loses history and localStorage is not a backup.

**Verification:** `pnpm exec vitest run tests/integration/persistence.test.ts tests/integration/storage-recovery.test.ts`; manually inspect the error UI and verify an unrelated storage key survives reset.

**Dependencies:** T10.
**Files likely touched:** `app/utils/tracker-storage.ts`, `app/composables/useTracker.ts`, `app/components/StorageStatus.vue`, `tests/integration/storage-recovery.test.ts`.
**Estimated scope:** Medium, four files.

### T12: Refresh on clock and tab changes

- [ ] Complete T12.

**Description:** Keep saved-state views accurate when the app stays open or another tab writes history.

**Acceptance criteria:**
- [ ] Focus and local-midnight refresh update today's date and stats before a new check can be attributed to a stale date; Monday closes the previous exercise week.
- [ ] Time zone changes preserve stored date labels and apply the new local calendar to evaluation; future records after a clock change remain stored but excluded from stats.
- [ ] Valid changes to the tracker key in other tabs refresh the UI; invalid changes enter the protective error state. Concurrent writes retain the documented latest-whole-document-write behavior.

**Verification:** `pnpm exec vitest run tests/integration/clock-tabs.test.ts`; simulate midnight, Monday, zone changes, and storage events with controlled dates, then manually inspect two tabs.

**Dependencies:** T11.
**Files likely touched:** `app/composables/useTracker.ts`, `app/utils/calendar.ts`, `tests/integration/clock-tabs.test.ts`.
**Estimated scope:** Medium, three files.

### Checkpoint D: History and failure paths

- [ ] T10–T12 acceptance criteria met; history, storage recovery, and date/tab refresh are verified.
- [ ] `pnpm exec vitest run` and `pnpm build` pass.
- [ ] Review simulated storage failures and midnight behavior before final browser acceptance.

### T13: Verify the complete mobile flow

- [ ] Complete T13.

**Description:** Add browser-level acceptance evidence for the completed feature.

**Acceptance criteria:**
- [ ] Chromium and WebKit tests exercise starter initialization, add habit, check/uncheck, reload persistence, history correction, and daily/weekly stats.
- [ ] The flows work at 320 CSS pixels with keyboard-accessible checkboxes, visible focus and status text, no hydration/runtime errors, and no outgoing requests containing habit data.
- [ ] All spec streak rules and storage error paths have automated assertions; a manual intended-phone check records remaining limitations without claiming untested behavior passed.

**Verification:** `pnpm exec vitest run --coverage`; `pnpm exec playwright test --project=chromium`; `pnpm exec playwright test --project=webkit`; `pnpm build`; manually check the intended phone browser.

**Dependencies:** T02, T05–T12.
**Files likely touched:** `e2e/habit-tracker.spec.ts`, `e2e/storage-failures.spec.ts`, `tasks/plan.md` for verification evidence.
**Estimated scope:** Medium, three files. Fixes discovered here return to the relevant task; do not hide a broad feature rewrite in this verification task.

### Checkpoint E: Complete

- [ ] All task acceptance criteria and focused checks pass; the production build succeeds.
- [ ] Full Chromium/WebKit flow passes and intended-phone validation is recorded or explicitly remains outstanding.
- [ ] No accounts, cloud sync, reminders, advanced analytics, or unrequested habit-management features were introduced.
- [ ] Review the completed result before any separately authorized deployment.

## Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Creation contradicts the draft spec | Incompatible model and UI | T01 updates the contract before code; defaults remain visible for review. |
| Browser storage fails or is cleared | History loss or misleading success | Save before publishing edits; preserve invalid values; show clear device-local persistence guidance. |
| Date arithmetic crosses DST or year boundaries | Incorrect streaks | Inject evaluation dates; test calendar adjacency and Monday cutoffs early. |
| A new habit inherits earlier missed dates | Immediate undeserved streak breaks | Use per-habit start dates throughout validation and calculations. |
| Test setup needs additional Nuxt integration configuration | Planned commands cannot run | Validate the harness in T02; if configuration exceeds five files, split that task before continuing. |
| Tabs overwrite simultaneous edits | A saved edit can be lost | Document latest-write behavior; refresh on storage events; do not claim concurrent merging. |

## Review decisions

Before implementation, review the proposed Add habit form and extensible schema, the one-completion-per-date rule, and the treatment of a partial first week. The latest request authorizes producing this plan; it does not authorize implementation or deployment. No test commands were executed as part of this documentation task.

## Implementation record

The user subsequently selected daily streak calculation, followed by contract-first storage and a minimal Today UI, rather than executing every task in the numbered sequence. The implemented slice includes version-2 schema validation, original version-1 migration, starter initialization, saved check/uncheck actions, daily and weekly stats, guarded save retries, and focus/midnight/storage-event refresh. See `docs/storage-contract.md` for the revised contract. The test runner is Node's built-in runner (`npm test`), replacing the proposed dependency-heavy harness for this slice. Habit creation and History UI remain later work; their tasks are not marked complete. No deployment has been performed.
