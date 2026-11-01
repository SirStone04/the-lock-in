# Launch and install THE LOCK-IN

You need a free GitHub account, a free Google/Firebase account, and Node.js 24 LTS for local development. GitHub Pages and Firebase Spark do not require a paid API or server. Stay on Spark; this app does not need Cloud Functions, Firebase Storage, or billing-enabled services. Free plans have quotas and may pause requests when limits are reached.

## 1. Create a Firebase project

1. Open [Firebase Console](https://console.firebase.google.com/).
2. Choose **Create a project**, give it a name, and keep the **Spark** plan. Google Analytics is optional and unnecessary for this app.
3. From Project overview, add a **Web app** (`</>`), name it `THE LOCK-IN`, and do not enable Firebase Hosting.
4. Save the displayed web configuration. These client identifiers are intended to be visible in the built website. A service-account private key is never needed.

## 2. Enable sign-in and the database

1. Under **Build → Authentication**, choose **Get started**.
2. Under **Sign-in method**, enable **Email/Password**. This app does not require the email-link option.
3. Under **Build → Firestore Database**, create a database. Choose a nearby region and **production mode**. Do not leave test-mode public access enabled.
4. In the Firestore **Rules** tab, replace the rules with the exact contents of this repository's `firestore.rules` and choose **Publish**.
5. These rules permit an authenticated owner to access only `users/{theirUid}/records/{recordId}`. They reject anonymous access and access to another account's records. Each authenticated account has its own private records; the app does not publish a directory of users.
6. No composite index is required for the current subscription. `firestore.indexes.json` is included for reproducible configuration.

Alternative for developers: use the Firebase CLI to select your project and run `npx firebase deploy --only firestore:rules,firestore:indexes --project YOUR_PROJECT_ID`. Check the project ID carefully. This publishes security configuration, not application data.

## 3. Configure local development

In this repository:

```sh
npm ci
cp .env.example .env.local
```

Replace the example values in `.env.local` with your Firebase web app values:

```dotenv
VITE_FIREBASE_API_KEY=your-web-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-configured-storage-bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_BASE_PATH=/
```

The storage bucket value is accepted from Firebase configuration; this app does not use paid file storage. Do not add an OpenAI key or Firebase service-account secret. `.env.local` is ignored by Git. Restart Vite after changing environment values:

```sh
npm run dev
```

Select whether this is a trusted private device before signing in. Persistent caching retains sensitive records in this browser, so use session-only mode on shared devices. Create your email/password account through the app, or create it in Firebase Authentication and sign in. A password-reset link uses Firebase's configured email templates.

## 4. Configure authorized domains

In Firebase Console → Authentication → Settings → **Authorized domains**, add:

- `localhost` for local development if it is not already listed.
- Your GitHub Pages hostname, such as `SirStone04.github.io` for this repository. Add the hostname only, without `https://` or `/the-lock-in/`.

The hostname is case insensitive. If you use a different GitHub account or repository, use the hostname shown by your Pages deployment. Configure Firebase's password-reset email action URL if you customize it. Do not claim a deployment exists until GitHub reports one.

## 5. Prepare the GitHub repository

The workspace remote points to `SirStone04/the-lock-in`. If you own that repository, use it; otherwise create your own public source repository and set its remote. GitHub Pages is free for public repositories. Private repository Pages availability depends on your GitHub plan, so use a public source repository if you need the free option. Only source files belong there: authenticated records remain in Firestore.

Before pushing, confirm `.env.local`, backups, private profile/reference records, and service-account files are absent from the staged file list. Create a new development branch from `main`, commit only reviewed application source files and `package-lock.json`, push that development branch, and open a pull request targeting `main`. Do not push directly to or overwrite `main`.

The current publication request authorizes the development branch and pull request only. Do not merge the pull request, manually run the deployment workflow, or deploy the website without separate explicit authorization. A later merge into `main` can trigger the existing deployment workflow. Development-branch pushes and pull-request creation do not trigger that workflow.

## 6. Add GitHub build variables

In GitHub → repository **Settings → Secrets and variables → Actions → Variables**, create these repository variables using your Firebase web configuration:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

The included workflow reads **variables**, not similarly named secrets. These values are included in the public JavaScript bundle. Security depends on the Firestore rules. Never put a server credential in a `VITE_` variable.

The workflow sets `VITE_BASE_PATH` automatically to `/<repository-name>/`. For this project it becomes `/the-lock-in/`. A GitHub user/organization site repository named `username.github.io` instead needs `VITE_BASE_PATH: /` in the workflow. Hash navigation avoids Pages deep-link 404s. Vite uses the base path for scripts, the manifest, icons, and service-worker scope.

## 7. Deploy only after explicit authorization

Publishing source to a development branch and opening a pull request does not authorize a website deployment. Leave the pull request unmerged and do not manually dispatch the deployment workflow until deployment is explicitly approved.

After that separate authorization:

1. In repository **Settings → Pages → Build and deployment**, choose **Source: GitHub Actions**.
2. Review the pull request and its validation, then merge it into `main` only when approved. This main-branch update can trigger **Test and deploy THE LOCK-IN**. A manual workflow run is also a deployment action and requires authorization.
3. The workflow installs pinned dependencies, runs unit tests, runs security rules against a local emulator, builds the app, and deploys the generated `dist` folder.
4. Open the deployment URL reported by the successful **deploy** job. The expected default pattern is `https://<your-account>.github.io/<your-repository>/`; it is a pattern, not proof of a deployed app.
5. Check the Firebase variables if the app still shows configuration setup. Environment values are compiled at build time; an authorized deployment must run again after changing them.

The Firebase CLI does not deploy your static frontend; GitHub Actions does. GitHub Pages does not contain a private database or a server-side API.

## 8. Install on iPhone and sign in on a laptop

1. Open the successful HTTPS Pages deployment in **Safari** on iPhone.
2. Sign in and load the app online at least once. Choose trusted-device caching only for your own phone.
3. Tap **Share → Add to Home Screen → Add**. Launch **LOCK-IN** from the new icon. iOS stores installed web apps separately in some versions, so sign in again if asked.
4. On your laptop, open the same published URL and sign in with the same Firebase account.
5. Log a small test entry, wait until pending writes finish, and verify it appears on the other device. Delete the test record afterward.

An installed icon alone does not prove offline data is ready. Perform the offline acceptance checks before relying on the app without a connection. Browser storage can be evicted; keep backups.

## 9. Understand sync and conflicts

Signed-in records are stored in Firestore under your UID. On a trusted device, the supported Firebase persistent cache keeps previously loaded records and queues offline writes. The app displays network/pending/error state. Reconnect and keep the app open until queued writes finish. A device that has never loaded a record cannot retrieve it while offline. Signing in, password resets, and first setup require internet.

Workout sets and transactions have independent IDs. Important plan/settings edits include revisions, and a detected conflict needs an explicit choice. Offline edits can still conflict with remote changes; inspect a reported error/conflict rather than assuming every edit merges. Avoid editing the same plan on two offline devices at once. Do not clear browser storage while writes are pending.

The optional device-only workspace is for local use without Firebase configuration. It is explicitly separate from cloud data and does not synchronize. Use export/restore to move data intentionally.

## 10. Back up and restore

Open **Settings & Backup** and export all data regularly, especially before major imports or deletion. Store backups somewhere private outside the source repository. Optional password encryption uses browser Web Crypto; keep the password separately because there is no recovery key. Cloud sync does not replace a backup.

Restore validates the versioned schema and preserves stable record IDs. Review any collisions or conflicts. A restore may take time to synchronize; wait for pending writes to finish. Weekly report downloads contain sensitive summaries too. Do not commit them to GitHub.

## 11. Weekly ChatGPT workflow

Generate a weekly report, review missing information and notes, and use **Copy for ChatGPT**. Paste it into your separate Command Center conversation. Use **Copy Planning Prompt** to request the documented versioned JSON plan. Paste the result into Planner, validate it, inspect the preview/conflicts, then confirm. No OpenAI API key or automatic connection to your conversations is involved.

## 12. Updates and troubleshooting

- Commit reviewed source changes on a new development branch, push that branch, and open a pull request targeting `main`. Merge only after explicit authorization; updating `main` can run GitHub Actions and replace the published app after a successful deployment. Do not manually dispatch a deployment while approval is pending.
- Save current work before accepting a PWA update. If a device still shows an older version, reload while online and accept the update notice. Avoid clearing storage until all pending records have synchronized and you have a backup.
- A blank page or missing assets usually means the base path is wrong. Verify `VITE_BASE_PATH` matches the Pages repository path.
- Permission-denied errors usually mean the database rules do not match the UID-owned path or the account has signed out. Verify Authentication and rules before changing security.
- A notification permission does not provide a reliable background scheduler on iPhone. Use in-app reminders when the app is open and a phone alarm/calendar when you need a reliable external reminder.
- If tests fail during an update, fix the failure before deploying. To run security tests locally, install Java 21 and use `npm run test:rules`; do not point those tests at your real Firebase project. The CLI's first run downloads Google's Firestore emulator JAR. A restricted network must permit that official download; the build environment used for source delivery blocked it with HTTP 403, so local rules-test execution was not verified there.

## 13. Import the private baseline before initial planning

The workspace delivery includes `work/delivery/THE-LOCK-IN-private-baseline.json`, deliberately excluded from Git. It contains private profile/configuration and reference records rather than public source data. Keep it out of the repository and save a separate private copy before moving checkouts.

On an empty local or signed-in workspace, open **Settings & Backup → Select backup to restore**, choose that file, review the records, and confirm **before choosing Build my first week**. This order lets the first generated plan use the imported private profile. The baseline does not mark activities complete, deposit income, or award XP; historical payroll information remains a reference rather than a paycheck transaction.

Restore adds missing stable IDs only and does not overwrite existing records. If you already generated a profile or plan, a later restore preserves those IDs instead of replacing them. Export a backup and review the existing configuration before deliberately reconciling any differences; do not assume restore merges or replaces an existing profile. Historical pay references remain editable in Employment.
