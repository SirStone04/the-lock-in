import { describe, expect, it } from "vitest";
import type { AppRecord, RecordInput } from "../domain/models";
import { buildWeeklyReport } from "../domain/reports";

const record = (input: RecordInput): AppRecord => ({
  ...input,
  id: input.id ?? crypto.randomUUID(),
  revision: input.revision ?? 1,
  createdAt: `${input.date}T12:00:00Z`,
  updatedAt: `${input.date}T12:00:00Z`,
});

describe("weekly report shared-record integrity", () => {
  it("counts routine adherence once per calendar day while summing actual session quantities", () => {
    const rows: AppRecord[] = [];
    for (const date of ["2026-11-01", "2026-11-01", "2026-11-02"]) {
      rows.push(
        record({
          kind: "faith",
          date,
          title: "Prayer",
          data: { prayer: true, scripture: true, church: true, duration: 10 },
        }),
        record({
          kind: "nutrition",
          date,
          title: "Meals",
          data: {
            breakfast: true,
            lunch: true,
            dinner: true,
            snack: true,
            water: 16,
          },
        }),
        record({
          kind: "skincare",
          date,
          title: "Routine",
          data: { am: true, pm: true },
        }),
      );
    }
    const report = buildWeeklyReport(rows, "2026-11-01");
    expect(report.metrics.routineDays).toEqual({
      prayer: 2,
      scripture: 2,
      church: 2,
      breakfast: 2,
      lunch: 2,
      dinner: 2,
      snack: 2,
      skincareAM: 2,
      skincarePM: 2,
    });
    expect(report.markdown).toContain(
      "Prayer days: 2; Scripture days: 2; church days: 2",
    );
    expect(report.markdown).toContain("30 recorded minutes");
    expect(report.markdown).toContain("Hydration: 48 oz across 3 entries");
  });

  it("keeps unmatched check-in work/study as context without adding to dedicated totals", () => {
    const rows = [
      record({
        id: "daily-one",
        kind: "daily",
        date: "2026-11-01",
        title: "Check-in",
        data: {
          workHours: 9,
          incentiveHours: 6,
          educationMinutes: 40,
          win: "Kept my commitment",
        },
      }),
      record({
        id: "daily-two",
        kind: "daily",
        date: "2026-11-02",
        title: "Check-in",
        data: { workHours: 10, incentiveHours: 6, educationMinutes: 60 },
      }),
      record({
        id: "shift",
        kind: "shift",
        date: "2026-11-02",
        title: "Warehouse",
        data: { paidHours: 10, baseRate: 20 },
      }),
      record({
        id: "study",
        kind: "study",
        date: "2026-11-02",
        title: "NREMT",
        data: { duration: 60 },
      }),
    ];
    const report = buildWeeklyReport(rows, "2026-11-01");
    expect(report.metrics.paidHours).toBe(10);
    expect(report.metrics.studyMinutes).toBe(60);
    expect(report.metrics.estimatedGross).toBe(200);
    expect(report.metrics.selfReportedContext).toEqual({
      workHours: 9,
      incentiveHours: 6,
      studyMinutes: 40,
      workDates: ["2026-11-01"],
      studyDates: ["2026-11-01"],
    });
    expect(report.markdown).toContain(
      "excluded from paid-hour and wage totals",
    );
    expect(report.markdown).toContain("excluded from study-session totals");
    expect(report.markdown).toContain("Kept my commitment");
  });

  it("uses the latest check-in summary when older separate IDs exist for the same day", () => {
    const older = record({
      id: "old-summary",
      kind: "daily",
      date: "2026-11-01",
      title: "Old",
      data: { workHours: 4, educationMinutes: 20 },
    });
    const newer = {
      ...record({
        id: "new-summary",
        kind: "daily",
        date: "2026-11-01",
        title: "Corrected",
        data: { workHours: 6, educationMinutes: 30 },
      }),
      updatedAt: "2026-11-01T18:00:00Z",
    };
    expect(
      buildWeeklyReport([newer, older], "2026-11-01").metrics
        .selfReportedContext,
    ).toEqual({
      workHours: 6,
      incentiveHours: 0,
      studyMinutes: 30,
      workDates: ["2026-11-01"],
      studyDates: ["2026-11-01"],
    });
  });
});
