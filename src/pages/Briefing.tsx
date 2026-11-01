import { useState } from "react";
import { ArrowRight, Sparkles, Check, X } from "lucide-react";
import { useApp } from "../data/store";
import { tomorrowBriefing } from "../domain/recommendations";
import { today } from "../domain/dates";
import { Card, PageHeader, Field, Button } from "../components/ui";
export default function Briefing() {
  const { records, save } = useApp();
  const briefing = tomorrowBriefing(records);
  const existing = records.find((r) => r.id === `briefing-${briefing.date}`);
  const [text, setText] = useState(
    String(existing?.data.text ?? briefing.priorities.join("\n")),
  );
  const [status, setStatus] = useState("");
  const accept = async (choice: string) => {
    try {
      await save({
        id: existing?.id ?? `briefing-${briefing.date}`,
        revision: existing?.revision,
        kind: "settings",
        date: briefing.date,
        title: "Tomorrow’s briefing decision",
        data: {
          ...existing?.data,
          briefing: true,
          status: choice,
          text,
          reasons: briefing.reasons,
        },
      });
      setStatus(
        choice === "accepted"
          ? "Briefing saved. Open Planner to make any changes to fixed commitments."
          : "Recommendation dismissed. Your plan is unchanged.",
      );
    } catch (e) {
      setStatus(String(e));
    }
  };
  return (
    <>
      <PageHeader
        eyebrow="RULE-BASED COACHING · NO PAID AI"
        title="Tomorrow's mission briefing"
        description={`Prepared from your stored records for ${briefing.date}. No automatic schedule changes.`}
      />
      <div className="grid-2">
        <Card>
          <div className="section-title">
            <h2>
              <Sparkles size={20} /> Three main priorities
            </h2>
            <span className="pill">{briefing.date}</span>
          </div>
          <Field label="Review or edit your priorities">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
            />
          </Field>
          <div className="button-row">
            <Button variant="primary" onClick={() => void accept("accepted")}>
              <Check size={15} /> Accept briefing
            </Button>
            <Button onClick={() => void accept("dismissed")}>
              <X size={15} /> Dismiss
            </Button>
          </div>
          {status && (
            <p role="status" className="notice">
              {status}
            </p>
          )}
          <h3>One practical improvement</h3>
          <p>{briefing.improvement}</p>
        </Card>
        <Card>
          <h2>Fixed commitments</h2>
          {briefing.fixedCommitments.length ? (
            briefing.fixedCommitments.map((s, i) => <p key={i}>{s}</p>)
          ) : (
            <p className="muted">
              No fixed commitments recorded. Review the weekly plan.
            </p>
          )}
          <h3>Suggested blocks</h3>
          {briefing.blocks.length ? (
            briefing.blocks.map((s, i) => <p key={i}>{s}</p>)
          ) : (
            <p className="muted">
              Preserve existing commitments and avoid adding unnecessary volume.
            </p>
          )}
          <a href="#planner" className="text-link">
            Review weekly planner <ArrowRight size={15} />
          </a>
        </Card>
        <Card>
          <h2>Recovery considerations</h2>
          {briefing.recovery.map((s, i) => (
            <p key={i}>{s}</p>
          ))}
          <p className="muted small">
            These are practical planning prompts based on subjective logs, not
            medical assessments.
          </p>
        </Card>
        <Card>
          <h2>Why these recommendations?</h2>
          {briefing.reasons.length ? (
            briefing.reasons.map((s, i) => <p key={i}>{s}</p>)
          ) : (
            <p className="muted">
              No exceptional triggers in your records through {today()}.
            </p>
          )}
          <h3>Schedule conflicts</h3>
          {briefing.conflicts.length ? (
            briefing.conflicts.map((s, i) => (
              <p className="notice" key={i}>
                {s}
              </p>
            ))
          ) : (
            <p className="muted">
              No overlapping timed commitments detected. Unentered travel and
              sleep windows may still create conflicts.
            </p>
          )}
        </Card>
      </div>
    </>
  );
}
