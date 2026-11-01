import type { AppRecord, JsonValue } from "./models";
import { num, str } from "./models";

export interface Exercise {
  name: string;
  sets: number;
  minReps: number;
  maxReps: number;
  rest: number;
  notes: string;
}
export interface WorkoutTemplate {
  id: string;
  name: string;
  description: string;
  exercises: Exercise[];
}
export const WORKOUT_TEMPLATES: WorkoutTemplate[] = [
  {
    id: "full-body-a",
    name: "Full Body A",
    description: "Upper-body emphasis. Adjust volume to recovery.",
    exercises: [
      {
        name: "Chest Press",
        sets: 3,
        minReps: 8,
        maxReps: 12,
        rest: 90,
        notes: "Controlled repetitions; stop before form breaks down.",
      },
      {
        name: "Lat Pulldown",
        sets: 3,
        minReps: 8,
        maxReps: 12,
        rest: 90,
        notes: "Comfortable range of motion.",
      },
      {
        name: "Seated Row",
        sets: 2,
        minReps: 10,
        maxReps: 12,
        rest: 90,
        notes: "Keep your torso steady.",
      },
      {
        name: "Leg Press",
        sets: 2,
        minReps: 10,
        maxReps: 15,
        rest: 120,
        notes: "Moderate effort; reduce if legs are fatigued.",
      },
      {
        name: "Cable Crunch",
        sets: 2,
        minReps: 10,
        maxReps: 15,
        rest: 60,
        notes: "Choose a comfortable load.",
      },
    ],
  },
  {
    id: "full-body-b",
    name: "Full Body B",
    description:
      "Lower-body emphasis. Protect recovery before demanding activity.",
    exercises: [
      {
        name: "Leg Press",
        sets: 3,
        minReps: 8,
        maxReps: 12,
        rest: 120,
        notes: "No maximal attempts; keep repetitions controlled.",
      },
      {
        name: "Seated Leg Curl",
        sets: 2,
        minReps: 10,
        maxReps: 15,
        rest: 90,
        notes: "Use a controlled return.",
      },
      {
        name: "Leg Extension",
        sets: 2,
        minReps: 10,
        maxReps: 15,
        rest: 90,
        notes: "Reduce volume if sore from your previous session.",
      },
      {
        name: "Incline Chest Press",
        sets: 2,
        minReps: 8,
        maxReps: 12,
        rest: 90,
        notes: "Maintain a comfortable effort.",
      },
      {
        name: "Seated Row",
        sets: 2,
        minReps: 10,
        maxReps: 12,
        rest: 90,
        notes: "Leave repetitions in reserve.",
      },
    ],
  },
  {
    id: "sunday-optional",
    name: "Shoulders, Arms & Core",
    description: "Optional short session. Rest is an equally valid choice.",
    exercises: [
      {
        name: "Lateral Raise",
        sets: 2,
        minReps: 12,
        maxReps: 15,
        rest: 60,
        notes: "Light, controlled movement.",
      },
      {
        name: "Cable Curl",
        sets: 2,
        minReps: 10,
        maxReps: 15,
        rest: 60,
        notes: "Avoid swinging.",
      },
      {
        name: "Triceps Pressdown",
        sets: 2,
        minReps: 10,
        maxReps: 15,
        rest: 60,
        notes: "Comfortable elbows and range.",
      },
      {
        name: "Cable Crunch",
        sets: 2,
        minReps: 10,
        maxReps: 15,
        rest: 60,
        notes: "Stop if uncomfortable.",
      },
    ],
  },
];
export function validateExercises(value: unknown): Exercise[] {
  if (!Array.isArray(value) || !value.length || value.length > 30)
    throw new Error("Provide 1–30 exercises.");
  const names = new Set<string>();
  return value.map((e: unknown) => {
    const x = e as Record<string, unknown>;
    if (
      !x ||
      typeof x.name !== "string" ||
      !x.name.trim() ||
      x.name.length > 100 ||
      !Number.isInteger(x.sets) ||
      Number(x.sets) < 1 ||
      Number(x.sets) > 12 ||
      !Number.isInteger(x.minReps) ||
      !Number.isInteger(x.maxReps) ||
      Number(x.minReps) < 1 ||
      Number(x.maxReps) < Number(x.minReps) ||
      Number(x.maxReps) > 100 ||
      !Number.isFinite(x.rest) ||
      Number(x.rest) < 0 ||
      Number(x.rest) > 1800
    )
      throw new Error(
        "Each exercise needs a name (≤100 characters), 1–12 sets, valid repetition range, and rest seconds (0–1800).",
      );
    if (names.has(x.name.trim().toLowerCase()))
      throw new Error("Exercise names must be unique within a prescription.");
    names.add(x.name.trim().toLowerCase());
    return {
      name: x.name.trim(),
      sets: Number(x.sets),
      minReps: Number(x.minReps),
      maxReps: Number(x.maxReps),
      rest: Number(x.rest),
      notes: typeof x.notes === "string" ? x.notes : "",
    };
  });
}
export function exercisesAsJson(exercises: Exercise[]): JsonValue {
  return exercises.map((e) => ({ ...e }));
}
export function sessionSets(
  records: AppRecord[],
  sessionId: string,
): AppRecord[] {
  return records
    .filter(
      (r) => r.kind === "exerciseSet" && str(r, "sessionId") === sessionId,
    )
    .sort((a, b) => num(a, "index") - num(b, "index"));
}
export function trainingVolume(sets: AppRecord[]): number {
  return sets
    .filter((r) => r.data.completed === true)
    .reduce((sum, r) => sum + num(r, "weight") * num(r, "reps"), 0);
}
export function previousExerciseSets(
  records: AppRecord[],
  session: AppRecord,
  exercise: string,
): AppRecord[] {
  const previous = records
    .filter(
      (r) =>
        r.kind === "workout" &&
        !r.data.isTemplate &&
        r.id !== session.id &&
        str(r, "status") === "completed" &&
        (r.date < session.date ||
          (r.date === session.date && r.createdAt < session.createdAt)),
    )
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
    );
  for (const workout of previous) {
    const sets = sessionSets(records, workout.id).filter(
      (r) => str(r, "exercise") === exercise && r.data.completed === true,
    );
    if (sets.length) return sets;
  }
  return [];
}
export function progression(
  exercise: Exercise,
  sets: AppRecord[],
  fatigue?: number,
  sleepHours?: number,
  recentWorkHours = 0,
): {
  action: "establish" | "maintain" | "increase" | "reduce";
  reason: string;
} {
  if (
    (fatigue !== undefined && fatigue >= 8) ||
    (sleepHours !== undefined && sleepHours < 6) ||
    recentWorkHours >= 30
  )
    return {
      action: "reduce",
      reason:
        "Recent fatigue, short sleep, or warehouse workload supports reducing volume or resting. Maintain or reduce load as needed.",
    };
  const done = sets.filter((s) => s.data.completed === true);
  if (!done.length)
    return {
      action: "establish",
      reason:
        "No previous working sets recorded. Choose a comfortable starting load; no weight is assumed.",
    };
  if (done.some((s) => num(s, "rpe") >= 9 || num(s, "reps") < exercise.minReps))
    return {
      action: "maintain",
      reason:
        "Prior effort was high or repetitions were below range. Repeat a comfortable load, or reduce if needed.",
    };
  if (
    done.length >= exercise.sets &&
    done.every(
      (s) =>
        num(s, "reps") >= exercise.maxReps &&
        num(s, "rpe") > 0 &&
        num(s, "rpe") <= 8,
    )
  )
    return {
      action: "increase",
      reason:
        "All planned sets reached the top of the range at RPE 8 or less. If recovered, consider the smallest available increase next session.",
    };
  return {
    action: "maintain",
    reason:
      "Build comfortable repetitions within the target range. An increase is optional and requires recovery.",
  };
}
