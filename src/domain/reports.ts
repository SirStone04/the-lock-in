import type { AppRecord, Data } from "./models";
import { num, str, bool } from "./models";
import { addDays, today, weekStart } from "./dates";
import {
  uniqueRecords,
  financialTotals,
  shiftHours,
  estimatePay,
  accuracy,
  trainingVolume,
} from "./calculations";
import { getRank, scoreDay } from "./rank";

export interface WeeklyReport {
  schemaVersion: 1;
  weekStart: string;
  weekEnd: string;
  generatedAt: string;
  status: "preliminary" | "final";
  notes: string;
  markdown: string;
  metrics: Data;
}
const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    n,
  );
const decimal = (n: number) => Math.round(n * 100) / 100;
const average = (list: number[]) =>
  list.length ? decimal(list.reduce((a, b) => a + b, 0) / list.length) : null;
const display = (value: number | null, suffix = "") =>
  value === null ? "Not logged" : `${value}${suffix}`;
const list = (items: string[], missing = "Not logged.") =>
  items.length ? items.map((t) => `- ${t}`).join("\n") : `- ${missing}`;
const sum = (records: AppRecord[], key: string) =>
  decimal(records.reduce((s, r) => s + num(r, key), 0));
const daysWith = (records: AppRecord[], key: string) =>
  new Set(
    records.filter((record) => bool(record, key)).map((record) => record.date),
  ).size;
const safeHours = (r: AppRecord) => {
  try {
    return shiftHours(r);
  } catch {
    return 0;
  }
};
export function buildWeeklyReport(
  input: AppRecord[],
  date: string,
  notes = "",
  status: "preliminary" | "final" = "preliminary",
): WeeklyReport {
  const all = uniqueRecords(input);
  const start = weekStart(date),
    end = addDays(start, 6);
  const rows = all.filter((r) => r.date >= start && r.date <= end);
  const of = (kind: AppRecord["kind"]) => rows.filter((r) => r.kind === kind);
  const missions = of("mission"),
    daily = of("daily"),
    shifts = of("shift"),
    study = of("study"),
    assessments = of("assessment"),
    sleep = of("sleep"),
    faith = of("faith"),
    nutrition = of("nutrition"),
    skin = of("skincare"),
    workouts = of("workout");
  // A check-in summarizes a day, while dedicated logs describe actual sessions.
  // Use the latest summary per date and never add it to dedicated-log totals.
  const latestDaily = new Map<string, AppRecord>();
  for (const record of [...daily].sort(
    (a, b) => a.updatedAt.localeCompare(b.updatedAt) || a.revision - b.revision,
  )) {
    latestDaily.set(record.date, record);
  }
  const workContext = [...latestDaily.values()].filter(
    (record) =>
      !shifts.some((shift) => shift.date === record.date) &&
      (typeof record.data.workHours === "number" ||
        typeof record.data.incentiveHours === "number"),
  );
  const studyContext = [...latestDaily.values()].filter(
    (record) =>
      !study.some((session) => session.date === record.date) &&
      typeof record.data.educationMinutes === "number",
  );
  const routineDays = {
    prayer: daysWith(faith, "prayer"),
    scripture: daysWith(faith, "scripture"),
    church: daysWith(faith, "church"),
    breakfast: daysWith(nutrition, "breakfast"),
    lunch: daysWith(nutrition, "lunch"),
    dinner: daysWith(nutrition, "dinner"),
    snack: daysWith(nutrition, "snack"),
    skincareAM: daysWith(skin, "am"),
    skincarePM: daysWith(skin, "pm"),
  };
  const rank = getRank(all, end < today() ? end : today());
  const dates = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const eligible = dates
    .filter((d) => d <= today())
    .map((d) => scoreDay(d, all))
    .filter((s) => s.eligible);
  const consistency = average(eligible.map((s) => s.points));
  const finance = financialTotals(all, start, end);
  const completedMissions = missions.filter(
    (r) => str(r, "status").toLowerCase() === "completed",
  );
  const unfinished = missions.filter(
    (r) =>
      !["completed", "excused", "rescheduled"].includes(
        str(r, "status").toLowerCase(),
      ) && r.date <= today(),
  );
  const paidHours = decimal(shifts.reduce((s, r) => s + safeHours(r), 0));
  const invalidShifts = shifts.filter((r) => {
    try {
      shiftHours(r);
      estimatePay(r);
      return false;
    } catch {
      return true;
    }
  });
  const estimatedGross = decimal(
    shifts.reduce((s, r) => {
      try {
        return s + estimatePay(r).gross;
      } catch {
        return s;
      }
    }, 0),
  );
  const sleepValues = sleep
    .filter((r) => typeof r.data.sleepHours === "number")
    .map((r) => num(r, "sleepHours"));
  const avgSleep = average(sleepValues);
  const fatigueValues = [...shifts, ...sleep]
    .filter((r) => typeof r.data.fatigue === "number")
    .map((r) => num(r, "fatigue"));
  const avgFatigue = average(fatigueValues);
  const dailyDays = new Set(
    daily.filter((r) => bool(r, "checkInCompleted")).map((r) => r.date),
  );
  const missingDays = dates.filter((d) => d <= today() && !dailyDays.has(d));
  const plan = all.find(
    (r) => r.kind === "week" && (r.date === start || r.id === `week_${start}`),
  );
  const goals = Array.isArray(plan?.data.goals)
    ? plan.data.goals.map(String)
    : [];
  const outcomes = Array.isArray(plan?.data.goalOutcomes)
    ? plan.data.goalOutcomes.map(String)
    : [];
  const wins = daily
    .map((r) => str(r, "win") || str(r, "biggestWin"))
    .filter(Boolean);
  const obstacles = daily
    .map((r) => str(r, "difficulty") || str(r, "biggestDifficulty"))
    .filter(Boolean);
  const scores = assessments.map((r) => {
    const q =
      num(r, "questions") ||
      num(r, "attempted") ||
      num(r, "questionsAttempted");
    const c = num(r, "correct") || num(r, "correctAnswers");
    try {
      return {
        title: r.title,
        date: r.date,
        score:
          accuracy(c, q) ??
          (typeof r.data.score === "number" ? num(r, "score") : null),
      };
    } catch {
      return { title: r.title, date: r.date, score: null };
    }
  });
  const freshScores = all
    .filter(
      (r) =>
        r.kind === "assessment" &&
        r.date <= end &&
        r.data.fresh === true &&
        r.data.mixed === true,
    )
    .map((r) => {
      const q = num(r, "questions") || num(r, "attempted");
      try {
        return {
          title: r.title,
          date: r.date,
          score: accuracy(num(r, "correct"), q),
        };
      } catch {
        return { title: r.title, date: r.date, score: null };
      }
    })
    .filter((s) => s.score !== null);
  const recentFresh = freshScores
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);
  const ready =
    recentFresh.length === 3 && recentFresh.every((s) => (s.score ?? 0) >= 85);
  const weakTopics = [
    ...new Set(
      [...study, ...assessments]
        .map((r) => str(r, "missedConcepts") || str(r, "weakTopics"))
        .filter(Boolean),
    ),
  ];
  const finished = workouts
    .filter((r) => r.data.isTemplate !== true)
    .filter(
      (r) =>
        str(r, "status").toLowerCase() === "completed" ||
        r.data.completed === true,
    );
  const sets = of("exerciseSet");
  const volume = trainingVolume(sets);
  const bills = all.filter(
    (r) =>
      r.kind === "bill" &&
      String(r.data.dueDate || r.date) <= end &&
      (r.data.paid !== true || String(r.data.dueDate || r.date) >= start),
  );
  const ledger = rank.ledger.filter((r) => r.date >= start && r.date <= end);
  const xp = ledger.reduce((s, r) => s + Number(r.points ?? 0), 0);
  const metrics: Data = {
    consistency,
    eligibleDays: eligible.length,
    xpGained: xp,
    rank: `${rank.name} ${rank.division}`,
    missionsPlanned: missions.length,
    missionsCompleted: completedMissions.length,
    paidHours,
    estimatedGross,
    incomeReceived: finance.income,
    spending: finance.spending,
    netCashFlow: finance.netCashFlow,
    studyMinutes: sum(study, "duration"),
    workoutsCompleted: finished.length,
    trainingVolume: volume,
    averageSleep: avgSleep,
    averageFatigue: avgFatigue,
    incompleteDailyLogs: missingDays,
    routineDays,
    selfReportedContext: {
      workHours: sum(workContext, "workHours"),
      incentiveHours: sum(workContext, "incentiveHours"),
      studyMinutes: sum(studyContext, "educationMinutes"),
      workDates: workContext.map((record) => record.date),
      studyDates: studyContext.map((record) => record.date),
    },
  };
  const sections = [
    "# THE LOCK-IN — COMMAND CENTER WEEKLY REPORT",
    `**Week:** ${start} through ${end} (Sunday–Saturday, America/New_York).`,
    `**Status:** ${status}. Generated ${new Date().toISOString()}.`,
    "### Executive summary",
    `- Overall consistency: ${display(consistency, "%")} across ${eligible.length} eligible logged/planned days.\n- Rank: ${rank.name} ${rank.division}.\n- Consistency XP gained: ${xp}; total: ${rank.xp}.\n- Mission outcomes: ${completedMissions.length}/${missions.length} marked completed.\n- Main wins:\n${list(wins.slice(0, 3))}\n- Main difficulties:\n${list(obstacles.slice(0, 3))}\n- Three principal goal outcomes:\n${list(
      goals.map((g, i) => `${g}: ${outcomes[i] || "Outcome not recorded"}`),
      "No weekly goals recorded.",
    )}`,
    "### Employment",
    `- Shifts logged: ${shifts.length}; paid hours: ${paidHours}.\n- Self-reported check-in context without a dedicated shift (excluded from paid-hour and wage totals):\n${list(
      workContext.map(
        (r) =>
          `${r.date}: ${typeof r.data.workHours === "number" ? `${num(r, "workHours")} work hours` : "work hours not entered"}; ${typeof r.data.incentiveHours === "number" ? `${num(r, "incentiveHours")} incentive hours` : "incentive hours not entered"}`,
      ),
      "No unmatched work summaries.",
    )}\n- Pallet-jack hours: ${sum(shifts, "palletHours")}; high-lift hours: ${sum(shifts, "highLiftHours")}.\n- Pallet-jack productivity: ${display(average(shifts.filter((r) => typeof r.data.palletProductivity === "number").map((r) => num(r, "palletProductivity"))), "%")}.\n- Verified incentive entries: ${money(sum(shifts, "actualIncentive"))}.\n- Estimated gross earnings: ${money(estimatedGross)} (estimate; eligible premiums and incentive model require payroll verification).\n- Actual paycheck deposits received: ${money(rows.filter((r) => r.kind === "transaction" && str(r, "type") === "income" && (str(r, "category") === "Paycheck" || r.data.payrollId)).reduce((s, r) => s + num(r, "amount"), 0))}. Other income is reported below.\n- Average logged fatigue: ${display(avgFatigue, "/10")}.\n- Sustainability: ${avgFatigue !== null && avgFatigue >= 8 ? "High logged fatigue; prioritize recovery and review commitments." : avgSleep !== null && avgSleep < 7 ? "Logged sleep below seven hours on average; review sleep opportunities." : "Use actual sleep, fatigue and study completion to evaluate the schedule; no extra shifts are recommended automatically."}${invalidShifts.length ? `\n- ${invalidShifts.length} invalid shift(s) excluded from wage estimates; correct source entries.` : ""}`,
    "### Education",
    `- Study sessions: ${study.length}; study time: ${decimal(sum(study, "duration") / 60)} hours.\n- Self-reported check-in context without a dedicated study session (excluded from study-session totals):\n${list(
      studyContext.map(
        (r) => `${r.date}: ${num(r, "educationMinutes")} study minutes`,
      ),
      "No unmatched study summaries.",
    )}\n- Practice assessments:\n${list(scores.map((s) => `${s.date} ${s.title}: ${display(s.score, "%")}`))}\n- Weak concepts:\n${list(weakTopics)}\n- Booking readiness: ${ready ? "Three most recent logged fresh assessments are at least 85%. Confirm freshness and coverage before booking." : "Not established: three fresh mixed assessments at 85% or higher are required."}\n- Career milestones:\n${list(all.filter((r) => r.kind === "milestone").map((r) => `${r.title}: ${str(r, "status", "Not recorded")}`))}\n- RN pathway: NREMT → Ohio EMT → ADN → NCLEX-RN → RN. Paramedic training is optional.`,
    "### Financial performance",
    `- Actual income received: ${money(finance.income)}.\n- Total spending: ${money(finance.spending)}; refunds: ${money(finance.refunds)}.\n- Net cash flow: ${money(finance.netCashFlow)}.\n- Spending by category:\n${list(
      Object.entries(finance.byCategory).map(([k, v]) => `${k}: ${money(v)}`),
      "No spending entries.",
    )}\n- Family remittances: ${money(finance.remittances)}.\n- Internal transfers: ${money(finance.transfers)} (excluded from spending); savings transfers: ${money(finance.savings)}.\n- Debt payments: ${money(finance.debtPayments)}; principal and interest remain separate in source records.\n- Bills paid: ${bills.filter((r) => r.data.paid === true).length}; outstanding:\n${list(
      bills
        .filter((r) => r.data.paid !== true)
        .map(
          (r) =>
            `${r.title}: ${money(num(r, "amount"))}, due ${str(r, "dueDate", r.date)}`,
        ),
      "No outstanding bill records in this week; future obligations may exist.",
    )}\n- Available cash: ${finance.availableCash === null ? "Not verified; reconcile all account balances." : `${money(finance.availableCash)} (current reconciled account snapshots; not a historical week-end bank balance).`}`,
    "### Fitness",
    `- Workouts planned: ${missions.filter((r) => r.data.category === "Fitness" && (!bool(r, "optional") || bool(r, "included"))).length}; completed sessions: ${finished.length}.\n- Completed sets: ${sets.filter((r) => r.data.completed === true).length}; recorded volume: ${volume} lb × repetitions.\n- Exercise performance:\n${list(sets.filter((r) => r.data.completed === true).map((r) => `${r.date} ${str(r, "exercise", r.title)}: ${num(r, "weight")} lb × ${num(r, "reps")}${r.data.rpe ? `, RPE ${num(r, "rpe")}` : ""}`))}\n- Strength progression: compare like exercises and rep ranges in Fitness; no inferred strength gain without comparable sessions.\n- Recovery: ${display(avgFatigue, "/10 average logged fatigue")}.`,
    "### Faith",
    `- Prayer days: ${routineDays.prayer}; Scripture days: ${routineDays.scripture}; church days: ${routineDays.church}.\n- Bible study/prayer time: ${sum(faith, "duration")} recorded minutes.\n- Reflections:\n${list(faith.map((r) => str(r, "reflection")).filter(Boolean))}\n- These logs reflect planned habit adherence, never spiritual maturity.`,
    "### Nutrition",
    `- Meal days — breakfast: ${routineDays.breakfast}; lunch: ${routineDays.lunch}; dinner: ${routineDays.dinner}; pre-work snack: ${routineDays.snack}.\n- Hydration: ${sum(nutrition, "water")} oz across ${nutrition.filter((r) => typeof r.data.water === "number").length} entries.\n- Fueling notes:\n${list(nutrition.map((r) => str(r, "notes")).filter(Boolean))}\n- Food spending: ${money(
      Object.entries(finance.byCategory)
        .filter(([c]) => ["Groceries", "Dining"].includes(c))
        .reduce((s, [, v]) => s + v, 0),
    )}. Calorie and protein targets remain unset unless explicitly configured.`,
    "### Skincare and maintenance",
    `- Morning routine days: ${routineDays.skincareAM}; evening routine days: ${routineDays.skincarePM}.\n- Skin comparisons:\n${list(skin.map((r) => `${r.date}: breakouts ${r.data.breakouts ?? "not logged"}, texture ${r.data.texture ?? "not logged"}, marks ${r.data.darkMarks ?? "not logged"}, irritation ${r.data.irritation ?? "not logged"}`))}\n- Maintenance:\n${list(of("maintenance").map((r) => `${r.title}: ${str(r, "status", bool(r, "completed") ? "Completed" : "Not recorded")}`))}\n- No improvement is inferred from missing or incomparable measurements.`,
    "### Sleep",
    `- Actual sleep average: ${display(avgSleep, " hours")} across ${sleepValues.length} entries.\n- Nights under seven hours: ${sleepValues.filter((v) => v < 7).length}.\n- Fatigue average: ${display(avgFatigue, "/10")}.\n- Subjective logs support planning and are not medical diagnoses.`,
    "### Overall analysis",
    `- Three biggest wins:\n${list(wins.slice(0, 3))}\n- Three biggest obstacles:\n${list(obstacles.slice(0, 3))}\n- Missed or unfinished commitments:\n${list(
      unfinished.map(
        (r) => `${r.date}: ${r.title} (${str(r, "status", "Not started")})`,
      ),
      "No unfinished commitments in stored missions.",
    )}\n- Scheduling concerns: review overlaps and travel in Weekly Planner.\n- Recommended adjustment: ${(avgSleep !== null && avgSleep < 7) || (avgFatigue !== null && avgFatigue >= 8) ? "Reduce optional workload and preserve sleep before adding commitments." : "Keep realistic commitments and preserve free time; review missed work deliberately."}`,
    "### Next-week planning",
    `- Three proposed goals (review before accepting):\n  1. Keep a realistic prayer and Scripture routine after waking.\n  2. Complete targeted NREMT study using the logged weak areas or a fresh diagnostic.\n  3. Protect sleep opportunity and reconcile actual cash before adding commitments.\n- Study priorities: ${weakTopics.join("; ") || "Use a fresh diagnostic; no new weak-topic data logged."}\n- Recovery considerations: ${avgSleep === null ? "Sleep data is missing." : `${avgSleep} hours average actual sleep.`}\n- Financial priorities: reconcile accounts, review upcoming bills and budget actual deposited income.\n- Scheduling considerations: fixed warehouse commitments require explicit approval to change. Do not automatically carry unfinished work forward.`,
    "### Data quality and report notes",
    `- Verified values: source records manually entered by the user; no bank, employer, school, or medical integration is claimed. Live reports use current edited records; archived snapshots preserve the version saved at that time.\n- Routine adherence counts unique calendar days; logged faith minutes and hydration sum individual entries. Self-reported check-in work/study summaries provide context only and never increase dedicated-log totals.\n- Estimates: shift wage projections and any unverified research are estimates.\n- Missing/incomplete daily check-ins: ${missingDays.length ? missingDays.join(", ") : "None among elapsed days."}\n- Missing domains: ${(["shift", "study", "sleep", "faith", "nutrition", "skincare", "transaction"] as const).filter((kind) => !of(kind).length).join(", ") || "All listed domains have at least one entry."}. Zero totals mean no logged quantity, not proof an activity did not happen.\n- User notes: ${notes.trim() || "No report notes."}`,
  ];
  return {
    schemaVersion: 1,
    weekStart: start,
    weekEnd: end,
    generatedAt: new Date().toISOString(),
    status,
    notes,
    metrics,
    markdown: sections.join("\n\n"),
  };
}
export function downloadText(
  filename: string,
  text: string,
  type = "text/plain",
) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
