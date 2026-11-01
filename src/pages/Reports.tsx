import { useMemo, useState } from "react";
import { Check, Copy, Download, FileText, Printer, Save } from "lucide-react";
import { useApp } from "../data/store";
import { Button, Card, Empty, Field, PageHeader, Stat } from "../components/ui";
import { addDays, formatDate, today, weekStart } from "../domain/dates";
import {
  buildWeeklyReport,
  downloadText,
  type WeeklyReport,
} from "../domain/reports";
import { planningPrompt } from "../domain/planning";

export default function Reports() {
  const { records, save } = useApp();
  const [date, setDate] = useState(weekStart(today()));
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"preliminary" | "final">("preliminary");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [archive, setArchive] = useState<string | null>(null);
  const generated = useMemo(
    () => buildWeeklyReport(records, date, notes, status),
    [records, date, notes, status],
  );
  const archived = records.find((r) => r.id === archive && r.kind === "report");
  const stored = archived?.data.report as unknown as WeeklyReport | undefined;
  const report =
    stored && typeof stored.markdown === "string" ? stored : generated;
  const archives = records
    .filter((r) => r.kind === "report")
    .sort((a, b) => b.date.localeCompare(a.date));
  const canFinalize = report.weekEnd < today();
  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setMessage(`${label} copied.`);
    } catch {
      setMessage(
        "Clipboard unavailable in this browser. Download the Markdown report instead.",
      );
    }
  }
  async function saveReport(finalize: boolean) {
    if (archive) {
      setMessage("Return to the live report to create a new snapshot.");
      return;
    }
    if (finalize && !canFinalize) {
      setMessage(
        "Finalization opens on the Sunday after this week ends. You can save a preliminary report any time.",
      );
      return;
    }
    setBusy(true);
    try {
      const version = buildWeeklyReport(
        records,
        date,
        notes,
        finalize ? "final" : "preliminary",
      );
      const id = `report_${version.weekStart}_${finalize ? "final" : "preliminary"}`;
      const previous = records.find((r) => r.id === id);
      await save({
        id,
        revision: previous?.revision,
        kind: "report",
        date: version.weekStart,
        title: `${finalize ? "Final" : "Preliminary"} report · ${version.weekStart}`,
        data: {
          report: version as unknown as import("../domain/models").JsonValue,
          status: version.status,
          weekEnd: version.weekEnd,
        },
      });
      setStatus(version.status);
      setMessage(
        `Report ${finalize ? "finalized" : "saved"} in the archive. Exported totals match this saved snapshot.`,
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to save report.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="Review. Adjust. Repeat."
        title="Weekly reports"
        description="An honest account of your week, ready for the Command Center."
        actions={
          <>
            <Button onClick={() => window.print()}>
              <Printer size={16} /> Print
            </Button>
            <Button
              variant="primary"
              onClick={() => copy(report.markdown, "Report for ChatGPT")}
            >
              <Copy size={16} /> Copy for ChatGPT
            </Button>
          </>
        }
      />
      <Card className="no-print">
        <div className="form-grid">
          <Field label="Planning week (Sunday–Saturday)">
            <input
              type="date"
              value={date}
              onChange={(e) => {
                if (e.target.value) {
                  setDate(weekStart(e.target.value));
                  setArchive(null);
                  setStatus("preliminary");
                }
              }}
            />
          </Field>
          <Field label="Archived snapshot">
            <select
              value={archive ?? ""}
              onChange={(e) => setArchive(e.target.value || null)}
            >
              <option value="">Live report from current records</option>
              {archives.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <p className="muted small">
          Preliminary reports are available any time. Finalize on the following
          Sunday after every day has been logged. Reports run when you open the
          app; no background job is required.
        </p>
        {archive && (
          <p className="notice">
            Viewing a saved snapshot. New source edits appear in the live
            report; they do not rewrite this archive automatically.
          </p>
        )}
      </Card>
      {message && (
        <p className="notice no-print" role="status">
          {message}
        </p>
      )}
      <div className="stats-grid">
        <Stat
          label="Week"
          value={`${formatDate(report.weekStart, "MMM d")}–${formatDate(report.weekEnd, "d")}`}
          detail={`${report.status} report`}
        />
        <Stat
          label="Consistency"
          value={
            report.metrics.consistency === null
              ? "—"
              : `${String(report.metrics.consistency)}%`
          }
          detail="Actual planned adherence"
        />
        <Stat
          label="Consistency XP"
          value={`+${String(report.metrics.xpGained ?? 0)}`}
          detail={String(report.metrics.rank ?? "Recruit III")}
        />
        <Stat
          label="Cash flow"
          value={new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
          }).format(Number(report.metrics.netCashFlow ?? 0))}
          detail="Deposits + refunds − outflows"
        />
      </div>
      {!archive && (
        <Card className="no-print">
          <h2>Review notes</h2>
          <p className="muted">
            Add context before exporting. Notes never change the underlying
            performance records.
          </p>
          <Field label="Wins, difficulties and context">
            <textarea
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What mattered this week? What needs to change?"
            />
          </Field>
          <div className="row-actions">
            <Button disabled={busy} onClick={() => saveReport(false)}>
              <Save size={16} /> Save preliminary
            </Button>
            <Button
              variant="primary"
              disabled={busy || !canFinalize}
              onClick={() => saveReport(true)}
            >
              <Check size={16} /> Finalize report
            </Button>
            {!canFinalize && (
              <span className="muted small">
                Finalization available {addDays(report.weekEnd, 1)}.
              </span>
            )}
          </div>
        </Card>
      )}
      <Card className="no-print">
        <div className="section-title">
          <h2>
            <FileText size={18} /> Export this report
          </h2>
          <span className="badge">Schema v1</span>
        </div>
        <div className="row-actions">
          <Button
            onClick={() =>
              downloadText(
                `lock-in-report-${report.weekStart}.md`,
                report.markdown,
                "text/markdown",
              )
            }
          >
            <Download size={16} /> Markdown
          </Button>
          <Button
            onClick={() =>
              downloadText(
                `lock-in-report-${report.weekStart}.json`,
                JSON.stringify(report, null, 2),
                "application/json",
              )
            }
          >
            <Download size={16} /> JSON
          </Button>
          <Button
            onClick={() =>
              copy(planningPrompt(report.markdown), "Next-week planning prompt")
            }
          >
            <Copy size={16} /> Copy planning prompt
          </Button>
        </div>
        <p className="muted small">
          Paste the report into your existing ChatGPT Command Center. Import its
          structured JSON plan in Weekly Planner. No API key or direct
          conversation connection is required.
        </p>
      </Card>
      <Card className="report-document">
        <div className="section-title">
          <span className="eyebrow">Command Center export</span>
          <span className="badge">
            {archive ? "Archived snapshot" : "Live records"}
          </span>
        </div>
        <ReportText text={report.markdown} />
      </Card>
      {archives.length === 0 && (
        <Card className="no-print">
          <Empty
            title="Your report archive starts here"
            description="Save a preliminary or final report to keep its historical totals and notes."
          />
        </Card>
      )}
    </>
  );
}
function ReportText({ text }: { text: string }) {
  return (
    <div className="report-content">
      {text.split("\n\n").map((block, i) =>
        block.startsWith("# ") ? (
          <h2 key={i}>{block.slice(2)}</h2>
        ) : block.startsWith("### ") ? (
          <h3 key={i}>{block.slice(4)}</h3>
        ) : (
          <div key={i} style={{ whiteSpace: "pre-wrap", lineHeight: 1.8 }}>
            {block.replace(/\*\*/g, "")}
          </div>
        ),
      )}
    </div>
  );
}
