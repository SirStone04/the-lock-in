import { describe, expect, it } from "vitest";
import {
  previewRoutines,
  routineDays,
  validateRoutine,
} from "../domain/routines";
import type { AppRecord, Data } from "../domain/models";
const makeRoutine = (data: Data): AppRecord => ({
  id: "faith-routine",
  kind: "routine",
  date: "2026-11-01",
  title: "Morning faith",
  createdAt: "2026-11-01T12:00:00Z",
  updatedAt: "2026-11-01T12:00:00Z",
  revision: 1,
  data: {
    category: "Faith",
    priority: 3,
    plannedMinutes: 15,
    enabled: true,
    frequency: "Daily",
    ...data,
  },
});
describe("manual recurring routines", () => {
  it("generates daily missions once with stable IDs and preserves saved progress", () => {
    const routine = makeRoutine({});
    const first = previewRoutines([routine], "2026-11-01", "2026-11-01");
    expect(first.missions).toHaveLength(7);
    expect(first.missions[0].id).toBe("routine-faith-routine-2026-11-01");
    const saved = first.missions.map((m) => ({
      ...m,
      id: m.id!,
      createdAt: "2026-11-01T12:00:00Z",
      updatedAt: "2026-11-01T12:00:00Z",
      revision: 1,
      data: { ...m.data, status: "completed", actual: 1 },
    }));
    const again = previewRoutines(
      [routine, ...saved],
      "2026-11-01",
      "2026-11-01",
    );
    expect(again.missions).toHaveLength(0);
    expect(again.duplicates).toBe(7);
    expect(saved[0].data.status).toBe("completed");
  });
  it("handles selected weekly/custom days, disabled templates, and skips past dates", () => {
    const routine = makeRoutine({
      frequency: "Weekly / custom",
      days: "0, 2,3",
    });
    const preview = previewRoutines(
      [routine, makeRoutine({ enabled: false })],
      "2026-11-01",
      "2026-11-03",
    );
    expect(preview.missions.map((m) => m.date)).toEqual([
      "2026-11-03",
      "2026-11-04",
    ]);
    expect(preview.pastDates).toBe(1);
    expect(preview.routineCount).toBe(1);
  });
  it("rejects invalid custom weekdays and impossible durations", () => {
    expect(() => routineDays({ days: "2,2" })).toThrow();
    expect(() => routineDays({ days: "7" })).toThrow();
    expect(() => routineDays({ days: "2.5" })).toThrow();
    expect(validateRoutine(makeRoutine({ plannedMinutes: 0 }).data)).toMatch(
      /Planned minutes/,
    );
    expect(
      previewRoutines(
        [makeRoutine({ frequency: "Weekly / custom", days: "oops" })],
        "2026-11-01",
        "2026-11-01",
      ).issues,
    ).toHaveLength(1);
  });
  it("previews conflicts with existing commitments before writes", () => {
    const routine = makeRoutine({ scheduledTime: "12:00", plannedMinutes: 45 });
    const work: AppRecord = {
      ...routine,
      id: "shift-plan",
      kind: "mission",
      title: "Fixed warehouse shift",
      data: {
        category: "Employment",
        scheduledTime: "12:00",
        plannedMinutes: 600,
        fixed: true,
      },
    };
    expect(
      previewRoutines(
        [routine, work],
        "2026-11-01",
        "2026-11-01",
      ).conflicts.join(" "),
    ).toContain("overlaps");
  });
});
