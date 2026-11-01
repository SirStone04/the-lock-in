# THE LOCK-IN

**Discipline. Consistency. Progress.**

A private personal operating system for daily missions, weekly planning, education, warehouse work, finances, exercise, faith, nutrition, personal maintenance, and recovery. React + TypeScript + Vite, Firebase Authentication/Firestore, and an installable offline app shell. Static hosting is prepared for GitHub Pages; no paid AI API or server is required.

## Run locally

Install Node.js 24 LTS, then open a terminal in this folder:

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open the local address Vite prints. Firebase values are optional for inspecting a clearly labeled device-only workspace. Configure Firebase before using cloud synchronization. Device-only records are separate from a signed-in account; export/restore deliberately if you want to move them.

```sh
npm test
npm run build
npm run preview
```

To test Firestore security rules, install Java 21 and run `npm run test:rules`. The command uses a local Firebase demo project; it does not read or write production records.

## Set up your private synchronized account

Follow [the beginner setup guide](docs/SETUP.md) to create a free Firebase Spark project, enable email/password sign-in, deploy owner-only database rules, add your Firebase web configuration, and enable GitHub Pages. The guide also explains iPhone installation, laptop access, backups, and updates.

Firebase web configuration identifies a public web client; it is not an administrator credential. Private records are protected by authentication and the included Firestore ownership rules. Never add service-account files, passwords, personal backups, or real activity records to this repository.

The public source contains no private user profile. The separately supplied `work/delivery/THE-LOCK-IN-private-baseline.json` remains ignored by Git and contains private configuration and reference records. Restore it through **Settings & Backup before choosing Build my first week in an empty workspace**. Restore is create-only: existing record IDs are preserved, so importing after initial setup will not replace an existing profile. Keep the file separately when moving checkouts; see setup section 13.

## Working model

- Sunday–Saturday planning weeks and America/New_York calendar dates.
- Twenty-four divisions, from Recruit III through Legendary I. Rank reflects following planned commitments; income, hours beyond commitments, lifted weight, and qualifications do not add rank XP.
- Rule-based tomorrow briefings explain recommendations without an AI subscription.
- Weekly reports export stored activity as Markdown/JSON for a manual ChatGPT workflow. Structured plans are validated and previewed before import.
- Firestore is the authoritative store for signed-in accounts. Its optional persistent cache handles offline writes on a trusted device. The service worker caches application assets rather than private API responses.
- Financial estimates, actual paycheck deposits, and internal transfers remain distinct. There is no bank connection.

See [architecture and data behavior](docs/ARCHITECTURE.md), [acceptance checks and verification limits](docs/ACCEPTANCE.md), and the [versioned plan schema](docs/plan-schema.json).

The [delivery record](docs/DELIVERY.md) records the original local handoff results: 94 passing tests, a successful production build, and Chromium mobile/desktop and local offline PWA checks. Publication changes receive a separate final validation before the pull request. The [scoring policy](docs/SCORING.md) explains daily credit, promotions, and late-entry limits.

## Current delivery boundaries

Source and deployment preparation are included. A Firebase project, project configuration, and a successful GitHub Pages release must be supplied/verified in your own accounts. A live synchronized account, iPhone installation, and two-device/offline behavior cannot be claimed until those steps are exercised. Browser notifications require permission and platform support; a closed iPhone app does not reliably run scheduled background reminders. Synchronization is not a backup: download a backup regularly.
