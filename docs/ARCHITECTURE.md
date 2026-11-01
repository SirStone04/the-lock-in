# Architecture and integrity model

## Runtime

The frontend is a static React/TypeScript application built by Vite. GitHub Pages serves public application assets over HTTPS. Hash navigation keeps deep links compatible with Pages repository subpaths. Tailwind and shared CSS/components provide the responsive design system; Lucide icons and Recharts are bundled locally.

Firebase Authentication supplies email/password identity. Cloud Firestore is the sole authoritative record store in cloud mode. There is no application server, Cloud Function, paid AI API, bank integration, or automatic connection to ChatGPT conversations.

## Code map

| Location | Responsibility |
| --- | --- |
| `src/components/` | Accessible reusable controls and record forms |
| `src/pages/` | Dashboard, daily workflows, trackers, planning, reports, settings |
| `src/data/firebase.ts` | Firebase initialization and trusted-device cache selection |
| `src/data/store.tsx` | Authentication state, subscriptions, writes, revisions, restore/delete |
| `src/data/local.ts` | Explicit device-only IndexedDB workspace when cloud is unconfigured |
| `src/data/backup.ts` | Versioned backup validation and optional browser encryption |
| `src/domain/models.ts` | Shared record envelope and helpers |
| `src/domain/dates.ts` | Eastern calendar and Sunday–Saturday boundaries |
| `src/domain/rank.ts` | Scoring, derived XP ledger, division qualifications, achievements |
| `src/domain/calculations.ts` | Payroll estimates and financial totals |
| `src/domain/fitness.ts` | Prescriptions and conservative workout progression |
| `src/domain/recommendations.ts` | Explained rule-based coaching |
| `src/domain/planning.ts` | Versioned plan validation, stable mission IDs, scheduling checks |
| `src/domain/reports.ts` | Stored-data weekly report generation and planning prompts |
| `src/tests/` | Unit/domain tests |
| `tests/rules/` | Firebase emulator ownership/revision security tests |
| `.github/workflows/deploy.yml` | Reproducible tests, build, Pages deployment |

## Record envelope

Authenticated records live at `users/{uid}/records/{id}`. Each includes `id`, `kind`, local calendar `date` (`YYYY-MM-DD`), `title`, a kind-specific `data` map, UTC ISO `createdAt`/`updatedAt`, and integer `revision`. Timestamp instants and local dates serve different purposes and are retained separately. The security rules restrict ownership, allowed envelope fields/kinds, immutable record kind/creation time, and revision progression.

Financial transactions and workout sets use independent IDs. Generated missions and imported plan tasks use deterministic IDs so an unchanged repeat does not create another record. Reports and weekly plans retain their IDs when edited. Backups include a schema version. Unsupported schemas are rejected rather than guessed. There is no destructive automatic migration of arbitrary imported data.

The generic envelope keeps storage uniform, while forms, domain calculations, and plan/backup validation enforce field constraints. Firestore security rules are not a substitute for application domain validation; an owner controls their own records.

## Writes, offline behavior, and conflicts

Cloud mode uses the current Firebase persistent cache with the multiple-tab manager only when the user has selected a trusted private device. Session mode uses an in-memory Firestore cache. Firebase queues eligible offline writes, and snapshot metadata drives the pending indicator. A network indicator describes browser connectivity, which does not prove the backend is reachable; surfaced write errors remain authoritative.

An edit carries its expected revision. Online week/settings changes use a Firestore transaction to detect a newer server version. Database rules reject stale revisions for other records, including delayed offline edits. Rejected writes surface a conflict panel with the attempted input so the user can choose a version. A local choice is an explicit overwrite attempt against the current revision. This is conflict detection and user resolution, not an automatic merge of all offline edits.

On trusted devices, an unacknowledged edit also has a small recovery draft so a rejected write is not lost merely by refreshing. These drafts are not merged into records, do not contribute to calculations, and are removed after acknowledgement or explicit resolution. A recovered draft requires review in Settings. They are another reason to avoid trusted-device mode on shared browsers.

The optional local workspace is an explicitly selected standalone mode using IndexedDB. Cloud mode never reads it as a second authoritative database. Moving records between the modes requires a deliberate export/restore. Browser persistence can be removed or evicted; downloaded backups are still necessary.

## Scoring and money

Daily consistency is derived from source records: up to 80 weighted mission points, 10 honest check-in points, and 10 reflection points. Category weighting prevents a large number of maintenance checkboxes from dominating major commitments. Optional missions are excluded unless included in a plan; excused/rescheduled missions are excluded. Partial credit uses actual recorded quantities or duration. Empty applicable plans do not earn automatic adherence. XP is capped at 100 per calendar day and uses a deterministic daily ledger identity with source revisions, so editing recalculates instead of duplicating awards.

The 24 divisions follow III → II → I within each rank. Thresholds begin with `500*k + 45*k*k`. Promotion also needs rolling consistency, with an onboarding qualification; the UI exposes requirements. Career/financial achievements are separate from consistency XP. Rank history records preserve already earned divisions while current form shows recent changes. This client-controlled personal system is auditable accountability, not tamper-proof competitive anti-cheat.

Shift gross pay is an estimate unless verified. Premiums only apply to explicitly qualifying hours. Actual income uses transaction records, with a stable linked transaction for a received paycheck. Internal transfers do not become spending. Reconciled account snapshots are distinct from estimates; unknown balances remain unknown.

## Reporting and plans

Weekly reports aggregate actual stored records using Sunday–Saturday boundaries. Estimates, missing information, and incomplete logs are labeled. Exported Markdown/JSON and the planning prompt support a manual ChatGPT workflow. The documented versioned plan schema is validated, previewed, checked for duplicates/conflicts, then imported only after the user confirms. A suggested plan does not silently modify fixed work commitments.

## Service worker and privacy

The PWA precaches only generated application assets. It has no runtime caching rule for Firestore/Auth requests or user records. Offline private data belongs to the Firebase cache. The manifest, app icons, start URL, and service-worker scope use the configured Pages base. Service-worker updates are offered by the UI so the user can finish saving before reload.

Signing out does not necessarily remove every previously cached byte from browser storage on a trusted device. Use persistent caching only on a personal device, keep device access locked, and clear site data deliberately only after pending writes finish and backups are secure.

## Free-tier operation and growth

The app uses a single owner-record subscription and client calculations to avoid paid servers and repeated aggregate requests. Firestore bills reads/writes according to service quotas, including initial snapshots on devices. A long-running account with many years of exercise sets may need date-bounded subscriptions/archival work to stay comfortably within daily free limits; this initial personal dataset approach is not an unlimited free-use guarantee. Keep the project on Spark if avoiding automatic charges is a requirement.

No credentials, service-account secrets, personal logs, or backups should enter public source control. Firebase client identifiers are public configuration. Deployment does not automatically apply database rules; the setup guide covers publishing them before use.
