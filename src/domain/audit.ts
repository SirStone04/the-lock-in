import type { AppRecord, RecordInput } from "./models";
import { getRank } from "./rank";
import { today } from "./dates";
export function progressSourceSignature(records: AppRecord[]): string {
  return records
    .filter(
      (r) =>
        ["mission", "daily", "rankHistory"].includes(r.kind) ||
        r.id === "settings-profile",
    )
    .map((r) => `${r.id}@${r.revision}`)
    .sort()
    .join("|");
}
/** Materialized audit records are disposable projections. Rank calculations always read source records. */
export function progressAudit(
  records: AppRecord[],
  date = today(),
): RecordInput[] {
  const rank = getRank(records, date),
    mutations: RecordInput[] = [];
  const ids = new Set(rank.ledger.map((e) => e.id));
  for (const entry of rank.ledger) {
    const existing = records.find((r) => r.id === entry.id),
      sources = entry.sources.join("|");
    if (
      existing?.data.points === entry.points &&
      existing.data.sources === sources
    )
      continue;
    mutations.push({
      id: entry.id,
      kind: "xp",
      date: entry.date,
      title: "Daily consistency award",
      data: { points: entry.points, sources, derived: true },
    });
  }
  for (const orphan of records.filter(
    (r) =>
      r.kind === "xp" &&
      r.data.derived === true &&
      !ids.has(r.id) &&
      r.data.points !== 0,
  ))
    mutations.push({
      id: orphan.id,
      kind: "xp",
      date: orphan.date,
      title: "Daily consistency award",
      data: {
        points: 0,
        sources: "",
        derived: true,
        reason: "Source records removed",
      },
    });
  for (const h of rank.history)
    if (!records.some((r) => r.id === `promotion-${h.index}`))
      mutations.push({
        id: `promotion-${h.index}`,
        kind: "rankHistory",
        date: h.date,
        title: `${h.name} ${h.division}`,
        data: { index: h.index, xp: h.xp },
      });
  return mutations;
}
