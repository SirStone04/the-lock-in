# Delivery verification

THE LOCK-IN includes functional entry/edit/history flows for all 14 navigation sections, the tomorrow briefing, recurring planning, the 24-division consistency ladder, reports and plan import/export, Firebase authentication/storage integration, owner-only rules, encrypted backups, and a GitHub Pages PWA deployment workflow.

Original local handoff verification on November 1, 2026 (before the publication privacy review):

- `npm test`: **94 tests passed across 13 files**.
- `VITE_BASE_PATH=/the-lock-in/ npm run build`: **passed**, including TypeScript and production service-worker generation.
- Chromium desktop and 390-pixel mobile checks: mission completion, partial check-in editing, workout set persistence after reload, reports/archive, optional mission inclusion, reminder settings and all routes passed. No uncaught runtime errors or horizontal mobile page overflow were observed.
- Production PWA preview at `/the-lock-in/`: manifest/scope/controller paths, app-shell reload offline, and local record entry plus another offline reload passed.
- `git diff --check`: passed for tracked modifications.

Firestore emulator rules tests are present but **not verified here**: the emulator JAR download returned HTTP 403 `Domain forbidden` under the managed environment's network policy. The deployment workflow runs the tests before release. Live Firebase sign-in, Firestore caching/reconnection, two-device synchronization, production rule enforcement, and actual iPhone installation still require the setup and acceptance steps. No Firebase project or deployed URL was fabricated.

The normal build emits informational dependency annotation warnings and a size warning for the Firebase SDK chunk. The app splits page, chart, and Firebase bundles; production PWA assets total approximately 1.7 MB before compression.

Start with `README.md` and `docs/SETUP.md`. Publication preparation separates private profile/configuration and reference records into ignored `work/delivery/THE-LOCK-IN-private-baseline.json`. Keep that file outside the public repository and restore it through Settings on an empty workspace **before Build my first week**. Restore is create-only and preserves existing IDs, so it will not replace a profile already generated. The baseline does not deposit income, complete activities, or award XP. See setup section 13 for the import order and collision behavior.

At the original local handoff, application source remained in the `the-lock-in` working tree and no GitHub push or production deployment had been performed. Publication preparation now reviews source privacy and validation for a new development branch and pull request targeting `main`. The publication task will report the resulting branch, commit, and pull request URL after verification. This authorization does not include merging, updating `main`, or deploying the website. No private baseline or real personal activity records belong in the committed source.

The 94-test result above records the original build verification, not an assumed result for later edits. The publication task must record its final test/build results separately after the privacy changes.

## Publication preparation

For the development-branch pull request, personal financial, health, assessment, meal, sleep and schedule baselines were removed from source defaults and preserved only in the ignored private import. Public UI reads such values from private account profile records. The starter plan and documentation examples now contain generic uncompleted commitments.

Publication review covered 92 source/configuration/documentation/test/icon files. No actual passwords, access tokens, private keys, authenticated URLs, or supplied sensitive personal records were identified. Blank environment templates, public package metadata and clearly synthetic tests are included; environment files, private exports, archived original source, browser profiles and build output are excluded.

After these changes, `npm test` passed **99 tests across 15 files**. The production TypeScript/PWA build also passed. The earlier real-browser checks describe the original completed implementation; the privacy-dependent presentation changes have additional synthetic UI regression tests. Existing live Firebase, emulator-download and real-device verification limitations remain unchanged.

Publication uses a development branch and a pull request targeting `main`. No merge, workflow dispatch or production deployment is part of this operation.
