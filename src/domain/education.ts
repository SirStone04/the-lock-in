import type { AppRecord } from "./models";
import { num } from "./models";
export function assessmentAccuracy(record: AppRecord): number | null {
  const questions = num(record, "questions");
  const correct = num(record, "correct");
  return Number.isInteger(questions) &&
    Number.isInteger(correct) &&
    questions > 0 &&
    correct >= 0 &&
    correct <= questions
    ? Math.round((correct / questions) * 1000) / 10
    : null;
}
export function examReadiness(records: AppRecord[]): {
  count: number;
  ready: boolean;
  latest: AppRecord[];
} {
  const latest = records
    .filter(
      (r) =>
        r.kind === "assessment" &&
        r.data.fresh === true &&
        r.data.mixed === true &&
        assessmentAccuracy(r) !== null,
    )
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
    )
    .slice(0, 3);
  const count = latest.filter((r) => (assessmentAccuracy(r) ?? 0) >= 85).length;
  return { count, ready: latest.length === 3 && count === 3, latest };
}
