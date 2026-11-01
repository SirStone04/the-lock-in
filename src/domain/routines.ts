import {
  categories,
  type AppRecord,
  type Data,
  type RecordInput,
} from "./models";
import { dayOfWeek, today, weekDates } from "./dates";
import { scheduleConflicts } from "./planning";

export function routineDays(data: Data): number[] {
  if (data.frequency === "Daily") return [0, 1, 2, 3, 4, 5, 6];
  const value = String(data.days ?? "").trim();
  if (!value || !/^\d(?:\s*,\s*\d)*$/.test(value))
    throw new Error(
      "Use comma-separated weekdays, for example 0,2,3 (Sunday, Tuesday, Wednesday).",
    );
  const days = value.split(",").map((part) => Number(part.trim()));
  if (
    days.some((day) => day < 0 || day > 6) ||
    new Set(days).size !== days.length
  )
    throw new Error(
      "Weekdays must be unique whole numbers from 0 (Sunday) to 6 (Saturday).",
    );
  return days;
}
export function validateRoutine(data: Data): string | undefined {
  try {
    routineDays(data);
  } catch (error) {
    return error instanceof Error ? error.message : "Invalid recurring days.";
  }
  if (!categories.includes(data.category as (typeof categories)[number]))
    return "Choose a supported life category.";
  if (
    !Number.isInteger(data.priority) ||
    Number(data.priority) < 1 ||
    Number(data.priority) > 3
  )
    return "Importance must be 1–3.";
  if (
    !Number.isInteger(data.plannedMinutes) ||
    Number(data.plannedMinutes) < 1 ||
    Number(data.plannedMinutes) > 1440
  )
    return "Planned minutes must be a whole number from 1 to 1440.";
  if (
    data.scheduledTime &&
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(data.scheduledTime))
  )
    return "Use a valid 24-hour scheduled time or leave it flexible.";
  return undefined;
}
export interface RoutinePreview {
  missions: RecordInput[];
  duplicates: number;
  pastDates: number;
  conflicts: string[];
  issues: string[];
  routineCount: number;
}
export function previewRoutines(
  records: AppRecord[],
  selectedWeek: string,
  notBefore = today(),
): RoutinePreview {
  const routines = records.filter(
    (record) => record.kind === "routine" && record.data.enabled === true,
  );
  const ids = new Set(records.map((record) => record.id));
  const missions: RecordInput[] = [];
  const issues: string[] = [];
  let duplicates = 0,
    pastDates = 0;
  for (const routine of routines) {
    const issue = validateRoutine(routine.data);
    if (issue) {
      issues.push(`${routine.title}: ${issue}`);
      continue;
    }
    const days = routineDays(routine.data);
    for (const date of weekDates(selectedWeek)) {
      if (!days.includes(dayOfWeek(date))) continue;
      if (date < notBefore) {
        pastDates++;
        continue;
      }
      const id = `routine-${routine.id}-${date}`;
      if (ids.has(id)) {
        duplicates++;
        continue;
      }
      ids.add(id);
      missions.push({
        id,
        kind: "mission",
        date,
        title: routine.title,
        data: {
          category: routine.data.category,
          priority: routine.data.priority,
          plannedMinutes: routine.data.plannedMinutes,
          scheduledTime: routine.data.scheduledTime ?? "",
          travelMinutes: routine.data.travelMinutes ?? 0,
          notes: routine.data.notes ?? "",
          target: 1,
          actual: 0,
          actualMinutes: 0,
          status: "not-started",
          routineId: routine.id,
          fixed: routine.data.category === "Employment",
        },
      });
    }
  }
  const days = weekDates(selectedWeek);
  const existing = records.filter(
    (record) =>
      record.kind === "mission" &&
      record.date >= days[0] &&
      record.date <= days[6],
  );
  return {
    missions,
    duplicates,
    pastDates,
    issues,
    routineCount: routines.length,
    conflicts: scheduleConflicts([...existing, ...missions]),
  };
}
