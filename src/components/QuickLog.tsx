import { useRef, useState } from "react";
import { useApp } from "../data/store";
import { today } from "../domain/dates";
import { financialTotals } from "../domain/calculations";
import { Modal, Field, Button } from "./ui";
import { num, str } from "../domain/models";
export default function QuickLog({
  onClose,
  closeDay = false,
}: {
  onClose: () => void;
  closeDay?: boolean;
}) {
  const { records, save } = useApp();
  const [date, setDate] = useState(today());
  // Retain the revision presented when editing began; live updates must not silently
  // replace the expected revision while uncontrolled form fields still show old data.
  const [formRecords, setFormRecords] = useState(records);
  const existing = formRecords.find(
    (r) => r.kind === "daily" && r.date === date,
  );
  const sleep = formRecords.find((r) => r.kind === "sleep" && r.date === date);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const transactionId = useRef(crypto.randomUUID());
  const money = financialTotals(records, date, date);
  const accounts = records.filter((r) => r.kind === "account");
  const faith = formRecords.find((r) => r.id === `faith-${date}`),
    nutrition = formRecords.find((r) => r.id === `nutrition-${date}`),
    skin = formRecords.find((r) => r.id === `skincare-${date}`);
  function numberDefault(key: string): number | string {
    const current =
      key === "hydration"
        ? nutrition?.data.water
        : key === "sleepHours"
          ? sleep?.data.sleepHours
          : key === "sleepQuality"
            ? sleep?.data.quality
            : ["energy", "fatigue"].includes(key)
              ? sleep?.data[key]
              : undefined;
    return typeof current === "number"
      ? current
      : typeof existing?.data[key] === "number"
        ? (existing.data[key] as number)
        : "";
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    try {
      const amount = Number(fd.get("txAmount") || 0);
      if (amount > 0) {
        const old = records.find((r) => r.id === transactionId.current);
        const type = String(fd.get("txType"));
        await save({
          id: transactionId.current,
          revision: old?.revision,
          kind: "transaction",
          date,
          title: String(fd.get("txTitle") || "Daily check-in transaction"),
          data: {
            ...old?.data,
            type,
            amount,
            category: String(fd.get("txCategory") || "Other"),
            fromAccount: ["expense", "remittance"].includes(type)
              ? String(fd.get("txAccount") || "")
              : "",
            toAccount: ["income", "refund"].includes(type)
              ? String(fd.get("txAccount") || "")
              : "",
          },
        });
      }
      const data = { ...existing?.data };
      for (const key of [
        "sleepHours",
        "sleepQuality",
        "energy",
        "fatigue",
        "workHours",
        "incentiveHours",
        "educationMinutes",
        "workoutPerformance",
        "hydration",
      ]) {
        const raw = fd.get(key);
        data[key] = raw === "" ? null : Number(raw);
      }
      for (const key of [
        "prayer",
        "scripture",
        "breakfast",
        "lunch",
        "dinner",
        "skincareAM",
        "skincarePM",
        "checkInCompleted",
      ])
        data[key] = fd.has(key);
      data.faith = fd.has("prayer") && fd.has("scripture");
      for (const key of ["notes", "win", "difficulty", "reflection"])
        data[key] = String(fd.get(key) ?? "");
      data.reflectionCompleted =
        String(fd.get("reflection") ?? "").trim().length > 0;
      data.closed = closeDay || existing?.data.closed === true;
      await save({
        id: `faith-${date}`,
        revision: faith?.revision,
        kind: "faith",
        date,
        title: `Time with God · ${date}`,
        data: {
          ...faith?.data,
          prayer: fd.has("prayer"),
          scripture: fd.has("scripture"),
        },
      });
      await save({
        id: `nutrition-${date}`,
        revision: nutrition?.revision,
        kind: "nutrition",
        date,
        title: `Daily fueling · ${date}`,
        data: {
          ...nutrition?.data,
          breakfast: fd.has("breakfast"),
          lunch: fd.has("lunch"),
          dinner: fd.has("dinner"),
          ...(fd.get("hydration") !== ""
            ? { water: Number(fd.get("hydration")) }
            : {}),
        },
      });
      await save({
        id: `skincare-${date}`,
        revision: skin?.revision,
        kind: "skincare",
        date,
        title: `Daily skin routine · ${date}`,
        data: {
          ...skin?.data,
          am: fd.has("skincareAM"),
          pm: fd.has("skincarePM"),
        },
      });
      await save({
        id: existing?.id ?? `daily-${date}`,
        revision: existing?.revision,
        kind: "daily",
        date,
        title: `Daily check-in · ${date}`,
        data,
      });
      if (fd.get("sleepHours") !== "")
        await save({
          id: sleep?.id ?? `sleep-${date}`,
          revision: sleep?.revision,
          kind: "sleep",
          date,
          title: "Sleep & recovery",
          data: {
            ...sleep?.data,
            sleepHours: Number(fd.get("sleepHours")),
            quality:
              fd.get("sleepQuality") === ""
                ? null
                : Number(fd.get("sleepQuality")),
            energy: fd.get("energy") === "" ? null : Number(fd.get("energy")),
            fatigue:
              fd.get("fatigue") === "" ? null : Number(fd.get("fatigue")),
          },
        });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={closeDay ? "Close my day" : "Daily check-in"}
      onClose={onClose}
    >
      <p className="muted">
        Save a partial check-in at any time. Your missions, transactions,
        shifts, and workouts remain independent records.
      </p>
      <Field label="Tracking date">
        <input
          type="date"
          value={date}
          onChange={(e) => {
            setFormRecords(records);
            setDate(e.target.value);
          }}
        />
      </Field>
      <form className="form-grid" key={date} onSubmit={submit}>
        {[
          ["sleepHours", "Actual sleep (hours)", 0, 24],
          ["sleepQuality", "Sleep quality (1–10)", 1, 10],
          ["energy", "Energy (1–10)", 1, 10],
          ["fatigue", "Fatigue (1–10)", 1, 10],
          ["workHours", "Self-reported paid hours", 0, 24],
          ["incentiveHours", "Self-reported incentive hours", 0, 24],
          ["educationMinutes", "Self-reported study (minutes)", 0, 1440],
          ["workoutPerformance", "Workout effort (1–10)", 1, 10],
          ["hydration", "Water (oz)", 0, 400],
        ].map(([key, label, min, max]) => (
          <Field key={key} label={String(label)}>
            <input
              name={String(key)}
              type="number"
              min={Number(min)}
              max={Number(max)}
              step="any"
              defaultValue={numberDefault(String(key))}
            />
          </Field>
        ))}
        <div className="full checkbox-grid">
          {[
            ["prayer", "Prayer completed"],
            ["scripture", "Scripture read"],
            ["breakfast", "Breakfast"],
            ["lunch", "Lunch"],
            ["dinner", "Dinner"],
            ["skincareAM", "AM skincare"],
            ["skincarePM", "PM skincare"],
            ["checkInCompleted", "Check-in is complete (10 points)"],
          ].map(([key, label]) => (
            <label className="check-option" key={key}>
              <input
                type="checkbox"
                name={key}
                defaultChecked={
                  ["prayer", "scripture"].includes(key) && faith
                    ? faith.data[key] === true
                    : ["breakfast", "lunch", "dinner"].includes(key) &&
                        nutrition
                      ? nutrition.data[key] === true
                      : key === "skincareAM" && skin
                        ? skin.data.am === true
                        : key === "skincarePM" && skin
                          ? skin.data.pm === true
                          : existing?.data[key] === true
                }
              />
              {label}
            </label>
          ))}
        </div>
        {[
          ["win", "Biggest win"],
          ["difficulty", "Biggest difficulty"],
          ["notes", "Personal notes"],
          ["reflection", "Daily reflection (10 points when recorded)"],
        ].map(([key, label]) => (
          <Field label={label} key={key}>
            <textarea name={key} defaultValue={str(existing, key)} rows={2} />
          </Field>
        ))}
        <div className="full">
          <h3>Money received & spent</h3>
          <div className="grid-2">
            <Field label="Actual income received today">
              <input
                readOnly
                value={`$${money.income.toFixed(2)}`}
                aria-label="Actual income received today"
              />
            </Field>
            <Field label="Actual spending today">
              <input
                readOnly
                value={`$${money.spending.toFixed(2)}`}
                aria-label="Actual spending today"
              />
            </Field>
          </div>
          <details>
            <summary>Add a new financial transaction</summary>
            <p className="muted small">
              Enter one new money movement. It creates a separate ledger entry;
              the daily totals above already include earlier entries.
            </p>
            <div className="form-grid">
              <Field label="New transaction amount ($)">
                <input name="txAmount" type="number" min="0" step="0.01" />
              </Field>
              <Field label="Transaction type">
                <select name="txType">
                  <option value="expense">Expense</option>
                  <option value="income">Income received</option>
                  <option value="refund">Refund</option>
                  <option value="remittance">Family remittance</option>
                </select>
              </Field>
              <Field label="Description">
                <input
                  name="txTitle"
                  placeholder="Groceries, paycheck, fuel…"
                />
              </Field>
              <Field label="Category">
                <select name="txCategory">
                  {[
                    "Other",
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
                    "Paycheck",
                  ].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Account (optional)">
                <select name="txAccount">
                  <option value="">Unassigned</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </details>
        </div>
        <p className="muted small full">
          Self-reported work and study here provide context; use their dedicated
          logs for verified totals.
        </p>
        {error && (
          <p role="alert" className="error full">
            {error}
          </p>
        )}
        <div className="form-actions full">
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy
              ? "Saving…"
              : closeDay
                ? "Save & generate briefing"
                : "Save check-in"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
