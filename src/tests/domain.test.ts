import { describe, expect, it } from "vitest";
import {
  addDays,
  dateTimeHours,
  today,
  validDate,
  weekDates,
  weekEnd,
  weekStart,
} from "../domain/dates";
import {
  accountBalance,
  accuracy,
  estimatePay,
  financialTotals,
  shiftHours,
  trainingVolume,
} from "../domain/calculations";
import {
  getAchievements,
  getRank,
  rankForXP,
  RANKS,
  scoreDay,
} from "../domain/rank";
import { baselineRecords, initialPlan } from "../domain/seed";
import { detectConflicts, tomorrowBriefing } from "../domain/recommendations";
import type { AppRecord, Data, Kind } from "../domain/models";
const record = (
  id: string,
  kind: Kind,
  date = "2026-11-01",
  data: Data = {},
  revision = 1,
): AppRecord => ({
  id,
  kind,
  date,
  title: id,
  data,
  revision,
  createdAt: `${date}T12:00:00Z`,
  updatedAt: `${date}T12:00:00Z`,
});
const mission = (id: string, date = "2026-11-01", data: Data = {}): AppRecord =>
  record(id, "mission", date, {
    category: "Faith",
    status: "completed",
    priority: 3,
    plannedMinutes: 15,
    ...data,
  });
function days(count: number): AppRecord[] {
  return Array.from({ length: count }, (_, i) => {
    const date = addDays("2026-11-01", i);
    return [
      mission(`mission-${i}`, date),
      record(`daily-${i}`, "daily", date, {
        checkInCompleted: true,
        reflection: "An honest reflection.",
      }),
    ];
  }).flat();
}

describe("Eastern calendar and daylight saving time", () => {
  it("computes dates in Eastern time rather than UTC", () => {
    expect(today(new Date("2026-11-02T02:00:00Z"))).toBe("2026-11-01");
  });
  it("uses Sunday to Saturday and survives year boundaries", () => {
    expect(weekStart("2027-01-01")).toBe("2026-12-27");
    expect(weekEnd("2027-01-01")).toBe("2027-01-02");
    expect(weekDates("2026-11-04")).toHaveLength(7);
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(validDate("2027-02-29")).toBe(false);
  });
  it("handles Eastern spring-forward and fall-back elapsed time", () => {
    expect(dateTimeHours("2026-03-08T00:00", "2026-03-08T08:00")).toBe(7);
    expect(dateTimeHours("2026-11-01T00:00", "2026-11-01T08:00")).toBe(9);
  });
  it("rejects negative durations", () =>
    expect(() =>
      dateTimeHours("2026-11-01T12:00", "2026-11-01T08:00"),
    ).toThrow());
});
describe("complete consistency ranking", () => {
  it("starts at Recruit III with an empty auditable ledger", () => {
    expect(getRank([], "2026-11-01")).toMatchObject({
      index: 0,
      name: "Recruit",
      division: "III",
      xp: 0,
      ledger: [],
      qualified: false,
    });
  });
  it("contains every exact division and increasing integer threshold", () => {
    expect(RANKS).toHaveLength(24);
    for (let i = 0; i < 8; i++) {
      expect(RANKS.slice(i * 3, i * 3 + 3).map((r) => r.division)).toEqual([
        "III",
        "II",
        "I",
      ]);
    }
    expect(RANKS.map((r) => r.threshold)).toEqual(
      Array.from({ length: 24 }, (_, k) => 500 * k + 45 * k * k),
    );
    expect(rankForXP(545)).toMatchObject({ name: "Recruit", division: "II" });
    expect(rankForXP(1180)).toMatchObject({ name: "Recruit", division: "I" });
    expect(rankForXP(1905)).toMatchObject({ name: "Rookie", division: "III" });
    expect(rankForXP(1e9)).toMatchObject({ name: "Legendary", division: "I" });
  });
  it("promotes through III -> II -> I -> next III", () => {
    expect(getRank(days(6), "2026-11-06")).toMatchObject({
      name: "Recruit",
      division: "II",
    });
    expect(getRank(days(12), "2026-11-12")).toMatchObject({
      name: "Recruit",
      division: "I",
    });
    expect(getRank(days(20), "2026-11-20")).toMatchObject({
      name: "Rookie",
      division: "III",
    });
    expect(getRank(days(400), "2027-12-05")).toMatchObject({
      name: "Legendary",
      division: "I",
    });
  });
  it("gates promotions on consistency with an explicit onboarding rule", () => {
    const records = days(6);
    for (const r of records.filter((r) => r.kind === "daily")) r.data = {};
    expect(getRank(records, "2026-11-06").qualified).toBe(true);
    const poor = days(40);
    for (const r of poor.filter((r) => r.kind === "mission"))
      r.data.status = "skipped";
    expect(getRank(poor, "2026-12-10")).toMatchObject({
      index: 0,
      qualified: false,
    });
  });
  it("does not duplicate XP for duplicate records or edits", () => {
    const records = days(2);
    expect(getRank([...records, ...records], "2026-11-02").xp).toBe(200);
    const edit = {
      ...records[0],
      revision: 2,
      data: { ...records[0].data, status: "skipped" },
    };
    const rank = getRank([...records, edit], "2026-11-02");
    expect(rank.xp).toBe(120);
    expect(rank.ledger).toHaveLength(2);
    expect(rank.ledger[0].id).toBe("xp-2026-11-01");
  });
  it("normalizes recovery commitments and rejects extra work as bonus XP", () => {
    const recovery = [
      mission("rest", "2026-11-01", { category: "Recovery" }),
      record("d", "daily", "2026-11-01", {
        checkInCompleted: true,
        reflection: "Rested.",
      }),
    ];
    expect(scoreDay("2026-11-01", recovery).points).toBe(100);
    expect(
      scoreDay("2026-11-01", [
        ...recovery,
        record("shift", "shift", "2026-11-01", { paidHours: 15 }),
      ]).points,
    ).toBe(100);
  });
  it("gives partial credit only for measured actual progress", () => {
    expect(
      scoreDay("2026-11-01", [
        mission("partial", "2026-11-01", {
          status: "partially completed",
          plannedMinutes: 90,
          actualMinutes: 45,
        }),
      ]).missionPoints,
    ).toBe(40);
    expect(
      scoreDay("2026-11-01", [
        mission("partial", "2026-11-01", { status: "partially completed" }),
      ]).missionPoints,
    ).toBe(0);
  });
  it("credits duration when imported default quantity is still zero and caps either measure", () => {
    const imported = mission("imported", "2026-11-01", {
      category: "Education",
      status: "partial",
      target: 1,
      actual: 0,
      plannedMinutes: 90,
      actualMinutes: 45,
    });
    expect(scoreDay("2026-11-01", [imported]).missionPoints).toBe(40);
    const quantity = mission("quantity", "2026-11-01", {
      status: "partial",
      target: 5,
      targetUnit: "chapters",
      actual: 2,
      plannedMinutes: 60,
      actualMinutes: 20,
    });
    expect(scoreDay("2026-11-01", [quantity]).missionPoints).toBe(32);
    quantity.data.actual = 20;
    quantity.data.actualMinutes = 120;
    expect(scoreDay("2026-11-01", [quantity]).missionPoints).toBe(80);
  });
  it("keeps many trivial tasks from overwhelming a meaningful category", () => {
    const tasks = [
      mission("faith", "2026-11-01", { status: "skipped" }),
      ...Array.from({ length: 30 }, (_, i) =>
        mission(`skin-${i}`, "2026-11-01", {
          category: "Skincare",
          priority: 1,
        }),
      ),
    ];
    expect(scoreDay("2026-11-01", tasks).missionPoints).toBe(13);
  });
  it("does not automatically grant full adherence for empty or excused plans", () => {
    expect(scoreDay("2026-11-01", [])).toMatchObject({
      points: 0,
      eligible: false,
    });
    expect(
      scoreDay("2026-11-01", [
        mission("excused", "2026-11-01", { status: "excused" }),
      ]).points,
    ).toBe(0);
    expect(
      scoreDay("2026-11-01", [
        record("daily", "daily", "2026-11-01", {
          checkInCompleted: true,
          reflection: "No plan today.",
        }),
      ]).points,
    ).toBe(20);
  });
  it("excludes unselected optional commitments and future/late-added mission farming", () => {
    expect(
      scoreDay("2026-11-01", [
        mission("optional", "2026-11-01", { optional: true, included: false }),
      ]).points,
    ).toBe(0);
    expect(getRank(days(20), "2026-11-01").xp).toBe(100);
    const late = mission("late");
    late.createdAt = "2026-11-02T15:00:00Z";
    expect(scoreDay("2026-11-01", [late]).missionPoints).toBe(0);
  });
  it("retains a verified earned-rank history through difficult weeks", () => {
    expect(
      getRank(
        [
          record("promotion", "rankHistory", "2026-11-01", {
            index: 4,
            xp: 3000,
          }),
        ],
        "2026-11-28",
      ).index,
    ).toBe(4);
  });
  it("preserves original promotion history after corrected scores without adding XP", () => {
    const corrected = days(6).map((r) =>
      r.kind === "mission"
        ? { ...r, revision: 2, data: { ...r.data, status: "skipped" } }
        : r,
    );
    const saved = record("promotion-1", "rankHistory", "2026-11-06", {
      index: 1,
      xp: 600,
    });
    const result = getRank([...corrected, saved], "2026-11-28");
    expect(result).toMatchObject({
      index: 1,
      name: "Recruit",
      division: "II",
      xp: 120,
    });
    expect(result.history).toEqual([
      {
        index: 1,
        name: "Recruit",
        division: "II",
        date: "2026-11-06",
        xp: 600,
      },
    ]);
    expect(result.ledger.reduce((total, row) => total + row.points, 0)).toBe(
      120,
    );
  });
  it("deduplicates derived and retained promotions using original dates and sorts chronologically", () => {
    const original = record("promotion-1", "rankHistory", "2026-11-05", {
      index: 1,
      xp: 550,
    });
    const duplicate = record(
      "old-promotion-copy",
      "rankHistory",
      "2026-11-06",
      { index: 1, xp: 600 },
    );
    const second = record("promotion-2", "rankHistory", "2026-11-12", {
      index: 2,
      xp: 1200,
    });
    const invalid = record("invalid-promotion", "rankHistory", "2026-11-01", {
      index: 23,
      xp: 5,
    });
    const result = getRank(
      [...days(12), second, duplicate, original, invalid],
      "2026-11-12",
    );
    expect(result.xp).toBe(1200);
    expect(result.history).toEqual([
      {
        index: 1,
        name: "Recruit",
        division: "II",
        date: "2026-11-05",
        xp: 550,
      },
      {
        index: 2,
        name: "Recruit",
        division: "I",
        date: "2026-11-12",
        xp: 1200,
      },
    ]);
  });
  it("uses Eastern dates for evening mission creation and limits late check-in XP", () => {
    const evening = mission("evening");
    evening.createdAt = "2026-11-02T02:00:00Z";
    expect(scoreDay("2026-11-01", [evening]).missionPoints).toBe(80);
    const late = record("late-daily", "daily", "2026-11-01", {
      checkInCompleted: true,
      reflection: "Late reflection.",
    });
    late.createdAt = "2026-11-09T15:00:00Z";
    expect(scoreDay("2026-11-01", [late]).points).toBe(0);
    expect(
      scoreDay("2026-11-01", [
        record("partial-close", "daily", "2026-11-01", { closed: true }),
      ]).points,
    ).toBe(0);
  });
  it("does not award career achievements as rank XP", () => {
    expect(
      getRank(
        [record("rn", "milestone", "2026-11-01", { completed: true })],
        "2026-11-01",
      ).xp,
    ).toBe(0);
    expect(getAchievements([]).every((a) => !a.earned)).toBe(true);
  });
});
describe("work and incentive estimates", () => {
  it("calculates overnight paid hours excluding unpaid breaks", () => {
    expect(
      shiftHours({
        clockIn: "2026-11-02T16:00",
        clockOut: "2026-11-03T03:00",
        breakMinutes: 60,
      }),
    ).toBe(10);
  });
  it("rejects impossible task, break, overtime and premium hours", () => {
    expect(() =>
      shiftHours({ paidHours: 10, palletHours: 8, highLiftHours: 4 }),
    ).toThrow();
    expect(() =>
      shiftHours({
        clockIn: "2026-11-02T12:00",
        clockOut: "2026-11-02T13:00",
        breakMinutes: 90,
      }),
    ).toThrow();
    expect(() => estimatePay({ paidHours: 10, overtimeHours: 12 })).toThrow();
    expect(() => estimatePay({ paidHours: 10, nightHours: 11 })).toThrow();
  });
  it("applies premiums only to eligible hours and distinguishes estimates", () => {
    const pay = estimatePay({
      paidHours: 10,
      baseRate: 20,
      palletHours: 6,
      incentiveRate: 5,
      freezerHours: 6,
      freezerRate: 2,
      nightHours: 2,
      nightRate: 1,
      overtimeHours: 2,
    });
    expect(pay).toMatchObject({
      standardHours: 8,
      overtimeHours: 2,
      base: 220,
      premiums: 14,
      incentive: 30,
      gross: 264,
      isEstimate: true,
      incentiveVerified: false,
    });
  });
  it("lets verified payroll incentive override the estimate including zero", () => {
    expect(
      estimatePay({
        paidHours: 10,
        palletHours: 6,
        incentiveRate: 5,
        actualIncentive: 0,
      }).incentive,
    ).toBe(0);
  });
  it("does not infer private pay rates when no configuration was entered", () => {
    const pay = estimatePay({ paidHours: 8, freezerHours: 4, nightHours: 2 });
    expect(pay.gross).toBe(0);
    expect(pay.warnings).toContain(
      "Base pay rate is not entered; estimated gross excludes base wages.",
    );
    expect(pay.warnings).toContain(
      "Freezer premium rate is not entered; no freezer premium was assumed.",
    );
    expect(pay.warnings).toContain(
      "Night premium rate is not entered; no night premium was assumed.",
    );
  });
});
describe("financial truth and duplicate prevention", () => {
  const tx = (id: string, type: string, amount: number, category = "Other") =>
    record(id, "transaction", "2026-11-01", { type, amount, category });
  it("counts actual deposited income once and excludes wages and transfers from cash flow", () => {
    const records = [
      tx("pay", "income", 800),
      tx("food", "expense", 50, "Groceries"),
      tx("save", "transfer", 100, "Savings"),
      record("shift", "shift", "2026-11-01", { estimatedGross: 1000 }),
      record("payroll", "payroll", "2026-11-01", { net: 800 }),
    ];
    const totals = financialTotals([...records, ...records]);
    expect(totals).toMatchObject({
      income: 800,
      spending: 50,
      transfers: 100,
      savings: 100,
      netCashFlow: 750,
      availableCash: null,
    });
  });
  it("counts family remittances, debt payments and refunds consistently", () => {
    const totals = financialTotals([
      tx("pay", "income", 800),
      tx("family", "remittance", 100, "Family support"),
      tx("debt", "debt", 70, "Debt payments"),
      tx("refund", "refund", 20),
    ]);
    expect(totals).toMatchObject({
      income: 800,
      spending: 170,
      remittances: 100,
      debtPayments: 70,
      refunds: 20,
      netCashFlow: 650,
    });
    expect(totals.byCategory).toEqual({
      "Family support": 100,
      "Debt payments": 70,
    });
  });
  it("moves reconciled account snapshots only for subsequent assigned transactions", () => {
    const account = record("cash", "account", "2026-11-01", {
      reconciled: true,
      reconciledBalance: 100,
      reconciledThrough: "2026-11-01",
    });
    const old = tx("old", "expense", 50);
    old.data.fromAccount = "cash";
    const income = {
      ...tx("income", "income", 80),
      date: "2026-11-02",
      data: { type: "income", amount: 80, toAccount: "cash" },
    };
    const transfer = {
      ...tx("move", "transfer", 20),
      date: "2026-11-03",
      data: {
        type: "transfer",
        amount: 20,
        fromAccount: "cash",
        toAccount: "save",
      },
    };
    expect(accountBalance(account, [old, income, transfer], "2026-11-03")).toBe(
      160,
    );
    expect(
      accountBalance(account, [old, income, transfer], "2026-10-31"),
    ).toBeNull();
    expect(
      financialTotals(
        [account, old, income, transfer],
        "2026-11-01",
        "2026-11-02",
      ).availableCash,
    ).toBe(180);
  });
  it("withholds available cash when a new transaction has no account assignment", () => {
    const account = record("cash", "account", "2026-11-01", {
      reconciled: true,
      reconciledBalance: 100,
      reconciledThrough: "2026-11-01",
    });
    const orphan = { ...tx("orphan", "expense", 20), date: "2026-11-02" };
    expect(
      financialTotals([account, orphan], "2026-11-01", "2026-11-03")
        .availableCash,
    ).toBeNull();
  });
  it("requires explicit reconciled balances and respects date filters", () => {
    expect(
      financialTotals([
        record("account", "account", "2026-11-01", {
          balance: 400,
          reconciled: true,
        }),
      ]).availableCash,
    ).toBe(400);
    expect(
      financialTotals(
        [
          tx("old", "income", 40),
          { ...tx("new", "income", 60), date: "2026-11-08" },
        ],
        "2026-11-08",
        "2026-11-14",
      ).income,
    ).toBe(60);
  });
});
describe("safe planning and local coaching", () => {
  it("creates stable weekly IDs without invented completions or fixed employment", () => {
    const a = initialPlan("2026-11-01"),
      b = initialPlan("2026-11-04");
    expect(a.map((r) => r.id)).toEqual(b.map((r) => r.id));
    expect(new Set(a.map((r) => r.id)).size).toBe(a.length);
    expect(
      a
        .filter((r) => r.kind === "mission")
        .every((r) => r.data.status === "not-started"),
    ).toBe(true);
    expect(
      a
        .filter((r) => r.kind === "mission")
        .every(
          (r) =>
            typeof r.data.scheduledTime === "string" &&
            r.data.plannedTime === undefined,
        ),
    ).toBe(true);
    expect(
      a.some((r) => r.kind === "mission" && r.data.category === "Employment"),
    ).toBe(false);
    expect(baselineRecords().some((r) => r.kind === "transaction")).toBe(false);
  });
  it("detects overlapping commitments including travel and late study", () => {
    const missions = [
      mission("study", "2026-11-01", {
        category: "Education",
        scheduledTime: "23:30",
        plannedMinutes: 60,
      }),
      mission("work", "2026-11-01", {
        category: "Employment",
        scheduledTime: "23:00",
        plannedMinutes: 90,
      }),
    ];
    expect(detectConflicts(missions).join(" ")).toMatch(/overlaps/);
    expect(detectConflicts(missions).join(" ")).toMatch(/sleep window/);
  });
  it("reduces optional activity after low sleep or high fatigue and explains why", () => {
    const result = tomorrowBriefing(
      [record("sleep", "sleep", "2026-11-01", { sleepHours: 5.5, fatigue: 8 })],
      "2026-11-01",
    );
    expect(result.date).toBe("2026-11-02");
    expect(result.recovery.join(" ")).toMatch(/Reduce optional activity/);
    expect(result.reasons.join(" ")).toMatch(/5.5 hours/);
    expect(result.recovery.join(" ")).not.toMatch(/extra shifts/);
  });
  it("does not claim missing sleep is zero or invent actual earnings", () => {
    const result = tomorrowBriefing([], "2026-11-01");
    expect(result.reasons.join(" ")).toMatch(/No actual sleep/);
  });
  it("validates assessment ratios and calculates completed-set volume only", () => {
    expect(accuracy(9, 10)).toBe(90);
    expect(accuracy(0, 0)).toBeNull();
    expect(() => accuracy(11, 10)).toThrow();
    expect(
      trainingVolume([
        record("set", "exerciseSet", "2026-11-01", {
          weight: 100,
          reps: 10,
          completed: true,
        }),
        record("set2", "exerciseSet", "2026-11-01", {
          weight: 100,
          reps: 10,
          completed: false,
        }),
      ]),
    ).toBe(1000);
  });
});
