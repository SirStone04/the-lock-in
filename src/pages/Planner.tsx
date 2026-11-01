import { useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  Copy,
  FileDown,
  Plus,
  Upload,
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  Trash2,
} from "lucide-react";
import { useApp } from "../data/store";
import { Button, Card, Field, Modal, PageHeader } from "../components/ui";
import { categories, type AppRecord, type RecordInput } from "../domain/models";
import {
  addDays,
  formatDate,
  today,
  weekDates,
  weekStart,
} from "../domain/dates";
import {
  emptyPlan,
  planningPrompt,
  previewPlan,
  scheduleConflicts,
  validatePlan,
  type WeeklyPlan,
  type PlanTask,
} from "../domain/planning";
import { buildWeeklyReport, downloadText } from "../domain/reports";
import PlannerRoutines from "./PlannerRoutines";

export default function Planner() {
  const { records, save, remove } = useApp();
  const [selected, setSelected] = useState(weekStart(today()));
  const [goals, setGoals] = useState<string[] | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<string[] | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [json, setJson] = useState("");
  const [preview, setPreview] = useState<WeeklyPlan | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [task, setTask] = useState<AppRecord | null | undefined>();
  const [carry, setCarry] = useState<AppRecord | null>(null);
  const days = weekDates(selected);
  const week = records.find((r) => r.kind === "week" && r.date === selected);
  const currentGoals =
    goals ??
    (Array.isArray(week?.data.goals)
      ? week.data.goals.map(String)
      : emptyPlan(selected).goals);
  const currentNotes = notes ?? String(week?.data.notes ?? "");
  const currentOutcomes =
    outcomes ??
    (Array.isArray(week?.data.goalOutcomes)
      ? week.data.goalOutcomes.map(String)
      : ["", "", ""]);
  const missions = records.filter(
    (r) =>
      r.kind === "mission" &&
      r.date >= selected &&
      r.date <= addDays(selected, 6),
  );
  const conflicts = useMemo(() => scheduleConflicts(missions), [missions]);
  const changes = preview ? previewPlan(preview, records) : null;
  function changeWeek(value: string) {
    setSelected(weekStart(value));
    setGoals(null);
    setNotes(null);
    setOutcomes(null);
    setMessage("");
  }
  async function saveWeek(finalize: boolean) {
    setBusy(true);
    setMessage("");
    try {
      if (currentGoals.length !== 3 || currentGoals.some((g) => !g.trim()))
        throw new Error("Enter exactly three principal goals.");
      await save({
        id: week?.id ?? `week_${selected}`,
        revision: week?.revision,
        kind: "week",
        date: selected,
        title: `Week of ${selected}`,
        data: {
          ...week?.data,
          startDate: selected,
          endDate: addDays(selected, 6),
          goals: currentGoals,
          goalOutcomes: currentOutcomes,
          notes: currentNotes,
          status: finalize ? "Finalized" : "Draft",
        },
      });
      setMessage(
        finalize
          ? "Weekly plan finalized. Review changes deliberately as the week unfolds."
          : "Draft saved.",
      );
      setGoals(null);
      setNotes(null);
      setOutcomes(null);
    } catch (e) {
      setMessage(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  function parseImport() {
    try {
      const plan = validatePlan(json);
      setPreview(plan);
      setMessage("");
    } catch (e) {
      setPreview(null);
      setMessage(errorText(e));
    }
  }
  async function confirmImport() {
    if (!preview || !changes) return;
    setBusy(true);
    try {
      for (const m of changes.missions) await save(m);
      const existing = records.find(
        (r) => r.kind === "week" && r.date === preview.weekStart,
      );
      await save({
        id: existing?.id ?? `week_${preview.weekStart}`,
        revision: existing?.revision,
        kind: "week",
        date: preview.weekStart,
        title: `Week of ${preview.weekStart}`,
        data: {
          ...existing?.data,
          startDate: preview.weekStart,
          endDate: preview.weekEnd,
          goals: preview.goals,
          goalOutcomes: ["", "", ""],
          notes: preview.notes,
          recoveryRecommendations: preview.recoveryRecommendations,
          status: "Draft",
          importSchemaVersion: 1,
        },
      });
      changeWeek(preview.weekStart);
      setShowImport(false);
      setPreview(null);
      setJson("");
      setMessage(
        `${changes.missions.length} missions imported; ${changes.duplicates.length} existing missions preserved. The plan remains a draft.`,
      );
    } catch (e) {
      setMessage(
        `${errorText(e)} You can retry safely: stable IDs prevent duplicate missions.`,
      );
    } finally {
      setBusy(false);
    }
  }
  async function submitTask(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const fd = new FormData(e.currentTarget);
    const date = String(fd.get("date"));
    try {
      const id = task?.id ?? `manual_${crypto.randomUUID()}`;
      const input: RecordInput = {
        id,
        revision: task?.revision,
        kind: "mission",
        date,
        title: String(fd.get("title")).trim(),
        data: {
          ...task?.data,
          category: String(fd.get("category")),
          priority: Number(fd.get("priority")),
          plannedMinutes: Number(fd.get("plannedMinutes")),
          scheduledTime: String(fd.get("scheduledTime")),
          travelMinutes: Number(fd.get("travelMinutes") || 0),
          target: Number(fd.get("target") || 1),
          actual: task?.data.actual ?? 0,
          status: task?.data.status ?? "Not started",
          notes: String(fd.get("notes")),
          fixed: fd.has("fixed"),
        },
      };
      if (!input.title || Number(input.data.plannedMinutes) < 1)
        throw new Error("A title and positive duration are required.");
      await save(input);
      setTask(undefined);
      setMessage("Mission saved.");
    } catch (error) {
      setMessage(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  async function carryForward(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!carry) return;
    const date = String(new FormData(e.currentTarget).get("newDate"));
    try {
      await save({
        ...carry,
        date,
        data: {
          ...carry.data,
          carriedFrom: carry.date,
          status: "Not started",
          actual: 0,
        },
      });
      setCarry(null);
      setMessage(`Mission deliberately rescheduled to ${date}.`);
    } catch (e) {
      setMessage(errorText(e));
    }
  }
  async function copyPrompt() {
    try {
      const report = buildWeeklyReport(records, addDays(selected, -7));
      await navigator.clipboard.writeText(planningPrompt(report.markdown));
      setMessage(
        "Planning prompt copied. Paste it into your Command Center conversation.",
      );
    } catch {
      setMessage(
        "Clipboard unavailable. Download the report and use the documented plan schema.",
      );
    }
  }
  function exportPlan() {
    const plan: WeeklyPlan = {
      ...emptyPlan(selected),
      goals: currentGoals as [string, string, string],
      notes: currentNotes,
      dailyTasks: missions.map(
        (m) =>
          ({
            id: String(m.id).replace(/[^a-zA-Z0-9_-]/g, "_"),
            title: m.title,
            date: m.date,
            category: categories.includes(
              m.data.category as (typeof categories)[number],
            )
              ? (m.data.category as (typeof categories)[number])
              : "Maintenance",
            priority: Number(m.data.priority) || 2,
            plannedMinutes: Number(m.data.plannedMinutes) || 15,
            ...(m.data.scheduledTime
              ? { scheduledTime: String(m.data.scheduledTime) }
              : {}),
            travelMinutes: Number(m.data.travelMinutes) || 0,
            target: Number(m.data.target) || 1,
            notes: String(m.data.notes ?? ""),
            fixed: m.data.fixed === true,
          }) as PlanTask,
      ),
    };
    downloadText(
      `lock-in-plan-${selected}.json`,
      JSON.stringify(plan, null, 2),
      "application/json",
    );
  }
  return (
    <>
      <PageHeader
        eyebrow="Plan with intention"
        title="Weekly planner"
        description="Three priorities. Realistic commitments. Room to recover."
        actions={
          <>
            <Button onClick={copyPrompt}>
              <Copy size={16} /> Copy planning prompt
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setShowImport(true);
                setMessage("");
              }}
            >
              <Upload size={16} /> Import plan
            </Button>
          </>
        }
      />
      <div className="section-title">
        <div className="row-actions">
          <Button
            aria-label="Previous week"
            onClick={() => changeWeek(addDays(selected, -7))}
          >
            <ArrowLeft size={16} />
          </Button>
          <h2>
            {formatDate(selected, "MMM d")} –{" "}
            {formatDate(addDays(selected, 6), "MMM d, yyyy")}
          </h2>
          <Button
            aria-label="Next week"
            onClick={() => changeWeek(addDays(selected, 7))}
          >
            <ArrowRight size={16} />
          </Button>
        </div>
        <div className="row-actions">
          <Button onClick={() => changeWeek(today())}>This week</Button>
          <Button onClick={exportPlan}>
            <FileDown size={16} /> Export plan
          </Button>
          <Button onClick={() => setTask(null)}>
            <Plus size={16} /> Add mission
          </Button>
        </div>
      </div>
      {message && (
        <div className="notice" role="status">
          {message}
        </div>
      )}
      <Card>
        <div className="section-title">
          <h2>
            <CalendarDays size={18} /> Principal goals
          </h2>
          <span className="badge">
            {String(week?.data.status ?? "Not finalized")}
          </span>
        </div>
        <div className="form-grid">
          {currentGoals.map((goal, i) => (
            <Field key={i} label={`Goal ${i + 1}`}>
              <input
                value={goal}
                maxLength={300}
                onChange={(e) =>
                  setGoals(
                    currentGoals.map((g, index) =>
                      index === i ? e.target.value : g,
                    ),
                  )
                }
              />
            </Field>
          ))}
          {currentOutcomes.map((outcome, i) => (
            <Field
              key={`outcome-${i}`}
              label={`Goal ${i + 1} outcome (review)`}
            >
              <input
                value={outcome}
                onChange={(e) =>
                  setOutcomes(
                    currentOutcomes.map((g, index) =>
                      index === i ? e.target.value : g,
                    ),
                  )
                }
                placeholder="Not recorded yet"
              />
            </Field>
          ))}
          <Field label="Planning notes">
            <textarea
              value={currentNotes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Review last week, sleep, workload, bills and travel…"
            />
          </Field>
        </div>
        <div className="row-actions">
          <Button disabled={busy} onClick={() => saveWeek(false)}>
            Save draft
          </Button>
          <Button
            disabled={busy}
            variant="primary"
            onClick={() => saveWeek(true)}
          >
            <Check size={16} /> Finalize week
          </Button>
        </div>
      </Card>
      {conflicts.length > 0 && (
        <Card>
          <h2>
            <AlertTriangle size={18} /> Review before committing
          </h2>
          <ul>
            {conflicts.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <p className="muted small">
            These warnings help review your plan. Fixed commitments only change
            when you explicitly edit or reschedule them.
          </p>
        </Card>
      )}
      <div className="planner-grid">
        {days.map((day) => (
          <Card key={day}>
            <div className="section-title">
              <div>
                <span className="eyebrow">{formatDate(day, "EEEE")}</span>
                <h3>{formatDate(day, "MMM d")}</h3>
              </div>
              {day === today() && <span className="badge">Today</span>}
            </div>
            {missions.filter((m) => m.date === day).length === 0 ? (
              <p className="muted small">No commitments planned.</p>
            ) : (
              missions
                .filter((m) => m.date === day)
                .sort((a, b) =>
                  String(a.data.scheduledTime ?? "99").localeCompare(
                    String(b.data.scheduledTime ?? "99"),
                  ),
                )
                .map((m) => (
                  <div className="planner-mission" key={m.id}>
                    <span className="muted small">
                      {String(m.data.category)} ·{" "}
                      {String(m.data.scheduledTime || "Flexible")} ·{" "}
                      {String(m.data.plannedMinutes || 0)} min
                      {m.data.fixed ? " · Fixed" : ""}
                    </span>
                    <strong>{m.title}</strong>
                    <span className="small">
                      {String(m.data.status ?? "Not started")}
                    </span>
                    <div className="row-actions">
                      <Button variant="ghost" onClick={() => setTask(m)}>
                        Edit
                      </Button>
                      <Button variant="ghost" onClick={() => setCarry(m)}>
                        Reschedule
                      </Button>
                      <Button
                        variant="ghost"
                        aria-label={`Delete ${m.title}`}
                        onClick={async () => {
                          if (confirm(`Delete planned mission “${m.title}”?`))
                            try {
                              await remove(m.id);
                            } catch (e) {
                              setMessage(errorText(e));
                            }
                        }}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                ))
            )}
          </Card>
        ))}
      </div>
      <PlannerRoutines week={selected} />
      <Card>
        <h2>Sunday planning review</h2>
        <p className="muted">
          Review the previous report, sleep and fatigue, learning progress,
          deposited income and essential bills. Pick three goals, check
          conflicts, then finalize. Unfinished missions remain in history until
          you deliberately reschedule them.
        </p>
      </Card>
      {showImport && (
        <Modal
          title="Import a Command Center plan"
          onClose={() => setShowImport(false)}
        >
          <p className="muted">
            Paste schema version 1 JSON. Validate and review every change before
            importing. No plans are sent to an AI service.
          </p>
          <Field label="Plan JSON">
            <textarea
              rows={12}
              value={json}
              onChange={(e) => {
                setJson(e.target.value);
                setPreview(null);
              }}
              placeholder='{"schemaVersion":1,"weekStart":"2026-11-01",…}'
            />
          </Field>
          <Field label="Or choose a JSON file">
            <input
              type="file"
              accept=".json,application/json"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  if (file.size > 1000000) {
                    setMessage("Plan file must be under 1 MB.");
                    return;
                  }
                  setJson(await file.text());
                  setPreview(null);
                }
              }}
            />
          </Field>
          <Button onClick={parseImport}>Validate and preview</Button>
          {message && (
            <p className="error" role="alert">
              {message}
            </p>
          )}
          {preview && changes && (
            <>
              <h3>
                {preview.weekStart} – {preview.weekEnd}
              </h3>
              <ul>
                {preview.goals.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
              <p>
                {changes.missions.length} new missions ·{" "}
                {changes.duplicates.length} duplicates skipped. Existing
                progress is preserved.
              </p>
              {changes.conflicts.length > 0 && (
                <ul>
                  {changes.conflicts.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              )}
              <div className="record-list">
                {changes.missions.map((m) => (
                  <div key={m.id} className="record-row">
                    <span>
                      {m.date} · {m.title} · {String(m.data.plannedMinutes)} min
                    </span>
                  </div>
                ))}
              </div>
              <Button variant="primary" disabled={busy} onClick={confirmImport}>
                Confirm {changes.missions.length} missions and draft plan
              </Button>
            </>
          )}
        </Modal>
      )}
      {task !== undefined && (
        <Modal
          title={`${task ? "Edit" : "Add"} mission`}
          onClose={() => setTask(undefined)}
        >
          <form onSubmit={submitTask} className="form-grid">
            <Field label="Title">
              <input
                name="title"
                required
                maxLength={200}
                defaultValue={task?.title ?? ""}
              />
            </Field>
            <Field label="Date">
              <input
                name="date"
                type="date"
                required
                defaultValue={task?.date ?? selected}
              />
            </Field>
            <Field label="Category">
              <select
                name="category"
                defaultValue={String(task?.data.category ?? "Faith")}
              >
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Importance (1–3, 3 highest)">
              <input
                name="priority"
                type="number"
                min={1}
                max={3}
                required
                defaultValue={Number(task?.data.priority) || 2}
              />
            </Field>
            <Field label="Planned minutes">
              <input
                name="plannedMinutes"
                type="number"
                min={1}
                max={1440}
                required
                defaultValue={Number(task?.data.plannedMinutes) || 15}
              />
            </Field>
            <Field label="Time (optional)">
              <input
                name="scheduledTime"
                type="time"
                defaultValue={String(task?.data.scheduledTime ?? "")}
              />
            </Field>
            <Field label="Travel minutes">
              <input
                name="travelMinutes"
                type="number"
                min={0}
                max={180}
                defaultValue={Number(task?.data.travelMinutes) || 0}
              />
            </Field>
            <Field label="Target quantity">
              <input
                name="target"
                type="number"
                min={0.01}
                step="any"
                defaultValue={Number(task?.data.target) || 1}
              />
            </Field>
            <Field label="Fixed commitment">
              <input
                name="fixed"
                type="checkbox"
                defaultChecked={task?.data.fixed === true}
              />
            </Field>
            <Field label="Notes">
              <textarea
                name="notes"
                defaultValue={String(task?.data.notes ?? "")}
              />
            </Field>
            <Button variant="primary" type="submit" disabled={busy}>
              Save mission
            </Button>
          </form>
        </Modal>
      )}
      {carry && (
        <Modal title="Deliberate rescheduling" onClose={() => setCarry(null)}>
          <p>
            {carry.title}. Moving it changes the planned date and resets mission
            progress; related activity logs remain intact.
          </p>
          <form onSubmit={carryForward}>
            <Field label="New date">
              <input
                type="date"
                name="newDate"
                required
                defaultValue={addDays(carry.date, 1)}
              />
            </Field>
            <Button type="submit" variant="primary">
              Confirm reschedule
            </Button>
          </form>
        </Modal>
      )}
    </>
  );
}
function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
