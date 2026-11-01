import { dateTimeHours, inRange, today } from "./dates";
import type { AppRecord, Data } from "./models";

const finite = (v: unknown, fallback = 0): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;
const round = (v: number): number =>
  Math.round((v + Number.EPSILON) * 100) / 100;
const dataOf = (input: AppRecord | Data): Data =>
  "kind" in input ? (input as AppRecord).data : (input as Data);
/** Calculations consume dollar amounts; rounding happens at totals, never by string coercion. */
export function uniqueRecords(records: AppRecord[]): AppRecord[] {
  const map = new Map<string, AppRecord>();
  for (const r of records) {
    const previous = map.get(r.id);
    if (
      !previous ||
      r.revision > previous.revision ||
      (r.revision === previous.revision && r.updatedAt >= previous.updatedAt)
    )
      map.set(r.id, r);
  }
  return [...map.values()];
}
export function shiftHours(input: AppRecord | Data): number {
  const d = dataOf(input);
  const start = String(d.clockIn ?? d.actualClockIn ?? "");
  const end = String(d.clockOut ?? d.actualClockOut ?? "");
  let paid: number;
  if (start && end) {
    const elapsed = dateTimeHours(start, end);
    const breaks = finite(d.breakMinutes);
    if (breaks < 0 || breaks > elapsed * 60)
      throw new Error("Unpaid breaks must fit within the shift.");
    paid = elapsed - breaks / 60;
  } else paid = finite(d.paidHours);
  if (paid < 0 || paid > 24)
    throw new Error("Paid hours must be between 0 and 24.");
  if (
    ["palletHours", "highLiftHours", "otherHours"].some(
      (key) => finite(d[key]) < 0,
    )
  )
    throw new Error("Task hours cannot be negative.");
  const tasks =
    finite(d.palletHours) + finite(d.highLiftHours) + finite(d.otherHours);
  if (tasks > paid + 0.01)
    throw new Error("Task hours cannot exceed paid hours.");
  return round(paid);
}
export interface PayEstimate {
  paidHours: number;
  standardHours: number;
  overtimeHours: number;
  base: number;
  premiums: number;
  incentive: number;
  gross: number;
  estimatedGross: number;
  isEstimate: true;
  incentiveVerified: boolean;
  warnings: string[];
}
export function estimatePay(input: AppRecord | Data): PayEstimate {
  const d = dataOf(input);
  const paid = shiftHours(d);
  const baseRate = finite(d.baseRate);
  const overtime = finite(d.overtimeHours);
  if (
    [
      "baseRate",
      "freezerRate",
      "nightRate",
      "incentiveRate",
      "otherPremium",
    ].some((key) => finite(d[key]) < 0)
  )
    throw new Error("Pay rates and premiums cannot be negative.");
  if (overtime < 0 || overtime > paid)
    throw new Error("Overtime must be a portion of paid hours.");
  const standard = paid - overtime;
  const freezer = finite(d.freezerHours);
  const night = finite(d.nightHours);
  if (freezer < 0 || night < 0 || freezer > paid || night > paid)
    throw new Error("Premium hours must be between zero and paid hours.");
  const verified =
    typeof d.actualIncentive === "number" && d.actualIncentive >= 0;
  const incentive = verified
    ? finite(d.actualIncentive)
    : finite(d.palletHours) * finite(d.incentiveRate);
  const base =
    standard * baseRate +
    overtime * baseRate * finite(d.overtimeMultiplier, 1.5);
  const premiums =
    freezer * finite(d.freezerRate) +
    night * finite(d.nightRate) +
    finite(d.otherPremium);
  const gross = round(base + premiums + incentive);
  return {
    paidHours: paid,
    standardHours: round(standard),
    overtimeHours: overtime,
    base: round(base),
    premiums: round(premiums),
    incentive: round(incentive),
    gross,
    estimatedGross: gross,
    isEstimate: true,
    incentiveVerified: verified,
    warnings: [
      ...(typeof d.baseRate !== "number" || !Number.isFinite(d.baseRate)
        ? ["Base pay rate is not entered; estimated gross excludes base wages."]
        : []),
      ...(freezer > 0 && typeof d.freezerRate !== "number"
        ? [
            "Freezer premium rate is not entered; no freezer premium was assumed.",
          ]
        : []),
      ...(night > 0 && typeof d.nightRate !== "number"
        ? ["Night premium rate is not entered; no night premium was assumed."]
        : []),
      ...(verified
        ? ["Gross remains an estimate until reconciled with payroll."]
        : [
            "Incentive formula is unconfirmed; this is a configurable estimate.",
            "Premiums apply only to the qualifying hours you entered.",
          ]),
    ],
  };
}
export interface FinancialTotals {
  income: number;
  expenses: number;
  spending: number;
  transfers: number;
  remittances: number;
  savings: number;
  refunds: number;
  debtPayments: number;
  netCashFlow: number;
  availableCash: number | null;
  byCategory: Record<string, number>;
}
/** Reconciled balances are explicit end-of-day snapshots; subsequent assigned transactions move them. */
export function accountBalance(
  account: AppRecord,
  records: AppRecord[],
  asOf = today(),
): number | null {
  const d = account.data;
  if (d.reconciled !== true) return null;
  const snapshot =
    typeof d.reconciledBalance === "number"
      ? d.reconciledBalance
      : typeof d.balance === "number"
        ? d.balance
        : null;
  const through =
    typeof d.reconciledThrough === "string"
      ? d.reconciledThrough
      : account.date;
  if (snapshot === null || through > asOf) return null;
  let balance = snapshot;
  for (const tx of uniqueRecords(records).filter(
    (r) => r.kind === "transaction" && r.date > through && r.date <= asOf,
  )) {
    const amount = Math.max(
      0,
      finite(
        tx.data.amount,
        finite(tx.data.principal) + finite(tx.data.interest),
      ),
    );
    const type = String(tx.data.type ?? "expense");
    if (
      ["income", "refund", "transfer"].includes(type) &&
      tx.data.toAccount === account.id
    )
      balance += amount;
    if (
      ["expense", "remittance", "debt", "transfer"].includes(type) &&
      tx.data.fromAccount === account.id
    )
      balance -= amount;
  }
  return round(balance);
}
export function financialTotals(
  records: AppRecord[],
  start?: string,
  end?: string,
): FinancialTotals {
  const all = uniqueRecords(records);
  const transactions = all.filter(
    (r) => r.kind === "transaction" && inRange(r.date, start, end),
  );
  let income = 0,
    spending = 0,
    transfers = 0,
    remittances = 0,
    savings = 0,
    refunds = 0,
    debtPayments = 0;
  const byCategory: Record<string, number> = {};
  for (const r of transactions) {
    const d = r.data;
    const type = String(d.type ?? "expense");
    const amount = Math.max(
      0,
      finite(d.amount, finite(d.principal) + finite(d.interest)),
    );
    if (type === "income") income += amount;
    else if (type === "refund") refunds += amount;
    else if (type === "transfer") {
      transfers += amount;
      if (d.savings === true || d.category === "Savings") savings += amount;
    } else {
      spending += amount;
      const category = String(
        d.category ??
          (type === "remittance"
            ? "Family support"
            : type === "debt"
              ? "Debt payments"
              : "Other"),
      );
      byCategory[category] = (byCategory[category] ?? 0) + amount;
      if (type === "remittance" || category === "Family support")
        remittances += amount;
      if (type === "debt" || category === "Debt payments")
        debtPayments += amount;
    }
  }
  const accounts = all.filter((r) => r.kind === "account");
  // Available cash requires explicit reconciliation; the snapshot is never inferred from projected wages.
  const asOf = end ?? today();
  const balances = accounts.map((r) => accountBalance(r, all, asOf));
  const accountIds = new Set(accounts.map((r) => r.id));
  const earliestSnapshot =
    accounts
      .map((r) =>
        typeof r.data.reconciledThrough === "string"
          ? r.data.reconciledThrough
          : r.date,
      )
      .sort()[0] ?? asOf;
  const unassigned = all.some((r) => {
    if (r.kind !== "transaction" || r.date <= earliestSnapshot || r.date > asOf)
      return false;
    const type = String(r.data.type ?? "expense");
    return (
      (["income", "refund", "transfer"].includes(type) &&
        !accountIds.has(String(r.data.toAccount ?? ""))) ||
      (["expense", "remittance", "debt", "transfer"].includes(type) &&
        !accountIds.has(String(r.data.fromAccount ?? "")))
    );
  });
  const availableCash =
    accounts.length && !unassigned && balances.every((v) => v !== null)
      ? round(balances.reduce<number>((s, v) => s + (v ?? 0), 0))
      : null;
  return {
    income: round(income),
    expenses: round(spending),
    spending: round(spending),
    transfers: round(transfers),
    remittances: round(remittances),
    savings: round(savings),
    refunds: round(refunds),
    debtPayments: round(debtPayments),
    netCashFlow: round(income + refunds - spending),
    availableCash,
    byCategory: Object.fromEntries(
      Object.entries(byCategory).map(([k, v]) => [k, round(v)]),
    ),
  };
}
export function accuracy(correct: number, attempted: number): number | null {
  if (attempted <= 0) return null;
  if (correct < 0 || correct > attempted)
    throw new Error(
      "Correct answers must be between zero and attempted questions.",
    );
  return round((correct / attempted) * 100);
}
export function trainingVolume(records: AppRecord[]): number {
  return uniqueRecords(records)
    .filter((r) => r.kind === "exerciseSet" && r.data.completed === true)
    .reduce((sum, r) => sum + finite(r.data.weight) * finite(r.data.reps), 0);
}
