import { today, weekDates, weekEnd, weekStart } from "./dates";
import type { RecordInput } from "./models";

/** Public starter commitments contain no personal history, financial settings, or fixed schedule. */
export function initialPlan(date = today()): RecordInput[] {
  const start = weekStart(date);
  const result: RecordInput[] = [
    {
      id: `week-${start}`,
      kind: "week",
      date: start,
      title: "Weekly operating plan",
      data: {
        weekStart: start,
        weekEnd: weekEnd(start),
        goals: [
          "Choose realistic daily commitments",
          "Protect recovery alongside fixed obligations",
          "Review the week honestly",
        ],
        status: "draft",
        notes:
          "Generic starter. Import your private baseline or customize before finalizing.",
      },
    },
  ];
  for (const day of weekDates(date)) {
    for (const [key, title, category, minutes] of [
      ["faith", "Prayer and Scripture", "Faith", 15],
      ["recovery", "Protect sleep and recovery", "Recovery", 15],
    ] as const) {
      result.push({
        id: `mission-${day}-${key}`,
        kind: "mission",
        date: day,
        title,
        data: {
          category,
          plannedMinutes: minutes,
          priority: 3,
          weight: 3,
          status: "not-started",
          scheduledTime: "",
          plannedAt: `${start}T00:00:00`,
          optional: false,
          included: true,
          notes: "",
        },
      });
    }
  }
  return result;
}
export function baselineRecords(date = today()): RecordInput[] {
  return [
    {
      id: "settings-profile",
      kind: "settings",
      date,
      title: "Private personal settings",
      data: {
        trackingStart: date,
        timezone: "America/New_York",
        theme: "dark",
        animations: true,
        backupReminderDays: 7,
      },
    },
    ...initialPlan(date),
  ];
}
