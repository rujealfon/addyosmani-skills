# Habit tracker launch runbook

Assessed 2026-10-07. Decision: **NO-GO for public production launch.** Local feature and static-build checks pass, but dependency, quality-tooling, accessibility/performance, and hosted verification gates remain open. This is a deploy plan, not evidence of a hosted release.

The candidate release is the implemented Today slice. General Add habit and History in SPEC.md are unfinished. Do not advertise the full specification as complete. No accounts, analytics service, cloud sync, reminders, database, or backend are included.

## Pre-launch checklist

Checked boxes record evidence. Unchecked boxes are required before public launch unless the release owner records a justified exception and supporting evidence.

### Code quality and behavior

- [x] `npm test` passes all 37 tests. Four new flag tests failed before implementation and pass afterward. Both flag states, duplicate additions, streaks, rollback preservation, and failed-add retry are covered.
- [x] Static generation succeeds with the flag on and off. Client and server compilation succeeds as part of generation.
- [ ] Resolve or document acceptance of Nitro's upstream unused-import warning from `@nuxt/nitro-server/dist/h3.mjs`. Generation currently succeeds with that warning; it is not a warning-free build.
- [ ] Configure and pass lint and separate TypeScript checking. Nuxt generates types during build but this does not establish a successful type check.
- [x] Reviewed changed logic for correctness, readability, architecture, security, and performance. Additions use existing validated saves and daily streak rules. No schema expansion, remote flag provider, or new dependency was introduced.
- [x] No TODO, FIXME, debug `console.log`, `v-html`, or `innerHTML` found in application source.
- [x] Storage has invalid/unsupported/unavailable/write-failed states and guarded retries. Same-day failed intents survive refresh; midnight cancels them.
- [ ] Independent release review of the final diff and runbook.

### Security and privacy

- [x] Existing name rendering uses escaped Vue interpolation. Schema and capacity validation treat localStorage as untrusted and preserve rejected originals.
- [x] No new secrets, transmission, account permissions, or external scripts added. Habit records never enter deployment artifacts.
- [ ] Resolve the dependency audit findings and rerun `pnpm audit --prod --json`. On this date it reported **2 critical and 4 high advisories**, via Nuxt development/build dependencies: `node-forge`, `braces`, `@simple-git/argv-parser`, and `simple-git`. npm audit is inapplicable because this repo uses a pnpm lockfile. Static hosting does not run these server tools for visitors, but build-tool exposure still needs remediation or a documented reachability review; do not assume the audit is clean.
- [ ] Perform a secrets scan of the release history/artifact. No comprehensive scan has been claimed.
- [x] Host configuration includes nosniff, frame denial, referrer policy, permissions policy, HSTS, and CSP.
- [ ] Verify those headers over hosted HTTPS and check the browser console for CSP failures. The local Python file server does not apply Netlify headers. CSP currently allows inline script/style for Nuxt's generated bootstrap and CSS; it is not an XSS substitute. Review hash-based script CSP before launch.
- [x] Authentication, API rate limits, CORS, database indexes, and database migrations are not applicable to this static app.

### Accessibility and performance

- [x] Chrome static-build smoke test confirms keyboard activation of the hydration addition button and checkbox, a one-day DOM streak, and persistence on reload. Successful addition moves focus to the new checkbox. Flag-off reload preserves the saved habit.
- [ ] Validate on the intended phone and Safari/WebKit, with the new button at 320 CSS pixels and visible focus. Prior Today checks do not establish coverage for this new control on every browser.
- [ ] Run axe/Lighthouse and a screen-reader pass. Measure color contrast and dynamic announcements; do not infer these checks from semantic markup alone.
- [ ] Record cold-load measurements on representative mobile hardware/network. Targets: LCP <= 2.5 s, INP <= 200 ms, CLS <= 0.1. These are acceptance targets, not measured results.
- [x] New code reuses existing list/stats modules. Main client chunk is approximately 145 kB, 54.4 kB gzip in the current static build.
- [ ] Measure total route transfer; proposed budget is <= 200 kB gzip for first-load JS/CSS. Verify asset caching and HTML revalidation on the host.

### Infrastructure and operations

- [ ] Name a release operator and backup. Proposed flag owner is the repository maintainer; a named operator has not accepted the launch role.
- [ ] Provision the Netlify project, stable production origin, DNS if needed, and HTTPS. Preview URLs have separate localStorage and do not carry production history.
- [ ] Confirm clean, frozen-lockfile installation on the host with Node 22.23.3 and pnpm 11.18.0. Local verification used existing dependencies.
- [ ] Archive an entire known-good `.output/public` artifact and record its commit SHA, flag state, deploy ID, and public URL before promotion.
- [ ] Configure an external GET probe for `/` and one referenced JS asset every five minutes. A static HTML 200 alone cannot establish JavaScript/storage health.
- [ ] Rehearse host rollback on the same origin. Verify saved records remain usable after republishing the baseline.
- [ ] Complete first-hour smoke checks and record the observation log. No monitoring dashboard or measured production baseline currently exists.
- [x] README and storage contract explain local persistence and flag behavior. This runbook covers deployment and rollback. Skill reference checklists were unavailable at their referenced paths; the skill's inline checklist was used instead.

## Hydration flag contract

`runtimeConfig.public.hydrationHabit` defaults to false. Set `NUXT_PUBLIC_HYDRATION_HABIT=true` during generation to enable the opt-in button. Only boolean true or exact string `true` enables the controller. Invalid values stay off. The flag is public configuration, not an authorization boundary.

The preset is named Hydration, with a daily schedule and the label "Reach your personal daily hydration goal". It records self-reported completion once per local date. There is no numeric intake field or recommended quantity. Adding it creates schema-v2 habit `hydration`, an empty completion list, and a start date of today. The user must opt in. Existing starter habits are unchanged.

The flag controls **creation only**. Off prevents additions, including controller calls, while existing Hydration records remain visible, editable, and included in stats. Saves still enforce all capacity limits and preserve the prior document on failure. A failed addition can be retried; at midnight it is canceled like failed checkoffs. A new explicit action supersedes an earlier failed intent.

No schema version or storage key changes. The schema-v2 baseline at `2a15ea6` supports extensible habits and can read Hydration data. Do not roll back to the fixed-habit schema-v1 implementation.

Owner: repository maintainer until a named release operator is assigned. Review/expiry: 2026-10-21. If still in beta, explicitly renew with a reason. Remove the flag within two weeks of full rollout; retain compatibility with saved Hydration records.

## Static deployment plan, Netlify

[Nuxt generation](https://nuxt.com/docs/4.x/api/commands/generate) produces `.output/public`; [static config is fixed at generation time](https://nuxt.com/docs/4.x/directory-structure/env). The checked-in `netlify.toml` specifies tests before generation, the publish directory, default-off flag, tool versions, and [static headers](https://docs.netlify.com/manage/routing/headers/). It does not create a project or publish anything.

1. Clear the open gates above. Commit the release candidate, including its product specification, without accidentally bundling unrelated work. Record the exact SHA and install with `pnpm install --frozen-lockfile`.
2. Run `npm test`, then `NUXT_PUBLIC_HYDRATION_HABIT=false npm run generate`. Archive the entire output as the flag-off baseline. Do not upload `.output/server`, repository files, or localStorage dumps.
3. Connect the repository to a Netlify project, choose the production branch, and confirm the build command `npm test && npm run generate`, publish directory `.output/public`, and pinned installation versions. Verify the build log actually uses the lockfile without updating it. Disable automatic production publication while rehearsing. Use a draft deploy or branch preview first.
4. Test the flag-off preview with fresh storage and a schema-v2 fixture containing Hydration. Check markup, JS assets, keyboard flow, save/reload, corrupt-storage handling, console, privacy/network requests, and HTTPS headers. Preview fixtures are disposable and stay separate from production records.
5. Generate a flag-on build with `NUXT_PUBLIC_HYDRATION_HABIT=true`. Use an internal beta preview for at least 24 hours. Test opt-in, checkoff, streaks, reload, error retry, and an off-build reload on the same beta origin. Save both complete artifacts and record deploy IDs.
6. Promote the tested flag-off artifact to the stable production origin. Watch the first hour and manually smoke test there. Use the same origin for all future releases so localStorage history remains accessible.
7. Hold Hydration in preview until the operator records clean beta checks. This build-time flag has no per-user targeting, so it cannot truthfully provide 5/25/50 percent rollout. A production flag-on build enables opt-in for everyone. If percentages become required, design and review local cohort assignment separately; do not add remote habit telemetry.
8. When the beta gate passes, promote the tested flag-on artifact. Observe for 24–48 hours before broader promotion announcements, and for one week after full release. Review the flag lifecycle on 2026-10-21.

## Observation and decision thresholds

No habit names, completion dates, counts, or localStorage payloads may leave the device. Use host-level availability checks and operator/browser smoke observations, with feedback that avoids personal history. Aggregate client telemetry is not enabled or claimed. Percentage-of-session error thresholds cannot be measured with the current setup.

Proposed availability SLO: 99.9% successful five-minute probes over 30 days. This permits roughly 43 minutes of failed probes. Establish the probe and baseline before rollout. With less than 20% of the error budget remaining, hold feature activation; with an exhausted budget, freeze releases except reliability fixes. A first launch without a baseline requires all smoke checks to pass.

Advance only with no new console errors, exact checkoff/reload results, no stored-data changes on rejected input, and good measured mobile vitals. Hold for any new warning/error or incomplete measurement. Roll back immediately on lost/unreadable history, wrong-date checkoffs, a new executable rendering path, or reproducible UI failure. Investigate and roll back serving changes after two consecutive failed probes. For latency, hold above 20% of the recorded baseline and roll back above 50%; record actual timings before applying these ratios.

## Rollback steps

1. Stop further publication. If Git auto publishing is enabled, disable it so another build cannot overwrite the rollback. Record the bad deploy ID and symptom without collecting habit history.
2. Disable new Hydration additions by republishing the archived **flag-off artifact of this release**, or by regenerating with `NUXT_PUBLIC_HYDRATION_HABIT=false` and publishing it. Changing a dashboard variable alone will not change existing static files. Prefer the archived artifact for speed and reproducibility.
3. For a broader regression, use Netlify's Deploys view to select the known-good schema-v2 deploy and **Publish deploy**. [Netlify supports republishing a prior deploy](https://docs.netlify.com/deploy/manage-deploys/manage-deploys-overview/). On a first launch with no prior deployment, publish the archived schema-v2 flag-off baseline. Keep the same domain and publish the whole artifact, including its hashed assets and payload files.
4. Reload a beta fixture on the same origin. Verify `/` and referenced assets return 200, no stale-asset/CSP errors occur, the addition button is absent, and existing Hydration/starter histories and streaks remain usable. Check/uncheck a fixture and reload. Repeat on the production origin with an operator's test record.
5. Verify live HTTPS security/cache headers and the next probes. Record rollback time and outcomes. Resume publication only after the fix passes the original gates.

Do not clear site data, delete the tracker key, downgrade documents, strip Hydration records, or run storage cleanup during rollback. There is no server-side habit backup. Code rollback cannot undo earlier device-local corruption; keep rejected stored data intact and recover only from a valid device-local copy. Existing tabs must reload to obtain the rolled-back code.

Targets, not measured guarantees: republish an archived deploy within five minutes; rebuild/redeploy within fifteen minutes. Confirm these with a host rehearsal before launch.

## Remaining release blockers

Audit references for remediation: [node-forge](https://github.com/advisories/GHSA-86w9-cpqp-85rv), [braces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), [argv-parser](https://github.com/advisories/GHSA-v5rq-49vh-5v5c), and simple-git [trailer command](https://github.com/advisories/GHSA-x6jw-m9v5-85vh), [configuration includes](https://github.com/advisories/GHSA-g4wm-2vf7-vfgr), [option abbreviation](https://github.com/advisories/GHSA-858h-whjf-mvg5). Upgrade through a separately verified dependency change; this launch-preparation change leaves the lockfile intact.

Dependency audit remediation or evidence-backed acceptance is required. Separate lint/type checks, accessibility/mobile/performance evidence, hosted headers/probes, and a host rollback rehearsal are still missing. The checklist is not all green. **NO-GO for public launch; GO for continued local validation.** No deployment was performed.
