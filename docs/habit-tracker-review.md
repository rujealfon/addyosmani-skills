# Habit tracker review

Current verdict: **Both required changes resolved.** No XSS execution path was found in the reviewed rendering code. The original review findings below are retained as history.

## Fix verification

- R1: failed edits and their errors survive same-day automatic refresh. Retry applies the intent to the latest saved document, preserving another tab's changes. A new explicit action replaces the failed intent; a changed local date cancels it with an announcement. Regression tests cover intervening refresh, concurrent saved changes, and midnight cancellation. Committed as `73a7362`.
- R2: load rejects raw JSON above 1,048,576 UTF-16 code units before parsing. Load, save, and legacy migration enforce 64 habits, 20,000 entries per habit, and 60,000 entries overall before processing completion lists. Duplicate entries count toward capacity. Invalid or oversized originals remain intact. See [storage contract](storage-contract.md#input-capacity).
- Test-first evidence: both new R1 cases failed before the fix; all six new capacity tests failed before the R2 fix. The full suite now passes: **33 tests, 0 failures**. Boundary cases cover below/at/above capacity, migration, and preservation on load/save. Production build passes.
- Repeated the six hostile component-rendering cases and seventeen malformed-storage checks successfully. Both original stress payloads now reject; the 100,000-duplicate payload rejects before parsing.
- Chrome against the rebuilt production app: checking Reading changed its DOM streak to one day, and reload retained the checkoff and streak. Restored the initial unchecked test state afterward. Failure/retry and capacity regressions were verified with the injected controller/storage tests.

## Original review

Scope: the current habit-tracker application, its tests, and the rendering/localStorage contract. Application code was left unchanged. The pre-existing staged SPEC.md and tasks/plan.md were not altered by this review.

## Five-axis assessment

| Axis | Assessment | Evidence |
| --- | --- | --- |
| Correctness | Required change | Daily/weekly rules and storage errors have useful coverage, but automatic refresh discards a failed edit before retry. See R1. |
| Readability and simplicity | Pass | Small focused modules, explicit result unions, readable control flow, and no unnecessary dependencies or generic framework. |
| Architecture | Pass | Schema validation and storage are independent of the browser; injected ports and dates support testing. Vue state owns saved edits, and the component owns rendering. No circular module dependencies found. |
| Security | Required availability hardening; output encoding and schema checks pass | Names/descriptions use escaped text interpolation. Invalid documents are rejected and preserved. Collection and document sizes are unbounded. See R2. |
| Performance | Required change | Storage parsing, validation, date scans, and list rendering are synchronous. Oversized valid documents can produce long work and thousands of rendered rows. See R2. |

## Required: R1, preserve failed edits through automatic refresh

Location: [tracker-state.ts](../app/utils/tracker-state.ts), `refresh()` at lines 27–38; [app.vue](../app/app.vue), focus/visibility handlers at lines 15–32.

`refresh()` unconditionally clears `pending` and clears the save error when the saved document loads successfully. The app calls it whenever the window regains focus or becomes visible. A user who leaves the app to free storage after a failed checkoff loses the retry intent on returning. A subsequent `retry()` only reloads; it does not apply the failed checkoff.

Reproduction against the actual controller: initialize, make storage writes throw, toggle Reading on, unblock writes, call `refresh()` to simulate focus, then call `retry()`. Reading remains unchecked, its completion list remains empty, and the error is gone. Existing tests only cover retry without an intervening automatic refresh.

Remedy: separate refreshing saved data from discarding a pending edit. Preserve the failed intent and its error through same-day automatic refresh; recompute the candidate from the latest saved data on retry. Explicitly handle cancellation, successful save, and a changed local date. Add regression coverage for focus/visibility refresh between write failure and retry, while retaining the midnight test.

## Required: R2, bound untrusted storage input before processing

Location: [tracker-storage.ts](../app/utils/tracker-storage.ts), `decode()` at lines 25–39; [tracker-model.ts](../app/utils/tracker-model.ts), habit/completion loops at lines 54–86.

String lengths, identifiers, fields, dates, and targets are constrained, but raw document size, habit count, and completion counts are not. Duplicate dates are validated individually before deduplication. Shape-valid tampered data can therefore cause excessive synchronous work or an enormous habit list.

Measured in a local Node run:

- A 1,300,552-character document with 100,000 duplicate reading dates was accepted. `load()` took 205 ms in that run, excluding UI rendering.
- A 712,859-character document with 5,000 habits was accepted and exposed all 5,000 habits to the list renderer.

These are workload measurements, not a claim of identical timing in every browser. Exploitation requires control over the app origin's localStorage; the impact is client responsiveness. Browser quota limits do not establish a suitable application workload limit.

Remedy: define supported storage capacity in the contract. Reject excessive raw JSON length before `JSON.parse`, and bound habit counts and total/per-habit completion counts before iteration on both load and save. Apply the same limits to legacy migration. Return a stable failure without overwriting the original. Test just-below/at/above boundaries and verify preservation of oversized documents. Choose capacities that preserve realistic long-term history.

## Focused rendering and storage checks

The trust boundary is localStorage JSON entering `load()`/`validateDocument()`, then validated labels entering HabitItem and the announcement text. History and browser responsiveness are the assets. The checked abuse cases include executable-looking labels, injected attribute text, invalid dates/schedules, unknown fields, prototype keys, unsupported versions, and oversized collections.

- Six hostile name/description payloads were passed through `load()` and the actual compiled HabitItem component using Vue's server renderer. HTML/script/SVG payloads were escaped, and template-expression text stayed literal. This was a component-rendering check, not a browser execution test.
- Habit names and descriptions are rendered through `{{ ... }}` at HabitItem lines 29–30. The announcement also uses interpolation. No `v-html`, `innerHTML`, dynamic templates, or user-controlled URL/style sinks were found in app code. This follows [Vue's documented automatic escaping](https://vuejs.org/guide/best-practices/security.html#what-vue-does-to-protect-you).
- Seventeen additional malformed/tampered JSON cases were rejected on load and refused by save, with zero writes. Cases covered invalid types, long labels, malformed IDs, invalid schedules/dates/start dates, extra fields, and a `__proto__` property. No prototype pollution was observed.
- Known version-1 history migrates through the same schema validator; unknown versions and corrupt data remain intact. Save guards against overwriting an already-invalid stored document. Storage failures expose stable application messages, not internal exceptions.
- Schema-valid edits to history remain possible for anyone controlling localStorage. Validation establishes safe structure and permitted values; this device-local tracker does not establish authenticity of self-reported completions.

## Verification

- Restored-source full suite: `npm test`, **25 passed, 0 failed**.
- Mutation check: inverted the completion start-date validation condition. Five tests failed; restored the exact original source and reran the suite successfully.
- Hostile-rendering and storage checks ran from a temporary review script. The temporary compiled component was removed in a `finally` block.
- Reviewed earlier production-build and Chrome evidence: checkoff changed the DOM streak to one day and survived reload; keyboard and responsive checks passed with a clean console. This review did not introduce runtime code changes requiring another build.

Keep Vue's text interpolation when resolving these findings. Pre-escaping stored labels or rejecting HTML punctuation is unnecessary for this plain-text UI and can damage legitimate names. Add permanent regression tests for hostile labels and the missing refresh/retry sequence alongside the focused fixes.
