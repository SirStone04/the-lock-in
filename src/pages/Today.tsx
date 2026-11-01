import { useState } from "react";
import {
  Check,
  CalendarDays,
  Plus,
  CheckCheck,
  ArrowRight,
} from "lucide-react";
import { useApp } from "../data/store";
import { categories, num, str } from "../domain/models";
import type { AppRecord } from "../domain/models";
import { today } from "../domain/dates";
import { scoreDay } from "../domain/rank";
import { Card, PageHeader, Button } from "../components/ui";
import EntryManager from "../components/EntryManager";
import QuickLog from "../components/QuickLog";

export function MissionRow({ mission }: { mission: AppRecord }) {
  const { save } = useApp();
  const [error, setError] = useState("");
  const done = str(mission, "status") === "completed";
  return (
    <div className={`mission-row ${done ? "done" : ""}`}>
      <button
        aria-label={`${done ? "Reopen" : "Complete"} ${mission.title}`}
        className={`mission-check ${done ? "checked" : ""}`}
        onClick={async () => {
          try {
            await save({
              ...mission,
              data: {
                ...mission.data,
                status: done ? "not-started" : "completed",
              },
            });
          } catch (e) {
            setError(String(e));
          }
        }}
      >
        {done && <Check size={16} />}
      </button>
      <div className="mission-text">
        <strong>{mission.title}</strong>
        <span className="muted small">
          {str(mission, "scheduledTime") ||
            str(mission, "plannedTime") ||
            "Flexible"}
          {num(mission, "plannedMinutes") > 0 &&
            ` · ${num(mission, "plannedMinutes")} min`}
        </span>
        {error && <span className="error small">{error}</span>}
      </div>
      <span
        className={`category category-${str(mission, "category").toLowerCase()}`}
      >
        {str(mission, "category") || "Mission"}
      </span>
      <span className="mission-status">
        {str(mission, "status") === "partial"
          ? "Partial"
          : done
            ? "Complete"
            : str(mission, "status") === "not-started"
              ? "To do"
              : str(mission, "status")}
      </span>
    </div>
  );
}
export default function Today() {
  const { records } = useApp();
  const [date, setDate] = useState(today());
  const [quick, setQuick] = useState<"check" | "close" | null>(null);
  const missions = records.filter(
    (r) => r.kind === "mission" && r.date === date,
  );
  const score = scoreDay(date, records);
  return (
    <>
      <PageHeader
        eyebrow="DAILY OPERATIONS"
        title="Today's missions"
        description="A realistic plan. One intentional action at a time."
        actions={
          <>
            <input
              aria-label="Mission date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <Button variant="primary" onClick={() => setQuick("check")}>
              <Plus size={16} /> Daily check-in
            </Button>
          </>
        }
      />
      <div className="stats-grid">
        <Card>
          <span className="eyebrow">DAILY CONSISTENCY</span>
          <div className="large-number">
            {Math.round(score.points)}
            <small>/100</small>
          </div>
          <p className="muted small">
            80 mission adherence · 10 check-in · 10 reflection
          </p>
        </Card>
        <Card>
          <span className="eyebrow">MISSION STATUS</span>
          <div className="large-number">
            {missions.filter((r) => str(r, "status") === "completed").length}
            <small>/{missions.length}</small>
          </div>
          <p className="muted small">Completed planned commitments</p>
        </Card>
        <Card className="callout">
          <CheckCheck size={24} />
          <h3>Finish with intention</h3>
          <p className="muted small">
            Reflect, save your progress, and review tomorrow.
          </p>
          <Button onClick={() => setQuick("close")}>
            Close my day <ArrowRight size={15} />
          </Button>
        </Card>
      </div>
      <Card>
        <div className="section-title">
          <h2>
            <CalendarDays size={18} /> Mission overview
          </h2>
          <span className="pill">{date}</span>
        </div>
        {missions.length ? (
          missions.map((m) => <MissionRow key={m.id} mission={m} />)
        ) : (
          <p className="muted">
            No missions planned for this date. Add a commitment below or
            finalize a weekly plan.
          </p>
        )}
      </Card>
      <EntryManager
        kind="mission"
        title="Mission management"
        filter={(r) => r.date === date}
        defaults={{ status: "not-started", category: "Faith", priority: 2 }}
        fields={[
          {
            key: "category",
            label: "Category",
            type: "select",
            options: categories,
          },
          {
            key: "priority",
            label: "Importance (1–3, 3 highest)",
            type: "number",
            min: 1,
            max: 3,
            default: 2,
          },
          { key: "scheduledTime", label: "Planned local time", type: "time" },
          {
            key: "plannedMinutes",
            label: "Planned duration (minutes)",
            type: "number",
            min: 0,
            max: 1440,
          },
          {
            key: "target",
            label: "Target quantity (optional)",
            type: "number",
            min: 0,
          },
          { key: "actual", label: "Actual quantity", type: "number", min: 0 },
          {
            key: "actualMinutes",
            label: "Actual duration (minutes)",
            type: "number",
            min: 0,
            max: 1440,
          },
          {
            key: "status",
            label: "Status",
            type: "select",
            options: [
              "not-started",
              "in-progress",
              "completed",
              "partial",
              "skipped",
              "rescheduled",
              "excused",
            ],
          },
          { key: "optional", label: "Optional mission", type: "checkbox" },
          {
            key: "included",
            label: "Include this optional mission in consistency commitments",
            type: "checkbox",
            help: "Optional missions earn mission credit only when deliberately included in the plan. Use Weekly Planner to reschedule a commitment.",
          },
          { key: "notes", label: "Notes", type: "textarea" },
        ]}
      />
      {quick && (
        <QuickLog
          closeDay={quick === "close"}
          onClose={() => {
            if (quick === "close") location.hash = "#briefing";
            setQuick(null);
          }}
        />
      )}
    </>
  );
}
