import { describe, it, expect } from "vitest";
import { progressAudit, progressSourceSignature } from "../domain/audit";
import type { AppRecord, Data, Kind } from "../domain/models";
const record = (id: string, kind: Kind, data: Data): AppRecord => ({
  id,
  kind,
  data,
  title: id,
  date: "2026-11-01",
  createdAt: "2026-11-01T12:00:00Z",
  updatedAt: "2026-11-01T12:00:00Z",
  revision: 1,
});
describe("auditable progress projection", () => {
  it("replaces an edited daily award and clears removed source awards", () => {
    const mission = record("mission", "mission", {
      category: "Recovery",
      status: "completed",
    });
    const award = progressAudit([mission], "2026-11-01")[0];
    expect(award.data.points).toBe(80);
    const stored = record("xp-2026-11-01", "xp", award.data);
    expect(progressAudit([mission, stored], "2026-11-01")).toEqual([]);
    expect(
      progressAudit(
        [
          {
            ...mission,
            revision: 2,
            data: { ...mission.data, status: "skipped" },
          },
          stored,
        ],
        "2026-11-01",
      )[0].data.points,
    ).toBe(0);
    expect(progressAudit([stored], "2026-11-01")[0].data.reason).toBe(
      "Source records removed",
    );
  });
  it("does not trigger new audit passes from its own XP records", () => {
    const daily = record("daily", "daily", { checkInCompleted: true });
    expect(progressSourceSignature([daily])).toBe(
      progressSourceSignature([daily, record("xp", "xp", { points: 10 })]),
    );
    expect(progressSourceSignature([{ ...daily, revision: 2 }])).not.toBe(
      progressSourceSignature([daily]),
    );
  });
});
