import { describe, it, expect } from "vitest";
import { dueReminders } from "../domain/reminders";
describe("foreground reminders", () => {
  it("honors configured times and does not replay missed reminders hours later", () => {
    expect(
      dueReminders([], "2026-11-02", "08:35").some((r) =>
        r.id.startsWith("morning"),
      ),
    ).toBe(true);
    expect(dueReminders([], "2026-11-02", "12:00")).toEqual([]);
    expect(
      dueReminders([], "2026-11-02", "07:15", { morningReminder: "07:10" })
        .length,
    ).toBe(1);
    expect(
      dueReminders([], "2026-11-02", "08:35", { reminders: false }),
    ).toEqual([]);
  });
  it("offers Saturday preliminary review and Sunday planning only in their windows", () => {
    expect(dueReminders([], "2026-11-07", "21:05")[0].route).toBe("reports");
    expect(dueReminders([], "2026-11-08", "09:01")[0].route).toBe("planner");
    expect(dueReminders([], "2026-11-06", "21:05")).toEqual([]);
  });
});
