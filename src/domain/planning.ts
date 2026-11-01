import { z } from "zod";
import { categories, type AppRecord, type RecordInput } from "./models";
import { addDays, localDateTime, weekStart } from "./dates";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (value) =>
      !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) &&
      new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value,
    "Use a real calendar date",
  );
const taskSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .max(100)
      .regex(/^[a-zA-Z0-9_-]+$/),
    title: z.string().min(1).max(200),
    category: z.enum(categories),
    priority: z.number().int().min(1).max(3),
    date: isoDate,
    scheduledTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .optional(),
    plannedMinutes: z.number().int().min(1).max(1440),
    travelMinutes: z.number().int().min(0).max(180).optional(),
    target: z.number().positive().optional(),
    notes: z.string().max(5000).optional(),
    fixed: z.boolean().optional(),
  })
  .strict();
const routineSchema = taskSchema
  .omit({ date: true })
  .extend({ days: z.array(z.number().int().min(0).max(6)).min(1).max(7) });
export const weeklyPlanSchema = z
  .object({
    schemaVersion: z.literal(1),
    weekStart: isoDate,
    weekEnd: isoDate,
    goals: z.tuple([
      z.string().min(1).max(300),
      z.string().min(1).max(300),
      z.string().min(1).max(300),
    ]),
    dailyTasks: z.array(taskSchema).max(250),
    recurringRoutines: z.array(routineSchema).max(50).default([]),
    workCommitments: z
      .array(taskSchema.extend({ category: z.literal("Employment") }))
      .max(14)
      .default([]),
    recoveryRecommendations: z.array(z.string().max(1000)).max(20).default([]),
    notes: z.string().max(10000).default(""),
  })
  .strict()
  .superRefine((plan, ctx) => {
    if (weekStart(plan.weekStart) !== plan.weekStart)
      ctx.addIssue({
        code: "custom",
        message: "Week must begin on Sunday",
        path: ["weekStart"],
      });
    if (addDays(plan.weekStart, 6) !== plan.weekEnd)
      ctx.addIssue({
        code: "custom",
        message: "Week must end on the following Saturday",
        path: ["weekEnd"],
      });
    const tasks = [...plan.dailyTasks, ...plan.workCommitments];
    const ids = new Set<string>();
    for (const t of [...tasks, ...plan.recurringRoutines]) {
      if (ids.has(t.id))
        ctx.addIssue({ code: "custom", message: `Duplicate task ID: ${t.id}` });
      ids.add(t.id);
    }
    for (const t of tasks)
      if (t.date < plan.weekStart || t.date > plan.weekEnd)
        ctx.addIssue({
          code: "custom",
          message: `Task ${t.id} falls outside the selected week`,
        });
    for (const r of plan.recurringRoutines)
      if (new Set(r.days).size !== r.days.length)
        ctx.addIssue({
          code: "custom",
          message: `Routine ${r.id} repeats a weekday`,
        });
  });
export type WeeklyPlan = z.infer<typeof weeklyPlanSchema>;
export type PlanTask = z.infer<typeof taskSchema>;
export function validatePlan(input: string | unknown): WeeklyPlan {
  const data = typeof input === "string" ? JSON.parse(input) : input;
  return weeklyPlanSchema.parse(data);
}
export function planToMissions(plan: WeeklyPlan): RecordInput[] {
  const tasks = [...plan.dailyTasks, ...plan.workCommitments];
  for (const routine of plan.recurringRoutines)
    for (const day of routine.days) {
      const { days: _, ...task } = routine;
      tasks.push({ ...task, date: addDays(plan.weekStart, day) });
    }
  return tasks.map((t) => ({
    id: `plan_${plan.weekStart}_${t.id}_${t.date}`,
    kind: "mission",
    date: t.date,
    title: t.title,
    data: {
      category: t.category,
      priority: t.priority,
      plannedMinutes: t.plannedMinutes,
      scheduledTime: t.scheduledTime ?? "",
      travelMinutes: t.travelMinutes ?? 0,
      target: t.target ?? 1,
      actual: 0,
      status: "Not started",
      notes: t.notes ?? "",
      fixed: t.fixed ?? t.category === "Employment",
      planId: `week_${plan.weekStart}`,
      sourceTaskId: t.id,
    },
  }));
}
function timeMinutes(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}
export function scheduleConflicts(missions: RecordInput[]): string[] {
  const warnings = new Set<string>();
  const days = new Map<string, RecordInput[]>();
  for (const m of missions) {
    if (
      ["rescheduled", "excused"].includes(String(m.data.status).toLowerCase())
    )
      continue;
    days.set(m.date, [...(days.get(m.date) ?? []), m]);
  }
  const allScheduled = missions
    .filter(
      (m) =>
        !["rescheduled", "excused"].includes(
          String(m.data.status).toLowerCase(),
        ),
    )
    .map((m) => ({
      m,
      start: timeMinutes(m.data.scheduledTime ?? m.data.plannedTime),
      duration: Number(m.data.plannedMinutes) || 0,
      travel: Number(m.data.travelMinutes) || 0,
    }))
    .filter((r): r is typeof r & { start: number } => r.start !== null)
    .map((r) => ({
      ...r,
      absolute:
        localDateTime(
          `${r.m.date}T${String(r.m.data.scheduledTime ?? r.m.data.plannedTime)}`,
        ).getTime() / 60000,
    }))
    .sort((a, b) => a.absolute - b.absolute);
  for (let i = 0; i < allScheduled.length; i++)
    for (let j = i + 1; j < allScheduled.length; j++) {
      const a = allScheduled[i],
        b = allScheduled[j];
      if (b.absolute >= a.absolute + a.duration + a.travel) break;
      warnings.add(
        `${b.m.date}: ${a.m.title} overlaps ${b.m.title} or leaves insufficient travel time.`,
      );
    }
  for (const [date, tasks] of days) {
    const work = tasks.filter((t) => t.data.category === "Employment");
    const total = tasks.reduce(
      (s, t) => s + (Number(t.data.plannedMinutes) || 0),
      0,
    );
    const gym = tasks
      .filter((t) => t.data.category === "Fitness")
      .reduce((s, t) => s + (Number(t.data.plannedMinutes) || 0), 0);
    if (work.length === 0 && total > 480)
      warnings.add(
        `${date}: more than eight planned hours on an off-day; preserve recovery and free time.`,
      );
    if (gym > 90)
      warnings.add(
        `${date}: more than 90 minutes of gym commitments; review recovery.`,
      );
    for (const study of tasks.filter((t) => t.data.category === "Education"))
      if (Number(study.data.plannedMinutes) > 120)
        warnings.add(
          `${date}: ${study.title} exceeds a two-hour study block; consider breaks.`,
        );
    if (
      tasks.some(
        (t) =>
          ["Employment", "Fitness"].includes(String(t.data.category)) &&
          Number(t.data.plannedMinutes) > 60 &&
          !Number(t.data.travelMinutes),
      )
    )
      warnings.add(
        `${date}: confirm travel time for work and gym commitments.`,
      );
  }
  const workDays = [...days]
    .filter(([, tasks]) =>
      tasks.some(
        (t) =>
          t.data.category === "Employment" &&
          Number(t.data.plannedMinutes) >= 480,
      ),
    )
    .map(([d]) => d)
    .sort();
  let streak = 1;
  for (let i = 1; i < workDays.length; i++) {
    streak = addDays(workDays[i - 1], 1) === workDays[i] ? streak + 1 : 1;
    if (streak >= 4)
      warnings.add(
        `${workDays[i]}: four or more consecutive strenuous workdays; check sleep and fatigue.`,
      );
  }
  for (const a of allScheduled.filter(
    (t) => t.m.data.category === "Employment",
  )) {
    const next = allScheduled.find((t) => t.m.date === addDays(a.m.date, 1));
    if (next && next.absolute - (a.absolute + a.duration + a.travel) < 480)
      warnings.add(
        `${next.m.date}: fewer than eight hours between the previous shift and the first commitment; allow sleep and preparation.`,
      );
  }
  return [...warnings];
}
export function previewPlan(plan: WeeklyPlan, records: AppRecord[]) {
  const ids = new Set(records.map((r) => r.id));
  const existing = records.filter(
    (r) =>
      r.kind === "mission" &&
      r.date >= plan.weekStart &&
      r.date <= plan.weekEnd,
  );
  const signature = (m: RecordInput) =>
    JSON.stringify([
      m.date,
      m.title.trim().toLowerCase(),
      m.data.category,
      m.data.scheduledTime ?? m.data.plannedTime ?? "",
      m.data.plannedMinutes ?? 0,
      m.data.target ?? 1,
    ]);
  const signatures = new Set(existing.map(signature));
  const duplicates: RecordInput[] = [];
  const missions: RecordInput[] = [];
  for (const mission of planToMissions(plan)) {
    const key = signature(mission);
    if (ids.has(mission.id!) || signatures.has(key)) duplicates.push(mission);
    else {
      missions.push(mission);
      ids.add(mission.id!);
      signatures.add(key);
    }
  }
  return {
    missions,
    duplicates,
    conflicts: scheduleConflicts([...existing, ...missions]),
  };
}
export function emptyPlan(date: string): WeeklyPlan {
  return {
    schemaVersion: 1,
    weekStart: weekStart(date),
    weekEnd: addDays(weekStart(date), 6),
    goals: [
      "Remain faithful to morning prayer",
      "Complete realistic study commitments",
      "Protect sleep and financial discipline",
    ],
    dailyTasks: [],
    recurringRoutines: [],
    workCommitments: [],
    recoveryRecommendations: [],
    notes: "",
  };
}
export const planningPrompt = (report: string) =>
  `${report}\n\nCreate my next Sunday–Saturday weekly plan as JSON only using schemaVersion 1. Required keys: schemaVersion, weekStart, weekEnd, goals (exactly three strings), dailyTasks, recurringRoutines, workCommitments, recoveryRecommendations, notes. Task: {id (unique letters/numbers/underscore/hyphen),title,category,priority (1 to 3, 3 highest),date (YYYY-MM-DD),plannedMinutes,scheduledTime? (HH:mm),travelMinutes?,target?,notes?,fixed?}. Categories: ${categories.join(", ")}. Routines use days (0 Sunday to 6 Saturday) instead of date. Work commitments use category Employment. Preserve fixed shifts unless I explicitly approve a change. Do not infer completions or invent measurements. Prioritize faith, NREMT education, sustainable warehouse work, sleep, health and financial discipline. Leave recovery time, avoid automatic carry-forward, and explain adjustments in notes. Never award rank for earnings or workload.`;
