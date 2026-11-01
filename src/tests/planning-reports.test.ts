import { describe, expect, it } from "vitest";
import {
  emptyPlan,
  planToMissions,
  previewPlan,
  scheduleConflicts,
  validatePlan,
} from "../domain/planning";
import { buildWeeklyReport } from "../domain/reports";
import type { AppRecord, RecordInput } from "../domain/models";

const record = (input: RecordInput): AppRecord => ({
  ...input,
  id: input.id ?? "record",
  revision: input.revision ?? 1,
  createdAt: `${input.date}T12:00:00Z`,
  updatedAt: `${input.date}T12:00:00Z`,
});
const task = {
  id: "study",
  date: "2026-11-03",
  title: "Airway remediation",
  category: "Education" as const,
  priority: 1,
  plannedMinutes: 75,
  scheduledTime: "09:30",
};

describe("versioned weekly planning", () => {
  it("validates a real Sunday-to-Saturday week", () => {
    const plan = emptyPlan("2026-11-03");
    expect(plan.weekStart).toBe("2026-11-01");
    expect(plan.weekEnd).toBe("2026-11-07");
    expect(validatePlan(JSON.stringify(plan))).toEqual(plan);
  });
  it("rejects impossible calendar dates, wrong week boundaries and unknown categories", () => {
    expect(() =>
      validatePlan({ ...emptyPlan("2026-11-01"), weekStart: "2026-02-31" }),
    ).toThrow();
    expect(() =>
      validatePlan({ ...emptyPlan("2026-11-01"), weekEnd: "2026-11-08" }),
    ).toThrow();
    expect(() =>
      validatePlan({
        ...emptyPlan("2026-11-01"),
        dailyTasks: [{ ...task, category: "Salary" }],
      }),
    ).toThrow();
  });
  it("rejects duplicate IDs and outside-week tasks before saving", () => {
    expect(() =>
      validatePlan({ ...emptyPlan("2026-11-01"), dailyTasks: [task, task] }),
    ).toThrow();
    expect(() =>
      validatePlan({
        ...emptyPlan("2026-11-01"),
        dailyTasks: [{ ...task, date: "2026-11-09" }],
      }),
    ).toThrow();
  });
  it("generates stable recurring records and skips repeated imports without erasing progress", () => {
    const plan = validatePlan({
      ...emptyPlan("2026-11-01"),
      dailyTasks: [task],
      recurringRoutines: [
        {
          id: "prayer",
          title: "Prayer",
          category: "Faith",
          priority: 1,
          plannedMinutes: 15,
          days: [0, 1, 2, 3, 4, 5, 6],
        },
      ],
    });
    const first = planToMissions(plan);
    expect(first).toHaveLength(8);
    expect(new Set(first.map((m) => m.id)).size).toBe(8);
    const saved = first.map((r) =>
      record({ ...r, data: { ...r.data, status: "completed", actual: 1 } }),
    );
    const second = previewPlan(plan, saved);
    expect(second.missions).toHaveLength(0);
    expect(second.duplicates).toHaveLength(8);
    expect(saved.every((r) => r.data.status === "completed")).toBe(true);
  });
  it("detects overlapping commitments, missing travel and excessive workload", () => {
    const records: RecordInput[] = [
      {
        kind: "mission",
        date: "2026-11-03",
        title: "Gym",
        data: {
          category: "Fitness",
          scheduledTime: "10:00",
          plannedMinutes: 120,
        },
      },
      {
        kind: "mission",
        date: "2026-11-03",
        title: "Study",
        data: {
          category: "Education",
          scheduledTime: "11:00",
          plannedMinutes: 400,
        },
      },
    ];
    const warnings = scheduleConflicts(records).join(" ");
    expect(warnings).toMatch(/overlaps/);
    expect(warnings).toMatch(/travel/);
    expect(warnings).toMatch(/eight planned hours/);
    expect(warnings).toMatch(/90 minutes/);
  });
  it("detects commitments crossing midnight", () => {
    const warnings = scheduleConflicts([
      {
        kind: "mission",
        date: "2026-11-02",
        title: "Late shift",
        data: {
          category: "Employment",
          scheduledTime: "16:00",
          plannedMinutes: 660,
          travelMinutes: 30,
        },
      },
      {
        kind: "mission",
        date: "2026-11-03",
        title: "Early prayer",
        data: { category: "Faith", scheduledTime: "07:00", plannedMinutes: 15 },
      },
    ]);
    expect(warnings.join(" ")).toMatch(/fewer than eight hours/);
  });
  it("skips identical missions even if an exported plan uses different source IDs", () => {
    const plan = validatePlan({
      ...emptyPlan("2026-11-01"),
      dailyTasks: [task],
    });
    const saved = planToMissions(plan).map(record);
    const renamed = {
      ...plan,
      dailyTasks: [{ ...task, id: "renamed-exported-id" }],
    };
    expect(previewPlan(renamed, saved).missions).toHaveLength(0);
    expect(previewPlan(renamed, saved).duplicates).toHaveLength(1);
  });
  it("uses Eastern elapsed time across daylight saving when checking sleep opportunities", () => {
    const warnings = scheduleConflicts([
      {
        kind: "mission",
        date: "2027-03-13",
        title: "Saturday shift",
        data: {
          category: "Employment",
          scheduledTime: "18:00",
          plannedMinutes: 360,
          travelMinutes: 0,
        },
      },
      {
        kind: "mission",
        date: "2027-03-14",
        title: "Sunday church",
        data: { category: "Faith", scheduledTime: "08:30", plannedMinutes: 60 },
      },
    ]);
    expect(warnings.join(" ")).toMatch(/fewer than eight hours/);
  });
});
describe("weekly reports from actual records", () => {
  it("separates estimated wages, deposited income and transfers", () => {
    const records = [
      record({
        id: "shift",
        kind: "shift",
        date: "2026-11-02",
        title: "Warehouse",
        data: { paidHours: 10, baseRate: 20 },
      }),
      record({
        id: "income",
        kind: "transaction",
        date: "2026-11-06",
        title: "Paycheck",
        data: { type: "income", category: "Paycheck", amount: 800 },
      }),
      record({
        id: "expense",
        kind: "transaction",
        date: "2026-11-03",
        title: "Groceries",
        data: { type: "expense", category: "Groceries", amount: 55 },
      }),
      record({
        id: "transfer",
        kind: "transaction",
        date: "2026-11-03",
        title: "Savings",
        data: { type: "transfer", amount: 100, savings: true },
      }),
    ];
    const report = buildWeeklyReport(records, "2026-11-01");
    expect(report.metrics.incomeReceived).toBe(800);
    expect(report.metrics.spending).toBe(55);
    expect(report.metrics.netCashFlow).toBe(745);
    expect(report.metrics.estimatedGross).toBe(200);
    expect(report.markdown).toContain("$100.00 (excluded from spending)");
  });
  it("deduplicates source records by stable ID and keeps the latest revision", () => {
    const original = record({
      id: "income",
      kind: "transaction",
      date: "2026-11-03",
      title: "Deposit",
      data: { type: "income", amount: 100 },
    });
    const correction = {
      ...original,
      revision: 2,
      data: { type: "income", amount: 125 },
    };
    const report = buildWeeklyReport([original, correction], "2026-11-01");
    expect(report.metrics.incomeReceived).toBe(125);
  });
  it("normalizes completion statuses and reports actual workout sets", () => {
    const report = buildWeeklyReport(
      [
        record({
          id: "workout",
          kind: "workout",
          date: "2026-11-03",
          title: "Full Body A",
          data: { status: "completed" },
        }),
        record({
          id: "set",
          kind: "exerciseSet",
          date: "2026-11-03",
          title: "Chest Press",
          data: {
            exercise: "Chest Press",
            weight: 50,
            reps: 10,
            completed: true,
          },
        }),
      ],
      "2026-11-01",
    );
    expect(report.metrics.workoutsCompleted).toBe(1);
    expect(report.metrics.trainingVolume).toBe(500);
  });
  it("labels missing information without fabricating accomplishments", () => {
    const report = buildWeeklyReport([], "2026-11-01");
    expect(report.metrics.consistency).toBeNull();
    expect(report.metrics.averageSleep).toBeNull();
    expect(report.metrics.workoutsCompleted).toBe(0);
    expect(report.markdown).toContain("Not logged");
    expect(report.markdown).toContain("No weekly goals recorded");
    expect(report.markdown).toContain("No improvement is inferred");
    expect(() => JSON.parse(JSON.stringify(report))).not.toThrow();
  });
  it("includes report notes and historical source boundaries", () => {
    const report = buildWeeklyReport(
      [
        record({
          kind: "transaction",
          date: "2026-11-08",
          title: "Next week",
          data: { type: "income", amount: 500 },
        }),
      ],
      "2026-11-01",
      "Long shift affected recovery",
      "final",
    );
    expect(report.metrics.incomeReceived).toBe(0);
    expect(report.markdown).toContain("Long shift affected recovery");
    expect(report.status).toBe("final");
  });
  it("uses historical fresh mixed assessments for readiness and includes overdue bills entered earlier", () => {
    const records = [
      record({
        id: "test1",
        kind: "assessment",
        date: "2026-10-25",
        title: "Fresh mixed 1",
        data: { questions: 100, correct: 87, fresh: true, mixed: true },
      }),
      record({
        id: "test2",
        kind: "assessment",
        date: "2026-10-28",
        title: "Fresh mixed 2",
        data: { questions: 100, correct: 89, fresh: true, mixed: true },
      }),
      record({
        id: "test3",
        kind: "assessment",
        date: "2026-11-01",
        title: "Fresh mixed 3",
        data: { questions: 100, correct: 90, fresh: true, mixed: true },
      }),
      record({
        id: "bill",
        kind: "bill",
        date: "2026-10-01",
        title: "Phone",
        data: { dueDate: "2026-11-04", amount: 50, paid: false },
      }),
    ];
    const report = buildWeeklyReport(records, "2026-11-01");
    expect(report.markdown).toContain(
      "Three most recent logged fresh assessments are at least 85%",
    );
    expect(report.markdown).toContain("Phone: $50.00, due 2026-11-04");
  });
});
