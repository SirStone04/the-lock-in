# Command Center weekly plan format

THE LOCK-IN imports JSON with `schemaVersion: 1`. Use **Weekly Planner → Copy planning prompt** to include an actual weekly report and the plan contract for ChatGPT. The app does not connect directly to your conversation or transmit records to an AI API. Paste ChatGPT's JSON into **Import plan**, validate, inspect conflicts and the new-mission preview, then confirm.

You can also create routines directly in **Weekly Planner → Recurring routines**. Choose Daily or Weekly / custom, enter weekday numbers (0 Sunday through 6 Saturday), choose a category and realistic duration, and enable the routine. **Preview week** lists every proposed mission and schedule conflict. Confirming creates only today/future missions, using stable routine/date IDs and preserving previously generated progress. Editing, disabling or deleting a routine does not silently rewrite its existing missions; edit those deliberately in the weekly plan. Disabled routines generate nothing. Repeating generation safely skips saved IDs.

The machine-readable contract is [plan-schema.json](plan-schema.json). A deliberately incomplete example is [plan-example.json](plan-example.json). Review and adjust all planned commitments before finalizing the week.

Required top-level fields:

- `schemaVersion`: exactly `1`.
- `weekStart`: real Sunday calendar date, `YYYY-MM-DD`, America/New_York.
- `weekEnd`: the following Saturday.
- `goals`: exactly three nonempty strings.
- `dailyTasks`: list of dated task objects.

Optional top-level fields default to empty: `recurringRoutines`, `workCommitments`, `recoveryRecommendations` (strings), and `notes` (string). Unknown fields are rejected, including instructions to update actual records, rank, or finances.

Each dated task has:

| Field | Meaning |
| --- | --- |
| `id` | Unique across all tasks, work commitments and routines in this plan; letters, digits, underscores or hyphens only |
| `title` | Nonempty title, at most 200 characters |
| `category` | Faith, Education, Employment, Fitness, Finances, Nutrition, Skincare, Maintenance or Recovery |
| `priority` | Integer 1–3, with 3 the highest importance |
| `date` | Calendar date inside the selected week |
| `plannedMinutes` | Integer 1–1440 |
| `scheduledTime` | Optional 24-hour `HH:mm`; omitted for a flexible commitment |
| `travelMinutes` | Optional integer 0–180; reserved after the commitment |
| `target` | Optional positive quantity; the app initializes actual performance to zero |
| `notes` | Optional explanatory notes |
| `fixed` | Optional boolean; Employment defaults to fixed |

`recurringRoutines` use the same fields except `date`; provide unique `days` values, where 0 is Sunday and 6 is Saturday. `workCommitments` use dated task fields and must have category Employment.

Stable mission IDs combine week, source task ID and applicable date. Importing the same plan again skips existing mission IDs and preserves their actual progress. Exact matches of date, title, category, time, duration and target are also skipped even when source IDs differ, including a reimported exported plan. It does not overwrite existing missions or delete tasks removed from a later plan. Edit or delete those missions deliberately in the app. If a write is interrupted, retrying fills the remaining missions safely. Missions are independent Firestore documents, so an import is not an atomic database transaction.

Importing writes a draft weekly plan and the confirmed new mission list. It never changes actual shifts, money, workout sets, daily check-ins or XP. Finalize the weekly plan separately after reviewing all commitments. Existing missions in the same week participate in conflict detection.

Warnings identify overlaps, inadequate travel buffers, less than eight hours between the previous shift and the first following commitment, more than eight planned hours on an off-day, long study blocks, heavy gym plans, and consecutive strenuous workdays. Warnings support judgment and are not a guarantee that a schedule is sustainable. The app does not silently move a fixed shift.

Archived reports are snapshots. Editing actual records updates the live report; save the snapshot again deliberately to replace that preliminary or final archived version. Finalization is available from the Sunday after the selected week ends. A report can still be preliminary when data is missing; finalization does not fabricate missing check-ins or accomplishments.
