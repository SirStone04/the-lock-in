import { addDays, inRange, today, weekStart, validDate } from "./dates";
import { bool, num, str } from "./models";
import type { AppRecord } from "./models";
import { accountBalance, uniqueRecords } from "./calculations";

const NAMES = [
  "Recruit",
  "Rookie",
  "Veteran",
  "Elite",
  "Pro",
  "Master",
  "Grandmaster",
  "Legendary",
];
const COLORS = [
  "#9eabb7",
  "#a9bfce",
  "#65bca6",
  "#719ce3",
  "#b492e6",
  "#edb965",
  "#e99579",
  "#e5c771",
];
export const RANKS = NAMES.flatMap((name, rank) =>
  ["III", "II", "I"].map((division, j) => {
    const index = rank * 3 + j;
    return {
      index,
      name,
      division,
      threshold: 500 * index + 45 * index * index,
      color: COLORS[rank],
    };
  }),
);
export interface DayScore {
  date: string;
  points: number;
  missionPoints: number;
  checkInPoints: number;
  reflectionPoints: number;
  eligible: boolean;
  weightedCompletion: number;
  missionCount: number;
  sourceIds: string[];
}
const CATEGORY_WEIGHTS: Record<string, number> = {
  Faith: 5,
  Education: 4,
  Employment: 3,
  Fitness: 2,
  Finances: 2,
  Nutrition: 2,
  Skincare: 1,
  Maintenance: 1,
  Recovery: 3,
};
function completion(r: AppRecord): number {
  const status = str(r, "status").toLowerCase().replaceAll("_", " ");
  if (status === "completed") return 1;
  if (
    status === "skipped" ||
    status === "not started" ||
    status === "not-started"
  )
    return 0;
  const target = num(r, "target", num(r, "targetQuantity"));
  const actual = num(r, "actual", num(r, "actualQuantity"));
  const minutes = num(r, "plannedMinutes", num(r, "plannedDuration"));
  const actualMinutes = num(r, "actualMinutes", num(r, "actualDuration"));
  // Quantity is measured in the mission's chosen targetUnit; duration is measured in minutes.
  // Either recorded measure may demonstrate progress. Use the larger ratio rather than adding them,
  // so a default target of one does not suppress measured study time and extra work never exceeds 100%.
  if (target > 0 || minutes > 0)
    return Math.max(
      0,
      Math.min(
        1,
        Math.max(
          target > 0 ? actual / target : 0,
          minutes > 0 ? actualMinutes / minutes : 0,
        ),
      ),
    );
  return Math.max(0, Math.min(1, num(r, "completion", 0)));
}
export function scoreDay(date: string, records: AppRecord[]): DayScore {
  const daily = uniqueRecords(records).filter((r) => r.date === date);
  const missions = daily.filter((r) => {
    if (r.kind !== "mission" || (bool(r, "optional") && !bool(r, "included")))
      return false;
    const status = str(r, "status").toLowerCase();
    if (status.startsWith("excused") || status === "rescheduled") return false;
    // A task added after its date is visible and editable but cannot farm retroactive mission XP.
    const plannedAt = str(r, "plannedAt", r.createdAt);
    const plannedDate = /(?:Z|[+-]\d\d:\d\d)$/.test(plannedAt)
      ? today(new Date(plannedAt))
      : plannedAt.slice(0, 10);
    const createdDate = r.createdAt ? today(new Date(r.createdAt)) : date;
    return (!plannedAt || plannedDate <= date) && createdDate <= date;
  });
  const grouped = new Map<
    string,
    { earned: number; weight: number; importance: number }
  >();
  for (const m of missions) {
    const category = str(m, "category", "Maintenance");
    const raw = m.data.priority;
    const priority =
      typeof raw === "number"
        ? raw
        : raw === "high"
          ? 3
          : raw === "low"
            ? 1
            : 2;
    const weight = Math.max(1, Math.min(5, num(m, "weight", priority)));
    const group = grouped.get(category) ?? {
      earned: 0,
      weight: 0,
      importance: CATEGORY_WEIGHTS[category] ?? 2,
    };
    group.earned += completion(m) * weight;
    group.weight += weight;
    grouped.set(category, group);
  }
  let weights = 0,
    earned = 0;
  for (const group of grouped.values()) {
    weights += group.importance;
    earned += (group.earned / group.weight) * group.importance;
  }
  const adherence = weights > 0 ? earned / weights : 0;
  const checkins = daily.filter((r) => {
    if (r.kind !== "daily") return false;
    const createdDate = r.createdAt ? today(new Date(r.createdAt)) : date;
    // Honest late entry remains editable, but initial logging beyond seven calendar days earns no retroactive check-in/reflection XP.
    return createdDate <= addDays(date, 7);
  });
  const checkIn = checkins.some((r) => bool(r, "checkInCompleted"));
  const reflection = checkins.some(
    (r) =>
      bool(r, "reflectionCompleted") ||
      Boolean(str(r, "reflection").trim()) ||
      (Boolean(str(r, "biggestWin").trim()) &&
        Boolean(str(r, "difficulty").trim())),
  );
  const missionPoints = Math.round(80 * adherence),
    checkInPoints = checkIn ? 10 : 0,
    reflectionPoints = reflection ? 10 : 0;
  return {
    date,
    points: missionPoints + checkInPoints + reflectionPoints,
    missionPoints,
    checkInPoints,
    reflectionPoints,
    eligible: missions.length > 0 || checkins.length > 0,
    weightedCompletion: Math.round(adherence * 100),
    missionCount: missions.length,
    sourceIds: [...missions, ...checkins]
      .map((r) => `${r.id}@${r.revision}`)
      .sort(),
  };
}
export interface XpEntry {
  id: string;
  date: string;
  points: number;
  sources: string[];
}
export interface Promotion {
  index: number;
  name: string;
  division: string;
  date: string;
  xp: number;
}
export interface RankResult {
  xp: number;
  index: number;
  name: string;
  division: string;
  nextThreshold: number | null;
  progress: number;
  weeklyConsistency: number;
  rollingConsistency: number;
  eligibleDays: number;
  qualified: boolean;
  currentForm: string;
  ledger: XpEntry[];
  history: Promotion[];
}
const average = (values: number[]): number =>
  values.length
    ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
    : 0;
export function getRank(records: AppRecord[], asOf = today()): RankResult {
  const all = uniqueRecords(records);
  const settings =
    all.find((r) => r.id === "settings-profile") ??
    all.find((r) => r.kind === "settings");
  const start = settings
    ? str(settings, "trackingStart", "2026-11-01")
    : "2026-11-01";
  const thresholds =
    Array.isArray(settings?.data.rankThresholds) &&
    settings.data.rankThresholds.length === 24 &&
    settings.data.rankThresholds.every(
      (v, i, arr) =>
        typeof v === "number" &&
        Number.isInteger(v) &&
        v >= 0 &&
        (i === 0
          ? v === 0
          : typeof arr[i - 1] === "number" && v > (arr[i - 1] as number)),
    )
      ? settings.data.rankThresholds
      : null;
  const threshold = (index: number): number => {
    const v = thresholds?.[index];
    return typeof v === "number" && Number.isInteger(v) && v >= 0
      ? v
      : RANKS[index].threshold;
  };
  const byDate = new Map<string, AppRecord[]>();
  for (const r of all) {
    if (
      (r.kind === "mission" || r.kind === "daily") &&
      validDate(r.date) &&
      r.date >= start &&
      r.date <= asOf
    ) {
      const day = byDate.get(r.date) ?? [];
      day.push(r);
      byDate.set(r.date, day);
    }
  }
  const dates = [...byDate.keys()].sort();
  // Group once so years of workout sets and transactions are not scanned for every scoring date.
  const scores = dates
    .map((date) => scoreDay(date, byDate.get(date) ?? []))
    .filter((d) => d.eligible);
  const ledger = scores.map((d) => ({
    id: `xp-${d.date}`,
    date: d.date,
    points: d.points,
    sources: d.sourceIds,
  }));
  let xp = 0,
    index = 0;
  const history: Promotion[] = [];
  for (let i = 0; i < scores.length; i++) {
    const day = scores[i];
    xp += day.points;
    const rolling = scores
      .slice(0, i + 1)
      .filter((s) => s.date >= addDays(day.date, -27));
    // Onboarding uses the same 70% standard with at least three recorded days; after 14, use the last 28 calendar days.
    const qualifies =
      (i + 1 >= 14 ? rolling.length >= 14 : i + 1 >= 3) &&
      average(rolling.map((s) => s.points)) >= 70;
    while (index < 23 && xp >= threshold(index + 1) && qualifies) {
      index++;
      history.push({
        index,
        name: RANKS[index].name,
        division: RANKS[index].division,
        date: day.date,
        xp,
      });
    }
  }
  // Original earned promotions remain visible when corrected source records lower historical XP.
  // Persisted dates/XP take precedence over recomputed dates; they never add to the XP ledger.
  const historyByIndex = new Map(
    history.map((promotion) => [promotion.index, promotion]),
  );
  const retainedIndices = new Set<number>();
  const retained = all
    .filter(
      (r) => r.kind === "rankHistory" && validDate(r.date) && r.date <= asOf,
    )
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt),
    );
  for (const r of retained) {
    const earned = num(r, "index"),
      earnedXP = num(r, "xp");
    if (
      Number.isInteger(earned) &&
      earned > 0 &&
      earned < 24 &&
      Number.isInteger(earnedXP) &&
      earnedXP >= threshold(earned)
    ) {
      index = Math.max(index, earned);
      if (!retainedIndices.has(earned)) {
        historyByIndex.set(earned, {
          index: earned,
          name: RANKS[earned].name,
          division: RANKS[earned].division,
          date: r.date,
          xp: earnedXP,
        });
        retainedIndices.add(earned);
      }
    }
  }
  const promotionHistory = [...historyByIndex.values()].sort(
    (a, b) => a.date.localeCompare(b.date) || a.index - b.index,
  );
  const rolling = scores.filter((s) => s.date >= addDays(asOf, -27));
  const weekly = scores.filter((s) => inRange(s.date, weekStart(asOf), asOf));
  const rollingConsistency = average(rolling.map((s) => s.points)),
    weeklyConsistency = average(weekly.map((s) => s.points));
  const qualified =
    (scores.length >= 14 ? rolling.length >= 14 : scores.length >= 3) &&
    rollingConsistency >= 70;
  const previous = threshold(index),
    next = index < 23 ? threshold(index + 1) : null;
  const progress =
    next === null
      ? 100
      : Math.max(
          0,
          Math.min(
            100,
            Math.round(((xp - previous) / (next - previous)) * 100),
          ),
        );
  return {
    xp,
    index,
    name: RANKS[index].name,
    division: RANKS[index].division,
    nextThreshold: next,
    progress,
    weeklyConsistency,
    rollingConsistency,
    eligibleDays: rolling.length,
    qualified,
    currentForm: !rolling.length
      ? "Awaiting first log"
      : rollingConsistency >= 85
        ? "In rhythm"
        : rollingConsistency >= 70
          ? "Steady"
          : rollingConsistency >= 40
            ? "Rebuilding"
            : "Reset & recover",
    ledger,
    history: promotionHistory,
  };
}
export function rankForXP(xp: number): (typeof RANKS)[number] {
  return [...RANKS].reverse().find((r) => xp >= r.threshold) ?? RANKS[0];
}
export interface EarnedAchievement {
  id: string;
  title: string;
  description: string;
  earned: boolean;
  date?: string;
}
export function getAchievements(
  records: AppRecord[],
  asOf = today(),
): EarnedAchievement[] {
  const all = uniqueRecords(records).filter((r) => r.date <= asOf);
  const rank = getRank(all, asOf);
  const completedDays = rank.ledger.filter((l) => l.points >= 70);
  const checks = all.filter(
    (r) => r.kind === "daily" && bool(r, "checkInCompleted"),
  );
  const milestones = all.filter(
    (r) =>
      r.kind === "milestone" &&
      (bool(r, "completed") || str(r, "status").toLowerCase() === "completed"),
  );
  const items: [string, string, string, boolean][] = [
    [
      "first-day",
      "First Day Complete",
      "Close one honest day.",
      checks.some((r) => bool(r, "closed")),
    ],
    [
      "seven-checkins",
      "Seven Daily Check-Ins",
      "Record seven daily check-ins.",
      new Set(checks.map((r) => r.date)).size >= 7,
    ],
    [
      "four-shifts",
      "Four Warehouse Shifts Logged",
      "Record four completed shifts.",
      all.filter((r) => r.kind === "shift").length >= 4,
    ],
    [
      "study-week",
      "First Full Study Week",
      "Follow every planned study commitment in a week.",
      [...new Set(all.map((r) => weekStart(r.date)))].some((w) => {
        const missions = all.filter(
          (r) =>
            r.kind === "mission" &&
            str(r, "category") === "Education" &&
            weekStart(r.date) === w &&
            (!bool(r, "optional") || bool(r, "included")) &&
            !["excused", "rescheduled"].includes(
              str(r, "status").toLowerCase(),
            ),
        );
        return (
          missions.length >= 2 &&
          missions.every((r) => str(r, "status").toLowerCase() === "completed")
        );
      }),
    ],
    [
      "nremt",
      "NREMT Readiness",
      "Three fresh mixed assessments at 85% or above.",
      all.filter(
        (r) =>
          r.kind === "assessment" &&
          bool(r, "fresh") &&
          (bool(r, "mixed") ||
            str(r, "topic").toLowerCase().includes("mixed") ||
            str(r, "type") === "mixed") &&
          num(r, "attempted", num(r, "questions")) > 0 &&
          num(r, "correct") / num(r, "attempted", num(r, "questions")) >= 0.85,
      ).length >= 3,
    ],
    [
      "thirty",
      "Thirty Days of Consistency",
      "Earn 70+ consistency points on 30 days.",
      completedDays.length >= 30,
    ],
    [
      "ninety",
      "Ninety Days of Consistency",
      "Earn 70+ consistency points on 90 days.",
      completedDays.length >= 90,
    ],
    [
      "recovery",
      "Recovery Champion",
      "Follow seven planned recovery commitments.",
      all.filter(
        (r) =>
          r.kind === "mission" &&
          str(r, "category") === "Recovery" &&
          str(r, "status").toLowerCase() === "completed",
      ).length >= 7,
    ],
    [
      "budget",
      "Budget Reviewed",
      "Complete a planned budget review.",
      all.some(
        (r) =>
          r.kind === "mission" &&
          str(r, "category") === "Finances" &&
          str(r, "status").toLowerCase() === "completed",
      ),
    ],
    [
      "savings",
      "First $500 Emergency Savings",
      "Reconcile an emergency account with $500.",
      all.some(
        (r) =>
          r.kind === "account" &&
          bool(r, "reconciled") &&
          (accountBalance(r, all, asOf) ?? 0) >= 500 &&
          r.title.toLowerCase().includes("emergency"),
      ),
    ],
    ...[
      "EMT Certification",
      "Nursing School Admission",
      "Registered Nurse",
    ].map(
      (title) =>
        [
          title.toLowerCase().replaceAll(" ", "-"),
          title,
          "A separate career milestone.",
          milestones.some((r) => r.title.toLowerCase() === title.toLowerCase()),
        ] as [string, string, string, boolean],
    ),
  ];
  return items.map(([id, title, description, earned]) => ({
    id,
    title,
    description,
    earned,
  }));
}
