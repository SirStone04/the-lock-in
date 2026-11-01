# Acceptance and verification record

This document separates automated coverage from checks requiring a configured Firebase account and real devices. Source implementation and an installable manifest do not prove a successful production release.

## Automated commands

```sh
npm ci
npm test
npm run test:rules
npm run build
```

Security tests use a local Firestore emulator with project ID `demo-lock-in`; Java 21 is required. No test should target real personal Firebase data. The build must also be run with `VITE_BASE_PATH=/the-lock-in/` to check repository-path output. GitHub Actions runs tests, emulator rules, and the production build before deployment.

Unit tests cover the domain behaviors present in `src/tests/`, including division ordering/thresholds, consistency recalculation and caps, payroll/financial distinctions, calendar boundaries, backup/plan validation, report arithmetic, and workout progression. The definitive test count and outcome are the command output produced for the delivered source revision, not an assumed number in this checklist.

## Executed browser smoke test

Headless Chromium was available in the task environment and was exercised against the local Vite app at desktop 1440×1000 and mobile 390×844 viewports. The explicit device-only workspace was used; its QA records were confined to an ignored browser profile under `work/`.

Verified through actual UI interactions:

- Private-device acknowledgement and entry into the clearly labeled local workspace.
- Initial weekly generation, Sunday missions, and completing a mission.
- Daily check-in save with actual sleep/energy/fatigue and reflection, followed by reopen. Unfilled optional numeric inputs remained blank and valid after a correction found during QA.
- Full Body A session creation, saving a completed 50 lb × 10 set, refresh, and resuming the same session/set values.
- Weekly report reflected the logged sleep and exercise set; a preliminary report was saved in the archive.
- All fourteen navigation sections plus tomorrow briefing rendered at 390 px with no horizontal document overflow or overflowing main-content elements.
- No JavaScript console errors or uncaught page errors were observed in the completed smoke run. A missing browser favicon found in the initial run was corrected with an original app icon.

The production build was also served under `/the-lock-in/` and exercised in a separate Chromium profile:

- Manifest URL, start URL, ID, and scope used the repository subpath.
- The installed worker controlled the page at `/the-lock-in/sw.js` with scope `/the-lock-in/` after reload.
- With browser connectivity disabled, a full production page reload loaded the cached app shell and displayed the previously saved local sleep record.
- A new note saved while offline survived another full offline reload with its reflection and sleep values intact.
- Eight dashboard quick-action links pointed to the correct sections. An optional mission started excluded and retained an explicitly saved inclusion change after reopening.
- Settings foreground reminder times were visible at the mobile viewport with no document overflow.

These production offline checks used the explicitly selected **device-only** workspace, not Firestore caching. They verify the app shell/service-worker path and local persistence in Chromium. They do not establish iOS behavior, Firebase offline queueing, or two-device synchronization; those require the remaining checks below.

## Required real-device acceptance

Perform these after following `SETUP.md`. Keep a backup before destructive tests. Use test entries and remove them afterward.

| Check | Steps and expected result |
| --- | --- |
| Initial account | Create/sign in; Recruit III and zero actual activity are shown. No example workout/paycheck is treated as a completed record. |
| Navigation | Open all 14 sections on a laptop and iPhone. Bottom navigation and More expose every route. Touch controls, forms, focus states, and text remain usable without horizontal page scrolling. |
| Missions | Generate the baseline plan once, repeat generation/import, and confirm IDs/counts do not duplicate. Create, edit, partially complete, excuse, reschedule, and delete a mission. |
| Daily check-in | Save an unfinished entry, reopen, finish/reflection/close, and edit an older day. XP updates in place, never above 100/day. Check-in money summaries do not create duplicate transactions. |
| Weekly plan | Adjust three goals and commitments before finalizing. Import malformed JSON, duplicate JSON, and overlapping tasks. Review clear validation/conflict messages before confirming. |
| Workout | Start Full Body A, log sets, add/repeat/remove a set, and reload. Resume the same session, finish, and see real previous performance on the next session. No fictional working weight is displayed. |
| Warehouse shift | Log an overnight shift and unpaid break. Verify paid hours, explicitly eligible premium hours, estimated incentives, fatigue, and notes. No estimated wages become cash. |
| Actual paycheck | Record a received paycheck and verify actual income increases once. Edit its amount, reload, and confirm the linked transaction updates rather than duplicates. |
| Transfers and cash | Enter income, an expense, a refund, an internal transfer, a remittance, and a debt payment. Check category totals/cash flow. Cash remains unknown until accounts are reconciled. |
| Education | Enter study questions/correct answers and fresh mixed assessments. Readiness needs three qualifying fresh assessments; historical scores remain separate from fresh assessments. |
| Faith and routines | Log prayer/Scripture/journal, meals/water, AM/PM skincare, and maintenance. Search and edit logs. No routine is precompleted and no unlogged skin improvement is claimed. |
| Sleep and coaching | Log actual sleep under six hours or fatigue ≥8. Briefing explains recovery/reduced optional workload and does not recommend extra shifts. Test a midnight-spanning sleep window. |
| Weekly report | Generate a preliminary report, edit notes, export Markdown/JSON, copy, print, and archive/finalize after the week. Totals match records; unknown values remain labeled. |
| Cross-device | With the same account on iPhone/laptop, log a set and transaction on one device. Wait for pending writes to finish and verify the other device receives them once. |
| Offline writes | On a trusted device previously loaded online, disable connectivity. Open the installed app, log a set/check-in/transaction, reload, and verify visibility. Reconnect and check the second device receives each record once. |
| Offline conflict | On two loaded devices, edit the same plan, one offline. Reconnect; a stale edit must surface an error/conflict and allow explicit resolution rather than silently destroying newer data. |
| Security | Signed-out clients cannot read records. A second authenticated account cannot read or write the first account's path. Emulator rules tests cover this, but verify production rules were actually published. |
| Authentication | Reset password, sign out after pending writes clear, and sign in again. Test session-only versus trusted caching on an appropriate test device. |
| Backup | Export JSON, restore an existing backup, and confirm duplicate IDs are skipped. Encrypt/export/decrypt with the right password; wrong passwords fail. Keep the original before testing deletion. |
| Delete | Confirm the destructive dialog, delete the selected workspace records, and verify another signed-in device reflects deletion. Account identity deletion is separate from deleting activity records. |
| iPhone PWA | Safari Share → Add to Home Screen. Open standalone, check icons/status bar, offline shell after first online load, safe update notice, and scope under the repository path. |
| Reminders | Enable permission only after an explicit action. In-app reminders work while open. Do not expect a closed iPhone PWA to run scheduled jobs. |

## Verification boundaries at source handoff

- No Firebase project configuration or user credentials were supplied in the task environment. A live cloud account and production database synchronization were not fabricated.
- A GitHub Actions workflow and Pages configuration are prepared. A deployed URL is valid only after a successful GitHub deployment result.
- No iPhone hardware was attached. Installation, storage eviction, and real two-device/offline scenarios need the checklist above.
- Local Chromium automation exercised the interactions listed above. Real iPhone Safari/PWA acceptance remains required; emulating a narrow viewport does not establish iOS storage or service-worker behavior.
- Firestore emulator tests were authored but their local execution was blocked by the environment's outbound policy: the Google-hosted emulator JAR download returned HTTP 403 `Domain forbidden`. The GitHub Actions workflow includes these tests in an environment with normal download access; they have not been claimed to pass locally.
- Browser/PWA background execution and notifications vary by platform. The product must remain useful through foreground reminders and manual weekly workflows.

Before relying on this for sensitive daily records, complete the cloud ownership, backup, offline/reconnect, and two-device checks. Keep a backup outside the repository.
