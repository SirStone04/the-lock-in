import { useState } from "react";
import { fromZonedTime } from "date-fns-tz";
import { Plus } from "lucide-react";
import { useApp } from "../../data/store";
import { num, str } from "../../domain/models";
import type { AppRecord, Data } from "../../domain/models";
import { today } from "../../domain/dates";
import { estimatePay } from "../../domain/calculations";
import { Button, Card, Empty, Field, PageHeader } from "../../components/ui";
import { EntryManager } from "../../components/EntryManager";
import type { FieldSpec } from "../../components/EntryManager";
import {
  money,
  nfield,
  textfield,
  notes,
  metric10,
  Stat,
  usePeriod,
  Chart,
  total,
  average,
  formatAvg,
  dateRows,
} from "./TrackerUI";

export function Employment() {
  const { records } = useApp();
  const profile = records.find((r) => r.id === "settings-profile");
  const weekdayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const workDays = Array.isArray(profile?.data.workDays)
    ? profile.data.workDays.filter(
        (day): day is number =>
          typeof day === "number" &&
          Number.isInteger(day) &&
          day >= 0 &&
          day <= 6,
      )
    : [];
  const targetLow =
    typeof profile?.data.weeklyNetTargetLow === "number"
      ? profile.data.weeklyNetTargetLow
      : null;
  const targetHigh =
    typeof profile?.data.weeklyNetTargetHigh === "number"
      ? profile.data.weeklyNetTargetHigh
      : null;
  const period = usePeriod();
  const shifts = records.filter(
    (r) => r.kind === "shift" && period.includes(r),
  );
  const payroll = records.filter(
    (r) => r.kind === "payroll" && period.includes(r),
  );
  const paidHours = total(shifts, "paidHours");
  const estimates = shifts.map((r) => {
    try {
      return estimatePay(r);
    } catch {
      return null;
    }
  });
  const gross = estimates.reduce((sum, e) => sum + (e?.gross ?? 0), 0);
  const fatigue = average(shifts, "fatigue");
  const fields: FieldSpec[] = [
    textfield("scheduledStart", "Scheduled start · Eastern", {
      type: "datetime-local",
    }),
    textfield("scheduledEnd", "Scheduled end · Eastern", {
      type: "datetime-local",
    }),
    textfield("clockIn", "Clock-in · Eastern", {
      type: "datetime-local",
      required: true,
    }),
    textfield("clockOut", "Clock-out · Eastern", {
      type: "datetime-local",
      required: true,
    }),
    nfield("breakMinutes", "Unpaid breaks · minutes", { default: 0 }),
    nfield("paidHours", "Paid hours · confirmed", { required: true, max: 24 }),
    nfield("standardHours", "Standard hours"),
    nfield("overtimeHours", "Overtime hours"),
    nfield("overtimeMultiplier", "Overtime multiplier · confirmed terms", {
      default: 1.5,
      min: 1,
    }),
    nfield("baseRate", "Base rate · $/hour", {
      required: true,
      ...(typeof profile?.data.baseRate === "number"
        ? { default: profile.data.baseRate }
        : {}),
    }),
    nfield("freezerHours", "Freezer qualifying hours", { default: 0 }),
    nfield("freezerRate", "Freezer premium · $/hour", {
      default: num(profile, "freezerRate"),
    }),
    nfield("nightHours", "Night qualifying hours", { default: 0 }),
    nfield("nightRate", "Night premium · $/hour", {
      default: num(profile, "nightRate"),
    }),
    nfield("palletHours", "Pallet-jack hours"),
    nfield("palletProductivity", "Pallet-jack productivity · %", { max: 300 }),
    nfield("highLiftHours", "High-lift hours"),
    nfield("highLiftProductivity", "High-lift productivity · %", { max: 300 }),
    nfield("otherHours", "Other duty hours"),
    nfield("incentiveRate", "Estimated incentive · $/qualifying pallet hour", {
      default: 0,
    }),
    nfield(
      "actualIncentive",
      "Verified incentive payment · $ · leave blank if unknown",
    ),
    nfield("otherPremium", "Other verified shift premium · $"),
    metric10("energy", "Energy"),
    metric10("fatigue", "Fatigue"),
    notes,
  ];
  const validate = (data: Data, date: string, id?: string) => {
    const begin = String(data.clockIn ?? ""),
      finish = String(data.clockOut ?? "");
    const a = fromZonedTime(begin, "America/New_York").getTime(),
      b = fromZonedTime(finish, "America/New_York").getTime();
    if (
      !Number.isFinite(a) ||
      !Number.isFinite(b) ||
      b <= a ||
      b - a > 24 * 3600000
    )
      return "Enter a valid clock-out after clock-in, within 24 hours. Include the next date for overnight shifts.";
    if (date !== begin.slice(0, 10))
      return "Use the clock-in calendar date for this shift record so weekly hours stay consistent.";
    const paid = (b - a) / 3600000 - Number(data.breakMinutes ?? 0) / 60;
    if (paid < 0 || Math.abs(Number(data.paidHours) - paid) > 0.02)
      return `Clock times and unpaid breaks imply ${Math.max(0, paid).toFixed(2)} paid hours. Correct the paid-hour field or the timestamps.`;
    for (const key of [
      "freezerHours",
      "nightHours",
      "palletHours",
      "highLiftHours",
      "overtimeHours",
      "standardHours",
    ])
      if (Number(data[key] ?? 0) > paid + 0.02)
        return "Qualifying and component hours cannot exceed paid hours.";
    if (
      Number(data.palletHours ?? 0) +
        Number(data.highLiftHours ?? 0) +
        Number(data.otherHours ?? 0) >
      paid + 0.02
    )
      return "Duty hours cannot total more than paid hours.";
    if (
      typeof data.standardHours === "number" &&
      Math.abs(
        Number(data.standardHours) + Number(data.overtimeHours ?? 0) - paid,
      ) > 0.02
    )
      return "Standard plus overtime hours must equal total paid hours. Leave standard hours blank to derive them automatically.";
    const overlap = records.some(
      (r) =>
        r.kind === "shift" &&
        r.id !== id &&
        str(r, "clockIn") &&
        str(r, "clockOut") &&
        fromZonedTime(str(r, "clockIn"), "America/New_York").getTime() < b &&
        fromZonedTime(str(r, "clockOut"), "America/New_York").getTime() > a,
    );
    return overlap
      ? "This shift overlaps an existing logged shift. Edit the existing entry instead."
      : undefined;
  };
  return (
    <div className="section-stack">
      <PageHeader
        eyebrow="EARN WITH INTENTION"
        title="Employment"
        description="Warehouse performance, verified hours, and pay. Your shift is an estimate until payroll confirms it."
        actions={period.control}
      />
      <div className="stats-grid">
        <Stat
          label="Paid hours"
          value={paidHours.toFixed(1)}
          detail={`${shifts.length} logged shifts`}
        />
        <Stat
          label="Estimated gross"
          value={money(gross)}
          detail="Not spendable cash"
        />
        <Stat
          label="Net payroll received"
          value={money(total(payroll, "net"))}
          detail="Paycheck records only"
        />
        <Stat
          label="Shift fatigue"
          value={formatAvg(fatigue, " / 10")}
          detail="Subjective, actual logs"
        />
      </div>
      <div className="grid-2">
        <Chart
          title="Hours and fatigue"
          rows={dateRows(shifts, ["paidHours", "fatigue"])}
          series={[
            { key: "paidHours", label: "Paid hours" },
            { key: "fatigue", label: "Fatigue / 10" },
          ]}
        />
        <Card>
          <h3>Sustainable work comes first</h3>
          <p className="muted">
            {workDays.length
              ? `${workDays.map((day) => weekdayNames[day]).join(", ")}${str(profile, "shiftStart") ? ` · planned start ${str(profile, "shiftStart")}` : ""}.`
              : "No regular workdays configured. Manage fixed shifts in Weekly Planner."}
            {typeof profile?.data.paidHoursTarget === "number" &&
              ` ${profile.data.paidHoursTarget} paid hours per shift is an adjustable target, not confirmed actual time.`}
          </p>
          <p>
            {fatigue !== null && fatigue >= 8
              ? "Your logged fatigue is high. Protect sleep and review shift sustainability before adding optional work or training."
              : "Compare actual fatigue and sleep before judging whether the schedule is sustainable."}
          </p>
          <div className="notice">
            <strong>
              {targetLow === null && targetHigh === null
                ? "Weekly income target not set"
                : `Weekly net income target: ${targetLow !== null ? money(targetLow) : "unset"}${targetHigh !== null ? `–${money(targetHigh)}` : ""}`}
            </strong>
            <p className="muted">
              {targetLow === null && targetHigh === null
                ? "Import your private profile or enter personal targets in your account. No earnings target is assumed."
                : "Review actual deposited payroll against your private target."}
              {typeof profile?.data.projectedWeeklyNet === "number" &&
                ` The ${money(profile.data.projectedWeeklyNet)} weekly projection is unverified.`}
            </p>
          </div>
          <p className="muted small">
            Historical pay references are private records below. They are
            excluded from wages, deposits, and consistency XP.
          </p>
        </Card>
      </div>
      {estimates.some((e) => e === null) && (
        <p className="error" role="alert">
          Some stored shifts contain invalid hours and were excluded from pay
          estimates. Correct the source entries below.
        </p>
      )}
      {estimates.some((estimate) =>
        estimate?.warnings.some((warning) =>
          warning.includes("rate is not entered"),
        ),
      ) && (
        <p className="notice">
          Some shifts have missing pay or premium rates. Their estimates exclude
          those amounts until the source entries are corrected.
        </p>
      )}
      <EntryManager
        kind="shift"
        title="Shift log"
        fields={fields}
        description="Use the clock-in date. Enter actual clock times and paid hours. Overtime and premium eligibility must be confirmed; incentives remain configurable estimates."
        validate={validate}
      />
      <EntryManager
        kind="settings"
        title="Historical payroll references"
        filter={(r) => r.data.type === "historicalPayroll"}
        defaults={{ type: "historicalPayroll" }}
        description="Import your separately supplied private baseline or enter a historical reference. Actual paycheck deposits belong in Payroll; these reference values never count as income."
        fields={[
          nfield("paidHours", "Paid hours"),
          nfield("baseRate", "Base rate · $/hour"),
          nfield("freezerRate", "Freezer premium rate"),
          nfield("nightRate", "Night premium rate"),
          nfield("incentive", "Incentive paid · $"),
          nfield("gross", "Gross · $"),
          nfield("deductions", "Deductions · $"),
          nfield("net", "Take-home · $"),
          notes,
        ]}
      />
      <PayrollLedger />
    </div>
  );
}

function PayrollLedger() {
  const { records, save, remove } = useApp();
  const [editing, setEditing] = useState<AppRecord | null>(null);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today());
  const [gross, setGross] = useState("");
  const [deductions, setDeductions] = useState("");
  const [net, setNet] = useState("");
  const [account, setAccount] = useState("");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const payrolls = records
    .filter((r) => r.kind === "payroll")
    .sort((a, b) => b.date.localeCompare(a.date));
  const accounts = records.filter((r) => r.kind === "account");
  function edit(r: AppRecord | null) {
    setEditing(r);
    setDate(r?.date ?? today());
    setGross(r ? String(num(r, "gross")) : "");
    setDeductions(r ? String(num(r, "deductions")) : "");
    setNet(r ? String(num(r, "net")) : "");
    setAccount(str(r ?? undefined, "accountId"));
    setReference(str(r ?? undefined, "reference"));
    setOpen(true);
    setError("");
  }
  async function linkDeposit(id: string, recordDate: string, values: Data) {
    const existing = records.find((r) => r.id === `paycheck-income-${id}`);
    await save({
      id: `paycheck-income-${id}`,
      kind: "transaction",
      date: recordDate,
      title: "Warehouse paycheck deposit",
      revision: existing?.revision,
      data: {
        type: "income",
        category: "Paycheck",
        amount: Number(values.net),
        toAccount: String(values.accountId ?? ""),
        payrollId: id,
        reference: String(values.reference ?? ""),
      },
    });
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (
        ![gross, deductions, net].every(
          (x) => x !== "" && Number.isFinite(Number(x)) && Number(x) >= 0,
        )
      )
        throw new Error(
          "Enter nonnegative gross, deductions, and actual deposited net pay.",
        );
      if (Math.abs(Number(gross) - Number(deductions) - Number(net)) > 0.02)
        throw new Error("Gross minus deductions must equal actual net pay.");
      if (date > today())
        throw new Error(
          "Paycheck income must be an actual deposit. Future expectations belong in your plan.",
        );
      if (
        payrolls.some(
          (r) =>
            r.id !== editing?.id &&
            r.date === date &&
            num(r, "net") === Number(net) &&
            str(r, "reference") === reference.trim(),
        )
      )
        throw new Error(
          "A matching paycheck already exists. Edit that entry, or use a distinct reference for a separate paycheck.",
        );
      const id = editing?.id ?? crypto.randomUUID();
      const values: Data = {
        gross: Number(gross),
        deductions: Number(deductions),
        net: Number(net),
        accountId: account,
        reference: reference.trim(),
      };
      await save({
        id,
        kind: "payroll",
        date,
        title: "Warehouse paycheck",
        revision: editing?.revision,
        data: values,
      });
      await linkDeposit(id, date, values);
      setOpen(false);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to save payroll. If a paycheck saved without a deposit, use Repair deposit below.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function removePay(r: AppRecord) {
    if (
      !window.confirm("Delete this paycheck and its linked income transaction?")
    )
      return;
    try {
      await remove(`paycheck-income-${r.id}`);
      await remove(r.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Delete failed.");
    }
  }
  return (
    <Card>
      <div className="section-heading">
        <div>
          <h3>Actual paychecks</h3>
          <p className="muted">
            Saving a paycheck creates one linked income transaction. Editing
            updates that same deposit.
          </p>
        </div>
        <Button onClick={() => edit(null)}>
          <Plus size={16} /> Add paycheck
        </Button>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {open && (
        <form onSubmit={submit} className="section-stack">
          <div className="form-grid">
            <Field label="Deposit date">
              <input
                type="date"
                value={date}
                required
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
            <Field label="Gross pay · $">
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={gross}
                onChange={(e) => setGross(e.target.value)}
              />
            </Field>
            <Field label="Deductions · $">
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={deductions}
                onChange={(e) => setDeductions(e.target.value)}
              />
            </Field>
            <Field label="Actual net deposit · $">
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={net}
                onChange={(e) => setNet(e.target.value)}
              />
            </Field>
            <Field label="Deposited to">
              <select
                value={account}
                onChange={(e) => setAccount(e.target.value)}
              >
                <option value="">
                  Unassigned · not included in account balance
                </option>
                {accounts.map((r) => (
                  <option value={r.id} key={r.id}>
                    {r.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Paycheck reference">
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Optional pay-period or reference"
              />
            </Field>
          </div>
          <div className="button-row">
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save paycheck + deposit"}
            </Button>
            <Button
              variant="ghost"
              type="button"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
      {!payrolls.length && !open && (
        <Empty
          title="No paychecks recorded"
          description="Log the actual take-home deposit here. Shift earnings never create spendable income automatically."
        />
      )}
      {payrolls.map((r) => (
        <div className="record-row" key={r.id}>
          <div>
            <strong>{money(num(r, "net"))} net</strong>
            <p className="muted">
              {r.date} · {money(num(r, "gross"))} gross ·{" "}
              {money(num(r, "deductions"))} deductions
            </p>
            {!records.some((t) => t.id === `paycheck-income-${r.id}`) && (
              <Button
                variant="secondary"
                onClick={() =>
                  linkDeposit(r.id, r.date, r.data).catch((cause) =>
                    setError(String(cause)),
                  )
                }
              >
                Repair missing deposit
              </Button>
            )}
          </div>
          <div className="button-row">
            <Button variant="ghost" onClick={() => edit(r)}>
              Edit
            </Button>
            <Button variant="danger" onClick={() => removePay(r)}>
              Delete
            </Button>
          </div>
        </div>
      ))}
    </Card>
  );
}
