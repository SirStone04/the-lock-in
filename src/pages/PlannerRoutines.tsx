import { useState } from "react";
import { CalendarCheck, Repeat } from "lucide-react";
import { useApp } from "../data/store";
import { Button, Card, Modal } from "../components/ui";
import { EntryManager } from "../components/EntryManager";
import { categories } from "../domain/models";
import { formatDate } from "../domain/dates";
import { previewRoutines, validateRoutine } from "../domain/routines";

export default function PlannerRoutines({ week }: { week: string }) {
  const { records, save } = useApp();
  const [previewWeek, setPreviewWeek] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const preview = previewWeek ? previewRoutines(records, previewWeek) : null;
  async function generate() {
    if (!previewWeek || !preview || preview.issues.length) return;
    setBusy(true);
    setMessage("");
    try {
      const fresh = previewRoutines(records, previewWeek);
      for (const mission of fresh.missions) await save(mission);
      setMessage(
        `${fresh.missions.length} recurring missions generated. Existing mission progress was preserved.`,
      );
      setPreviewWeek(null);
    } catch (error) {
      setMessage(
        `${error instanceof Error ? error.message : "Generation failed."} Retry safely; stable IDs prevent duplicate missions.`,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <EntryManager
        kind="routine"
        title="Recurring routines"
        description="Save daily habits or choose custom weekdays. Routine templates create no XP or completions; preview each week's missions before generating them."
        defaults={{
          category: "Faith",
          priority: 2,
          plannedMinutes: 15,
          frequency: "Daily",
          days: "0,1,2,3,4,5,6",
          enabled: true,
        }}
        validate={validateRoutine}
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
            step: 1,
            required: true,
          },
          {
            key: "plannedMinutes",
            label: "Planned minutes",
            type: "number",
            min: 1,
            max: 1440,
            step: 1,
            required: true,
          },
          {
            key: "scheduledTime",
            label: "Scheduled time (optional)",
            type: "time",
          },
          {
            key: "frequency",
            label: "Repeat",
            type: "select",
            options: ["Daily", "Weekly / custom"],
          },
          {
            key: "days",
            label: "Custom weekdays (comma separated)",
            required: true,
            help: "0 Sun, 1 Mon, 2 Tue, 3 Wed, 4 Thu, 5 Fri, 6 Sat. Example: 2,3 for Tuesday and Wednesday. Daily uses all seven days.",
          },
          { key: "enabled", label: "Enabled for generation", type: "checkbox" },
          { key: "notes", label: "Routine notes", type: "textarea" },
        ]}
      />
      <Card>
        <div className="section-title">
          <div>
            <h2>
              <Repeat size={18} /> Generate recurring missions
            </h2>
            <p className="muted small">
              Week of {formatDate(week, "MMM d, yyyy")}. Only today and future
              dates generate. Previously generated missions stay unchanged when
              a routine is edited or disabled.
            </p>
          </div>
          <Button
            onClick={() => {
              setPreviewWeek(week);
              setMessage("");
            }}
          >
            <CalendarCheck size={16} /> Preview week
          </Button>
        </div>
        {message && (
          <p className="notice" role="status">
            {message}
          </p>
        )}
      </Card>
      {preview && previewWeek && (
        <Modal
          title="Confirm recurring missions"
          onClose={() => setPreviewWeek(null)}
        >
          <p>
            {preview.missions.length} new missions from {preview.routineCount}{" "}
            enabled routines. {preview.duplicates} existing missions preserved;{" "}
            {preview.pastDates} past dates skipped.
          </p>
          {preview.issues.length > 0 && (
            <div className="error" role="alert">
              <p>Correct these routines before generating:</p>
              <ul>
                {preview.issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </div>
          )}
          {preview.conflicts.length > 0 && (
            <>
              <h3>Schedule warnings</h3>
              <ul>
                {preview.conflicts.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </>
          )}
          {preview.missions.length > 0 ? (
            <div className="record-list">
              {preview.missions.map((mission) => (
                <div className="record-row" key={mission.id}>
                  <div>
                    <strong>{mission.title}</strong>
                    <p className="muted small">
                      {mission.date} · {String(mission.data.category)} ·{" "}
                      {String(mission.data.scheduledTime || "Flexible")} ·{" "}
                      {String(mission.data.plannedMinutes)} min
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">
              No new missions to generate. Add an enabled routine or select a
              future week.
            </p>
          )}
          <div className="form-actions">
            <Button onClick={() => setPreviewWeek(null)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={
                busy ||
                preview.issues.length > 0 ||
                preview.missions.length === 0
              }
              onClick={generate}
            >
              {busy
                ? "Generating…"
                : `Confirm ${preview.missions.length} missions`}
            </Button>
          </div>
          {message && (
            <p role="alert" className="error">
              {message}
            </p>
          )}
        </Modal>
      )}
    </>
  );
}
