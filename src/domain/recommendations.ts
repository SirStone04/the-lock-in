import { addDays, dayOfWeek, today, weekEnd, weekStart } from "./dates";
import { financialTotals, uniqueRecords } from "./calculations";
import { num, str } from "./models";
import type { AppRecord } from "./models";
import { getRank } from "./rank";

export interface Briefing {
  date: string;
  priorities: string[];
  fixedCommitments: string[];
  blocks: string[];
  recovery: string[];
  improvement: string;
  conflicts: string[];
  reasons: string[];
}
export function detectConflicts(missions: AppRecord[]): string[] {
  const conflicts: string[] = [];
  const intervals: {
    date: string;
    start: number;
    end: number;
    title: string;
  }[] = [];
  for (const m of missions.filter(
    (r) =>
      r.kind === "mission" &&
      r.data.optional !== true &&
      str(r, "status").toLowerCase() !== "rescheduled",
  )) {
    const time = str(m, "plannedTime", str(m, "scheduledTime", str(m, "time")));
    const [hour, minute] = time.split(":").map(Number);
    const duration = num(m, "plannedMinutes", num(m, "durationMinutes"));
    if (
      !Number.isFinite(hour) ||
      !Number.isFinite(minute) ||
      hour < 0 ||
      hour > 23 ||
      minute < 0 ||
      minute > 59 ||
      duration <= 0
    )
      continue;
    const start = hour * 60 + minute - num(m, "travelMinutes");
    const end = hour * 60 + minute + duration;
    intervals.push({ date: m.date, start, end, title: m.title });
    if (str(m, "category") === "Education" && (hour >= 23 || hour < 7))
      conflicts.push(
        `${m.date}: ${m.title} falls in a likely sleep window. Consider another study time.`,
      );
    if (str(m, "category") === "Fitness" && duration > 100)
      conflicts.push(
        `${m.date}: ${m.title} exceeds 100 minutes; review training volume and recovery.`,
      );
  }
  for (let i = 0; i < intervals.length; i++)
    for (let j = i + 1; j < intervals.length; j++) {
      const a = intervals[i],
        b = intervals[j];
      if (a.date === b.date && a.start < b.end && b.start < a.end)
        conflicts.push(
          `${a.date}: ${a.title} overlaps ${b.title}, including entered travel time.`,
        );
    }
  const dates = [...new Set(missions.map((r) => r.date))];
  for (const date of dates) {
    const day = intervals.filter((i) => i.date === date);
    const work = missions.some(
      (r) => r.date === date && str(r, "category") === "Employment",
    );
    if (!work && day.reduce((n, i) => n + i.end - i.start, 0) > 480)
      conflicts.push(
        `${date}: more than eight planned hours on an off-day; leave recovery and travel space.`,
      );
  }
  const employment = [
    ...new Set(
      missions
        .filter((r) => str(r, "category") === "Employment")
        .map((r) => r.date),
    ),
  ].sort();
  let run = 1;
  for (let i = 1; i < employment.length; i++) {
    run = employment[i] === addDays(employment[i - 1], 1) ? run + 1 : 1;
    if (run === 4)
      conflicts.push(
        `${employment[i]}: four consecutive strenuous workdays; review recovery.`,
      );
  }
  return [...new Set(conflicts)];
}
export function tomorrowBriefing(
  records: AppRecord[],
  date = today(),
): Briefing {
  const all = uniqueRecords(records);
  const tomorrow = addDays(date, 1);
  const previous = all.filter((r) => r.date === date);
  const sleep = previous.find((r) => r.kind === "sleep");
  const daily = previous.find((r) => r.kind === "daily");
  const hours = sleep
    ? num(sleep, "sleepHours", num(sleep, "hours"))
    : num(daily, "sleepHours", NaN);
  const fatigue = Math.max(
    num(daily, "fatigue"),
    ...previous
      .filter((r) => r.kind === "shift" || r.kind === "sleep")
      .map((r) => num(r, "fatigue")),
  );
  const tomorrowMissions = all.filter(
    (r) =>
      r.kind === "mission" &&
      r.date === tomorrow &&
      r.data.optional !== true &&
      !["completed", "excused", "rescheduled"].includes(
        str(r, "status").toLowerCase(),
      ),
  );
  const fixed = tomorrowMissions.filter(
    (r) => r.data.fixed === true || str(r, "category") === "Employment",
  );
  const reasons: string[] = [],
    recovery: string[] = [],
    blocks: string[] = [];
  const lowSleep = Number.isFinite(hours) && hours < 6;
  const highFatigue = fatigue >= 8;
  if (lowSleep) {
    recovery.push(
      "Prioritize a full sleep opportunity. Reduce optional activity; preserve fixed commitments.",
    );
    reasons.push(`Last recorded sleep was ${hours} hours, below six hours.`);
  }
  if (highFatigue) {
    recovery.push(
      "Choose rest or reduce gym sets; do not add discretionary tasks.",
    );
    reasons.push(`Reported fatigue is ${fatigue}/10.`);
  }
  if (!sleep && !Number.isFinite(hours)) {
    recovery.push("Log actual sleep before deciding on extra activity.");
    reasons.push("No actual sleep duration was recorded for this day.");
  }
  const recentHours = all
    .filter(
      (r) =>
        r.kind === "shift" && r.date >= addDays(date, -2) && r.date <= date,
    )
    .reduce((sum, r) => sum + num(r, "paidHours"), 0);
  if (recentHours >= 25) {
    recovery.push("Recent warehouse load is high; preserve recovery blocks.");
    reasons.push(
      `${recentHours} paid work hours were logged over the last three dates.`,
    );
  }
  const missedStudy = previous.find(
    (r) =>
      r.kind === "mission" &&
      str(r, "category") === "Education" &&
      !["completed", "excused", "rescheduled"].includes(
        str(r, "status").toLowerCase(),
      ),
  );
  const scheduledStudy = tomorrowMissions.find(
    (r) => str(r, "category") === "Education",
  );
  if (scheduledStudy)
    blocks.push(
      `${scheduledStudy.title}${str(scheduledStudy, "plannedTime", str(scheduledStudy, "scheduledTime")) ? ` at ${str(scheduledStudy, "plannedTime", str(scheduledStudy, "scheduledTime"))}` : ""}; keep the existing duration.`,
    );
  else if (missedStudy && !lowSleep && !highFatigue) {
    blocks.push(
      "Consider one 20-minute catch-up study block in a free window.",
    );
    reasons.push(
      `The ${date} study commitment was not marked complete; a short alternative avoids stacking full sessions.`,
    );
  }
  const workout = tomorrowMissions.find(
    (r) => str(r, "category") === "Fitness",
  );
  if (workout)
    blocks.push(
      lowSleep || highFatigue
        ? "Edit the planned gym session to light practice or rest if needed."
        : `${workout.title}: follow the prescribed volume; no automatic increase.`,
    );
  if (
    previous.some(
      (r) =>
        r.kind === "workout" && str(r, "status").toLowerCase() === "completed",
    )
  )
    reasons.push(
      "A completed workout is recorded. Keep future training volume sustainable.",
    );
  const financial = financialTotals(all, weekStart(date), weekEnd(date));
  const budget = all
    .filter(
      (r) =>
        r.kind === "budget" &&
        r.date >= weekStart(date) &&
        r.date <= weekEnd(date),
    )
    .reduce((sum, r) => sum + num(r, "amount", num(r, "planned")), 0);
  let improvement =
    "Prepare one practical item tonight for your highest-priority commitment.";
  if (budget > 0 && financial.spending > budget) {
    improvement =
      "Review discretionary spending and essential bills before another purchase.";
    reasons.push(
      `Recorded spending of $${financial.spending.toFixed(2)} exceeds the entered weekly budget of $${budget.toFixed(2)}. Predicted wages are excluded.`,
    );
  }
  const planned = previous.filter(
    (r) => r.kind === "mission" && r.data.optional !== true,
  );
  if (
    planned.length &&
    planned.every((r) => str(r, "status").toLowerCase() === "completed")
  ) {
    improvement = "Recognize a consistent day and preserve your free time.";
    reasons.push(
      "Every applicable planned mission for today is marked complete.",
    );
  }
  const priorityCandidates = tomorrowMissions
    .filter((r) => !lowSleep || str(r, "category") !== "Fitness")
    .sort((a, b) => num(b, "priority", 2) - num(a, "priority", 2));
  const priorities = priorityCandidates.slice(0, 3).map((r) => r.title);
  if (!priorities.length)
    priorities.push(
      "Prayer and Scripture after waking",
      "Review tomorrow’s fixed commitments",
      "Protect sleep and choose a realistic study block",
    );
  const rank = getRank(all, date);
  if (rank.rollingConsistency < 70 && rank.eligibleDays >= 3)
    reasons.push(
      "Recent consistency is below 70%; reduce plan complexity before adding more commitments.",
    );
  const dow = dayOfWeek(tomorrow);
  const profile = all.find((r) => r.id === "settings-profile");
  const workDays = Array.isArray(profile?.data.workDays)
    ? profile.data.workDays
    : [];
  if (!fixed.length && workDays.includes(dow))
    reasons.push(
      "Tomorrow is a usual warehouse day, but no confirmed shift is stored. Review the plan rather than assuming hours.",
    );
  if (!recovery.length)
    recovery.push(
      "Protect the usual sleep opportunity and review energy before optional activity.",
    );
  return {
    date: tomorrow,
    priorities,
    fixedCommitments: fixed.map(
      (r) =>
        `${str(r, "plannedTime", str(r, "scheduledTime", "Time unconfirmed"))} · ${r.title}`,
    ),
    blocks,
    recovery,
    improvement,
    conflicts: detectConflicts(tomorrowMissions),
    reasons,
  };
}
