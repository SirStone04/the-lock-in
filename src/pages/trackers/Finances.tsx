import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowRightLeft, Plus, Receipt } from "lucide-react";
import { useApp } from "../../data/store";
import { bool, num, str } from "../../domain/models";
import type { AppRecord, Data } from "../../domain/models";
import { today, weekStart, weekEnd } from "../../domain/dates";
import { accountBalance, financialTotals } from "../../domain/calculations";
import { Button, Card, Empty, Field, PageHeader } from "../../components/ui";
import { EntryManager } from "../../components/EntryManager";
import {
  money,
  nfield,
  textfield,
  check,
  notes,
  Stat,
  usePeriod,
  Chart,
  total,
} from "./TrackerUI";

const financeCategories = [
  "Rent",
  "Car payment",
  "Car insurance",
  "Fuel",
  "Phone",
  "Groceries",
  "Dining",
  "Gym",
  "Education",
  "Healthcare",
  "Family support",
  "Debt payments",
  "Personal maintenance",
  "Entertainment",
  "Other",
  "Paycheck",
];

export function Finances() {
  const { records } = useApp();
  const [tab, setTab] = useState("transactions");
  const period = usePeriod();
  const transactions = records.filter(
    (r) => r.kind === "transaction" && period.includes(r),
  );
  const sum = (types: string[]) =>
    transactions
      .filter((r) => types.includes(str(r, "type")))
      .reduce((v, r) => v + num(r, "amount"), 0);
  const totals = financialTotals(records, period.start, period.end);
  const income = totals.income;
  const refunds = totals.refunds;
  const spending = totals.spending;
  const accounts = records.filter((r) => r.kind === "account");
  const balances = accounts.map((r) => accountBalance(r, records));
  const available = financialTotals(records).availableCash;
  const unassigned = records.filter(
    (r) =>
      r.kind === "transaction" &&
      (["income", "refund"].includes(str(r, "type"))
        ? !accounts.some((a) => a.id === str(r, "toAccount"))
        : str(r, "type") === "transfer"
          ? !accounts.some((a) => a.id === str(r, "fromAccount")) ||
            !accounts.some((a) => a.id === str(r, "toAccount"))
          : !accounts.some((a) => a.id === str(r, "fromAccount"))),
  );
  const bills = records.filter((r) => r.kind === "bill" && !bool(r, "paid"));
  const budgets = records.filter(
    (r) =>
      r.kind === "budget" &&
      r.date >= weekStart(today()) &&
      r.date <= weekEnd(today()),
  );
  const allocated = total(budgets, "amount");
  const categorized = financeCategories
    .map((category) => ({
      date: category,
      amount: transactions
        .filter(
          (r) =>
            str(r, "category") === category &&
            ["expense", "remittance", "debt"].includes(str(r, "type")),
        )
        .reduce((v, r) => v + num(r, "amount"), 0),
    }))
    .filter((r) => r.amount > 0);
  const monthly = useMemo(() => {
    const groups = new Map<
      string,
      { date: string; income: number; spending: number }
    >();
    for (const r of records.filter((r) => r.kind === "transaction")) {
      const key = r.date.slice(0, 7),
        row = groups.get(key) ?? { date: key, income: 0, spending: 0 };
      const type = str(r, "type");
      if (type === "income") row.income += num(r, "amount");
      if (["expense", "remittance", "debt"].includes(type))
        row.spending += num(r, "amount");
      if (type === "refund") row.spending -= num(r, "amount");
      groups.set(key, row);
    }
    return [...groups.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [records]);
  return (
    <div className="section-stack">
      <PageHeader
        eyebrow="FINANCIAL CONTROL"
        title="Finances"
        description="A manual cash ledger. Verified deposits and actual outflows keep your plan grounded."
        actions={period.control}
      />
      <div className="stats-grid">
        <Stat
          label="Actual income"
          value={money(income)}
          detail="Deposits only"
        />
        <Stat
          label="Outflows"
          value={money(spending)}
          detail={`${money(refunds)} refunds · transfers excluded`}
        />
        <Stat
          label="Net cash flow"
          value={money(income + refunds - spending)}
          detail="Received − spent + refunds"
        />
        <Stat
          label="Reconciled cash"
          value={available === null ? "Unreconciled" : money(available)}
          detail="All accounts need an end-of-day snapshot"
        />
      </div>
      <div className="grid-2">
        <Chart
          title="Monthly cash flow · actual records"
          kind="bar"
          rows={monthly}
          series={[
            { key: "income", label: "Income · $" },
            { key: "spending", label: "Net outflows · $" },
          ]}
        />
        <Card>
          <h3>Give each dollar a job</h3>
          <div className="record-row">
            <span>Outstanding bills</span>
            <strong>{money(total(bills, "amount"))}</strong>
          </div>
          <div className="record-row">
            <span>Current weekly allocations</span>
            <strong>{money(allocated)}</strong>
          </div>
          <div className="record-row">
            <span>Unallocated reconciled cash</span>
            <strong>
              {available === null ? "Unknown" : money(available - allocated)}
            </strong>
          </div>
          <div className="record-row">
            <span>Family remittances · selected period</span>
            <strong>{money(sum(["remittance"]))}</strong>
          </div>
          <div className="record-row">
            <span>Internal savings transfers</span>
            <strong>
              {money(
                transactions
                  .filter(
                    (r) => str(r, "type") === "transfer" && bool(r, "savings"),
                  )
                  .reduce((v, r) => v + num(r, "amount"), 0),
              )}
            </strong>
          </div>
          <p className="muted">
            Forecast wages are excluded. Internal transfers never count as
            spending. A transfer to another person belongs under family
            remittance or expense.
          </p>
        </Card>
      </div>
      {unassigned.length > 0 && (
        <p className="warning" role="status">
          {unassigned.length} transaction{unassigned.length === 1 ? "" : "s"}{" "}
          have an unassigned or removed account. Assign them or reconcile
          balances through their dates before relying on available cash.
        </p>
      )}
      <div className="tabs" role="group" aria-label="Financial records">
        {[
          ["transactions", "Transactions"],
          ["accounts", "Accounts"],
          ["budgets", "Budgets"],
          ["bills", "Bills"],
          ["debts", "Debt"],
        ].map(([value, label]) => (
          <Button
            key={value}
            variant={tab === value ? "primary" : "ghost"}
            onClick={() => setTab(value)}
          >
            {label}
          </Button>
        ))}
      </div>
      {tab === "transactions" && <TransactionLedger />}
      {tab === "accounts" && (
        <>
          <div className="grid-2">
            {accounts.map((r, i) => (
              <Stat
                key={r.id}
                label={r.title}
                value={
                  balances[i] === null ? "Unreconciled" : money(balances[i]!)
                }
                detail={`Snapshot through ${str(r, "reconciledThrough") || "not set"}`}
              />
            ))}
          </div>
          <EntryManager
            kind="account"
            title="Financial accounts"
            description="Enter the actual end-of-day balance and the date through which all activity is included. Only later-dated transactions change this snapshot. Reconcile again after correcting an earlier transaction."
            fields={[
              {
                key: "type",
                label: "Account type",
                type: "select",
                options: [
                  "Checking",
                  "Savings",
                  "Cash",
                  "Emergency fund",
                  "Other",
                ],
              },
              nfield("reconciledBalance", "Actual end-of-day balance · $", {
                min: -1000000,
              }),
              textfield(
                "reconciledThrough",
                "Balance includes transactions through",
                { type: "date" },
              ),
              check(
                "reconciled",
                "I verified this balance and date against my records",
              ),
              notes,
            ]}
          />
        </>
      )}
      {tab === "budgets" && (
        <EntryManager
          kind="budget"
          title="Weekly zero-based budget"
          description="Use the Sunday week-start date. Set one allocation per category; adjust allocations when income or obligations change. Carryover is reconciled available cash, not predicted wages."
          fields={[
            {
              key: "category",
              label: "Category",
              type: "select",
              options: [
                ...financeCategories,
                "Emergency savings",
                "Carryover",
                "Unallocated",
              ],
            },
            nfield("amount", "Allocated amount · $", { required: true }),
            notes,
          ]}
        />
      )}
      {tab === "bills" && (
        <EntryManager
          kind="bill"
          title="Bills and obligations"
          description="The record date is the next due date. Marking paid tracks the obligation; log the actual outflow separately in Transactions."
          fields={[
            nfield("amount", "Amount due · $", { required: true }),
            {
              key: "category",
              label: "Category",
              type: "select",
              options: financeCategories,
            },
            {
              key: "recurrence",
              label: "Repeat",
              type: "select",
              options: ["None", "Weekly", "Monthly", "Quarterly", "Yearly"],
            },
            check("paid", "Paid"),
            textfield("paidDate", "Paid date", { type: "date" }),
            notes,
          ]}
        />
      )}
      {tab === "debts" && (
        <EntryManager
          kind="debt"
          title="Debt balances"
          description="Balance records are manual snapshots. Log each payment once as a debt transaction and split principal and interest there."
          fields={[
            nfield("balance", "Remaining balance · $", { required: true }),
            nfield("minimumPayment", "Minimum payment · $"),
            nfield("apr", "APR · %", { max: 100 }),
            textfield("dueDate", "Next payment due", { type: "date" }),
            notes,
          ]}
        />
      )}
      {categorized.length > 0 && (
        <Chart
          title="Outflows by category · selected period"
          kind="bar"
          rows={categorized}
          series={[{ key: "amount", label: "Actual outflows · $" }]}
        />
      )}
    </div>
  );
}

function TransactionLedger() {
  const { records, save, remove } = useApp();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AppRecord | null>(null);
  const [date, setDate] = useState(today());
  const [title, setTitle] = useState("");
  const [type, setType] = useState("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Other");
  const [fromAccount, setFrom] = useState("");
  const [toAccount, setTo] = useState("");
  const [principal, setPrincipal] = useState("");
  const [interest, setInterest] = useState("");
  const [isSavings, setSavings] = useState(false);
  const [memo, setMemo] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const accounts = records.filter((r) => r.kind === "account");
  const transactions = records
    .filter(
      (r) =>
        r.kind === "transaction" &&
        `${r.title} ${r.date} ${str(r, "category")} ${str(r, "notes")}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  function edit(r: AppRecord | null) {
    setEditing(r);
    setDate(r?.date ?? today());
    setTitle(r?.title ?? "");
    setType(str(r ?? undefined, "type", "expense"));
    setAmount(r ? String(num(r, "amount")) : "");
    setCategory(str(r ?? undefined, "category", "Other"));
    setFrom(str(r ?? undefined, "fromAccount"));
    setTo(str(r ?? undefined, "toAccount"));
    setPrincipal(
      r && typeof r.data.principal === "number"
        ? String(num(r, "principal"))
        : "",
    );
    setInterest(
      r && typeof r.data.interest === "number"
        ? String(num(r, "interest"))
        : "",
    );
    setSavings(bool(r ?? undefined, "savings"));
    setMemo(str(r ?? undefined, "notes"));
    setOpen(true);
    setError("");
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const value = Number(amount);
      if (!Number.isFinite(value) || value <= 0)
        throw new Error("Enter an actual amount greater than zero.");
      if (date > today())
        throw new Error(
          "Transactions record actual activity. Put future amounts in Budgets or Bills instead.",
        );
      if (
        type === "transfer" &&
        (!fromAccount || !toAccount || fromAccount === toAccount)
      )
        throw new Error(
          "Choose two different accounts for an internal transfer.",
        );
      if (
        type === "debt" &&
        (principal === "" ||
          interest === "" ||
          Math.abs(Number(principal) + Number(interest) - value) > 0.02)
      )
        throw new Error(
          "Debt principal plus interest must equal the payment amount.",
        );
      const data: Data = {
        type,
        amount: Math.round(value * 100) / 100,
        category,
        fromAccount: ["expense", "remittance", "debt", "transfer"].includes(
          type,
        )
          ? fromAccount
          : "",
        toAccount: ["income", "refund", "transfer"].includes(type)
          ? toAccount
          : "",
        savings: type === "transfer" && isSavings,
        notes: memo,
      };
      if (type === "debt") {
        data.principal = Number(principal);
        data.interest = Number(interest);
      }
      await save({
        id: editing?.id ?? crypto.randomUUID(),
        kind: "transaction",
        date,
        title: title.trim(),
        revision: editing?.revision,
        data,
      });
      setOpen(false);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to save transaction.",
      );
    } finally {
      setBusy(false);
    }
  }
  const accountSelect = (value: string, onChange: (s: string) => void) => (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Unassigned</option>
      {accounts.map((a) => (
        <option key={a.id} value={a.id}>
          {a.title}
        </option>
      ))}
    </select>
  );
  const typeLabel: Record<string, string> = {
    income: "Income received",
    expense: "Expense",
    transfer: "Internal transfer",
    refund: "Refund received",
    remittance: "Family remittance",
    debt: "Debt payment",
  };
  return (
    <Card>
      <div className="section-heading">
        <div>
          <h3>Transaction ledger</h3>
          <p className="muted">
            Amounts are actual dollars. No bank connection is implied. Manage
            paycheck deposits in Employment.
          </p>
        </div>
        <Button onClick={() => edit(null)}>
          <Plus size={16} /> Log transaction
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
            <Field label="Date">
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
            <Field label="Description">
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What was this for?"
              />
            </Field>
            <Field label="Type">
              <select value={type} onChange={(e) => setType(e.target.value)}>
                {Object.entries(typeLabel).map(([k, v]) => (
                  <option value={k} key={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Actual amount · $">
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>
            <Field label="Category">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {financeCategories.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </Field>
            {["expense", "remittance", "debt", "transfer"].includes(type) && (
              <Field label="From account">
                {accountSelect(fromAccount, setFrom)}
              </Field>
            )}
            {["income", "refund", "transfer"].includes(type) && (
              <Field label="To account">
                {accountSelect(toAccount, setTo)}
              </Field>
            )}
            {type === "debt" && (
              <>
                <Field label="Principal · $">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={principal}
                    onChange={(e) => setPrincipal(e.target.value)}
                  />
                </Field>
                <Field label="Interest · $">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={interest}
                    onChange={(e) => setInterest(e.target.value)}
                  />
                </Field>
              </>
            )}
            {type === "transfer" && (
              <Field label="Savings contribution">
                <input
                  type="checkbox"
                  checked={isSavings}
                  onChange={(e) => setSavings(e.target.checked)}
                />
              </Field>
            )}
            <Field label="Notes">
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
              />
            </Field>
          </div>
          <div className="button-row">
            <Button disabled={busy} type="submit">
              {busy ? "Saving…" : "Save transaction"}
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
      <Field label="Search transactions">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search description, category, date…"
        />
      </Field>
      {!transactions.length && !open && (
        <Empty
          title="A clear ledger starts with one entry"
          description="Log an actual deposit, expense, or transfer. Expected wages stay in Employment."
        />
      )}
      {transactions.map((r) => (
        <div className="record-row" key={r.id}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {str(r, "type") === "transfer" ? (
              <ArrowRightLeft size={20} />
            ) : ["income", "refund"].includes(str(r, "type")) ? (
              <ArrowDownLeft size={20} />
            ) : (
              <Receipt size={20} />
            )}
            <div>
              <strong>{r.title}</strong>
              <p className="muted">
                {r.date} · {typeLabel[str(r, "type")] ?? str(r, "type")} ·{" "}
                {str(r, "category")}
              </p>
              {str(r, "payrollId") && (
                <small className="muted">
                  Linked paycheck · edit in Employment
                </small>
              )}
            </div>
          </div>
          <div className="button-row">
            <strong>{money(num(r, "amount"))}</strong>
            {!str(r, "payrollId") && (
              <>
                <Button variant="ghost" onClick={() => edit(r)}>
                  Edit
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    if (window.confirm("Delete this transaction?"))
                      remove(r.id).catch((cause) => setError(String(cause)));
                  }}
                >
                  Delete
                </Button>
              </>
            )}
          </div>
        </div>
      ))}
    </Card>
  );
}
