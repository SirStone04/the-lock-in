import type { AppRecord, Data } from "./models";
import { dayOfWeek } from "./dates";
export interface Reminder {
  id: string;
  title: string;
  body: string;
  route: string;
}
const minutes = (time: string) => {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
};
/** Foreground delivery only. Missing the window never creates a promised background job. */
export function dueReminders(
  records: AppRecord[],
  date: string,
  time: string,
  preferences: Data = {},
): Reminder[] {
  if (preferences.reminders === false) return [];
  const now = minutes(time);
  const result: Reminder[] = [];
  const within = (target: string) =>
    Number.isFinite(minutes(target)) &&
    now >= minutes(target) &&
    now - minutes(target) < 15;
  if (within(String(preferences.morningReminder ?? "08:30")))
    result.push({
      id: `morning-${date}`,
      title: "Make room for what matters",
      body: "Review your daily missions. Begin with prayer and Scripture.",
      route: "today",
    });
  if (
    within(String(preferences.eveningReminder ?? "22:30")) &&
    !records.some(
      (r) => r.kind === "daily" && r.date === date && r.data.closed === true,
    )
  )
    result.push({
      id: `evening-${date}`,
      title: "Close your day with intention",
      body: "Log an honest check-in, reflect, and review tomorrow’s briefing.",
      route: "today",
    });
  if (dayOfWeek(date) === 6 && within("21:00"))
    result.push({
      id: `report-${date}`,
      title: "Your preliminary weekly review",
      body: "Open Weekly Reports to review stored records from this week.",
      route: "reports",
    });
  if (dayOfWeek(date) === 0 && within("09:00"))
    result.push({
      id: `planning-${date}`,
      title: "Set a sustainable weekly plan",
      body: "Review last week and choose three realistic goals.",
      route: "planner",
    });
  for (const r of records.filter(
    (r) =>
      r.kind === "mission" &&
      r.date === date &&
      ["Education", "Fitness"].includes(String(r.data.category)) &&
      !["completed", "excused", "rescheduled"].includes(
        String(r.data.status).toLowerCase(),
      ),
  )) {
    const scheduled = String(r.data.scheduledTime || r.data.plannedTime || "");
    if (within(scheduled))
      result.push({
        id: `mission-${r.id}`,
        title: r.title,
        body: "Your planned session is due. Review energy and recovery before starting.",
        route: r.data.category === "Fitness" ? "fitness" : "education",
      });
  }
  return result;
}
