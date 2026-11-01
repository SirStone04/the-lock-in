import { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronRight,
  Dumbbell,
  Play,
  Plus,
  RotateCcw,
  Timer,
  Trash2,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useApp } from "../data/store";
import { Button, Card, Empty, Field, PageHeader } from "../components/ui";
import { EntryManager } from "../components/EntryManager";
import type { AppRecord } from "../domain/models";
import { num, str } from "../domain/models";
import { today, weekStart } from "../domain/dates";
import { shiftHours } from "../domain/calculations";
import {
  exercisesAsJson,
  previousExerciseSets,
  progression,
  sessionSets,
  trainingVolume,
  validateExercises,
  WORKOUT_TEMPLATES,
} from "../domain/fitness";
import type { Exercise } from "../domain/fitness";

interface SetEditorProps {
  set?: AppRecord;
  index: number;
  session: AppRecord;
  exercise: Exercise;
  exerciseIndex: number;
  onSaved: () => void;
  onRest: (seconds: number) => void;
  repeat?: AppRecord;
}
function SetEditor({
  set,
  index,
  session,
  exercise,
  exerciseIndex,
  onSaved,
  onRest,
  repeat,
}: SetEditorProps) {
  const { save, remove } = useApp();
  const [weight, setWeight] = useState(set ? String(num(set, "weight")) : "");
  const [reps, setReps] = useState(set ? String(num(set, "reps")) : "");
  const [rpe, setRpe] = useState(
    set?.data.rpe !== null && set?.data.rpe !== undefined
      ? String(num(set, "rpe"))
      : "",
  );
  const [rir, setRir] = useState(
    set?.data.rir !== null && set?.data.rir !== undefined
      ? String(num(set, "rir"))
      : "",
  );
  const [notes, setNotes] = useState(set ? str(set, "notes") : "");
  const [completed, setCompleted] = useState(set?.data.completed === true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (set) {
      setWeight(String(num(set, "weight")));
      setReps(String(num(set, "reps")));
      setRpe(set.data.rpe == null ? "" : String(num(set, "rpe")));
      setRir(set.data.rir == null ? "" : String(num(set, "rir")));
      setNotes(str(set, "notes"));
      setCompleted(set.data.completed === true);
    }
  }, [set?.revision]);
  async function persist() {
    if (
      weight === "" ||
      reps === "" ||
      !Number.isFinite(Number(weight)) ||
      Number(weight) < 0 ||
      !Number.isInteger(Number(reps)) ||
      Number(reps) < 0 ||
      Number(reps) > 200 ||
      (rpe !== "" && (Number(rpe) < 1 || Number(rpe) > 10)) ||
      (rir !== "" && (Number(rir) < 0 || Number(rir) > 20))
    ) {
      setError(
        "Enter weight ≥ 0, whole repetitions 0–200, and valid optional effort.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      await save({
        id: set?.id ?? `${session.id}-e${exerciseIndex}-${index}`,
        kind: "exerciseSet",
        date: session.date,
        title: `${exercise.name} · set ${index}`,
        revision: set?.revision,
        data: {
          sessionId: session.id,
          exercise: exercise.name,
          index,
          weight: Number(weight),
          reps: Number(reps),
          rpe: rpe === "" ? null : Number(rpe),
          rir: rir === "" ? null : Number(rir),
          completed,
          notes,
        },
      });
      if (completed) onRest(exercise.rest);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Set could not be saved.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="set-editor"
      style={{
        padding: "14px 0",
        borderBottom: "1px solid var(--border, #29313f)",
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <strong>Set {index}</strong>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={completed}
            onChange={(e) => setCompleted(e.target.checked)}
          />{" "}
          Completed
        </label>
      </div>
      <div
        className="grid grid-cols-2 gap-3 md:grid-cols-4"
        style={{ marginTop: 10 }}
      >
        <Field label="Weight (lb)">
          <input
            aria-label={`${exercise.name} set ${index} weight`}
            type="number"
            inputMode="decimal"
            min="0"
            step="0.5"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
        </Field>
        <Field label="Repetitions">
          <input
            aria-label={`${exercise.name} set ${index} repetitions`}
            type="number"
            inputMode="numeric"
            min="0"
            max="200"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
          />
        </Field>
        <Field label="RPE (1–10)">
          <input
            aria-label={`${exercise.name} set ${index} RPE`}
            type="number"
            inputMode="decimal"
            min="1"
            max="10"
            step="0.5"
            value={rpe}
            onChange={(e) => setRpe(e.target.value)}
          />
        </Field>
        <Field label="Reps in reserve">
          <input
            aria-label={`${exercise.name} set ${index} reps in reserve`}
            type="number"
            inputMode="numeric"
            min="0"
            max="20"
            value={rir}
            onChange={(e) => setRir(e.target.value)}
          />
        </Field>
      </div>
      <Field label="Set notes">
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional technique or machine notes"
        />
      </Field>
      {error && (
        <p role="alert" className="text-red-400">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2" style={{ marginTop: 8 }}>
        <Button onClick={persist} disabled={busy}>
          {set ? "Save changes" : "Save set"}
        </Button>
        {repeat && (
          <Button
            variant="secondary"
            onClick={() => {
              setWeight(String(num(repeat, "weight")));
              setReps(String(num(repeat, "reps")));
              setRpe(repeat.data.rpe == null ? "" : String(num(repeat, "rpe")));
              setRir(repeat.data.rir == null ? "" : String(num(repeat, "rir")));
              setCompleted(false);
            }}
          >
            <RotateCcw size={14} /> Repeat previous
          </Button>
        )}
        {set && (
          <Button
            variant="ghost"
            onClick={async () => {
              if (confirm("Delete this set?")) {
                try {
                  await remove(set.id);
                } catch (e) {
                  setError(String(e));
                }
              }
            }}
            aria-label={`Remove ${exercise.name} set ${index}`}
          >
            <Trash2 size={15} />
          </Button>
        )}
      </div>
    </div>
  );
}

export default function Fitness() {
  const { records, save, remove } = useApp();
  const profile = records.find((r) => r.id === "settings-profile");
  const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const trainingDays = Array.isArray(profile?.data.trainingDays)
    ? profile.data.trainingDays.filter(
        (value): value is number =>
          typeof value === "number" &&
          Number.isInteger(value) &&
          value >= 0 &&
          value <= 6,
      )
    : [];
  const [selected, setSelected] = useState<string | null>(null);
  const [templateEdit, setTemplateEdit] = useState<string | null>(null);
  const [templateJson, setTemplateJson] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [rest, setRest] = useState(0);
  const [extras, setExtras] = useState<Record<string, number>>({});
  const [workoutNotes, setWorkoutNotes] = useState("");
  const [soreness, setSoreness] = useState("");
  const sessions = records
    .filter((r) => r.kind === "workout" && !r.data.isTemplate)
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
    );
  const active = selected
    ? sessions.find((r) => r.id === selected)
    : sessions.find((r) => str(r, "status") === "in-progress");
  const completed = sessions.filter((r) => str(r, "status") === "completed");
  const week = weekStart(today());
  const templates = WORKOUT_TEMPLATES.map((t) => {
    const saved = records.find((r) => r.id === `template-${t.id}`);
    if (saved) {
      try {
        return { ...t, exercises: validateExercises(saved.data.exercises) };
      } catch {
        return t;
      }
    }
    return t;
  });
  let exercises: Exercise[] = [];
  if (active) {
    try {
      exercises = validateExercises(active.data.prescription);
    } catch {
      exercises =
        templates.find((t) => t.id === str(active, "templateId"))?.exercises ??
        [];
    }
  }
  const sets = active ? sessionSets(records, active.id) : [];
  const latestRecovery = records
    .filter((r) => r.kind === "sleep" && r.date <= today())
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const workHours = records
    .filter((r) => r.kind === "shift" && r.date >= week && r.date <= today())
    .reduce((s, r) => {
      try {
        return s + shiftHours(r);
      } catch {
        return s;
      }
    }, 0);
  useEffect(() => {
    if (rest <= 0) return;
    const timer = setInterval(() => setRest((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(timer);
  }, [rest > 0]);
  useEffect(() => {
    setWorkoutNotes(active ? str(active, "notes") : "");
    setSoreness(
      active?.data.soreness == null ? "" : String(num(active, "soreness")),
    );
  }, [active?.id]);
  const chart = useMemo(
    () =>
      completed
        .slice()
        .reverse()
        .map((session) => ({
          date: session.date.slice(5),
          volume: trainingVolume(sessionSets(records, session.id)),
        })),
    [records],
  );
  const personalBests = useMemo(() => {
    const map = new Map<
      string,
      {
        exercise: string;
        weight: number;
        reps: number;
        estimatedStrength: number | null;
      }
    >();
    for (const set of records.filter(
      (r) =>
        r.kind === "exerciseSet" &&
        r.data.completed === true &&
        r.date <= today(),
    )) {
      const name = str(set, "exercise");
      const weight = num(set, "weight");
      const reps = num(set, "reps");
      const old = map.get(name);
      const estimate =
        weight > 0 && reps > 0 && reps <= 12 ? weight * (1 + reps / 30) : null;
      if (!old)
        map.set(name, {
          exercise: name,
          weight,
          reps,
          estimatedStrength: estimate,
        });
      else
        map.set(name, {
          exercise: name,
          weight: Math.max(old.weight, weight),
          reps:
            weight > old.weight
              ? reps
              : weight === old.weight
                ? Math.max(old.reps, reps)
                : old.reps,
          estimatedStrength:
            estimate === null
              ? old.estimatedStrength
              : Math.max(old.estimatedStrength ?? 0, estimate),
        });
    }
    return [...map.values()];
  }, [records]);
  async function begin(id: string) {
    const template = templates.find((t) => t.id === id);
    if (!template) return;
    setBusy(true);
    setError("");
    try {
      const sessionId = await save({
        kind: "workout",
        date: today(),
        title: template.name,
        data: {
          templateId: id,
          status: "in-progress",
          startedAt: new Date().toISOString(),
          gym: str(profile, "gymName"),
          prescription: exercisesAsJson(template.exercises),
          exercisesDone: [],
          exercisesSkipped: [],
          notes: "",
        },
      });
      setSelected(sessionId);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  async function updateSession(data: AppRecord["data"]) {
    if (!active) return;
    try {
      await save({ ...active, data: { ...active.data, ...data } });
    } catch (e) {
      setError(String(e));
    }
  }
  async function finish() {
    if (!active) return;
    if (
      !confirm(
        "Finish this workout? Your saved sets stay editable. Unsaved set inputs are not included.",
      )
    )
      return;
    const minutes = Math.max(
      0,
      Math.round(
        (Date.now() - Date.parse(str(active, "startedAt", active.createdAt))) /
          60000,
      ),
    );
    await updateSession({
      status: "completed",
      finishedAt: new Date().toISOString(),
      duration: minutes,
      notes: workoutNotes,
      soreness: soreness === "" ? null : Number(soreness),
    });
  }
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="HEALTH / TRAINING"
        title="Fitness"
        description={`Train with purpose. Recover with intention.${str(profile, "gymName") ? ` ${str(profile, "gymName")}.` : ""}`}
        actions={
          <Button
            variant="secondary"
            onClick={() => {
              setSelected(null);
            }}
          >
            Current session
          </Button>
        }
      />
      {error && (
        <p role="alert" className="text-red-400">
          {error}
        </p>
      )}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <p className="text-sm text-slate-400">This week's sessions</p>
          <strong className="text-3xl">
            {
              completed.filter((r) => r.date >= week && r.date <= today())
                .length
            }
          </strong>
        </Card>
        <Card>
          <p className="text-sm text-slate-400">Completed working sets</p>
          <strong className="text-3xl">
            {
              records.filter(
                (r) =>
                  r.kind === "exerciseSet" &&
                  r.data.completed === true &&
                  r.date >= week &&
                  r.date <= today(),
              ).length
            }
          </strong>
        </Card>
        <Card>
          <p className="text-sm text-slate-400">Weekly training volume</p>
          <strong className="text-2xl">
            {trainingVolume(
              records.filter(
                (r) =>
                  r.kind === "exerciseSet" &&
                  r.date >= week &&
                  r.date <= today(),
              ),
            ).toLocaleString()}{" "}
            <small className="text-sm">lb·reps</small>
          </strong>
        </Card>
        <Card>
          <p className="text-sm text-slate-400">Gym schedule</p>
          <strong>
            {trainingDays.length
              ? trainingDays.map((day) => weekdayLabels[day]).join(" / ")
              : "Not set"}
          </strong>
          <p className="text-sm text-slate-400">
            Choose commitments in your private profile and weekly plan.
          </p>
        </Card>
      </div>
      {!active && (
        <div className="grid gap-4 lg:grid-cols-3">
          {templates.map((template) => (
            <Card key={template.id}>
              <div className="flex items-center gap-2">
                <Dumbbell size={19} />
                <h2>{template.name}</h2>
              </div>
              <p className="text-sm text-slate-400">{template.description}</p>
              <p style={{ margin: "16px 0" }}>
                {template.exercises.length} exercises ·{" "}
                {template.exercises.reduce((s, e) => s + e.sets, 0)} prescribed
                sets
              </p>
              <div className="flex flex-wrap gap-2">
                <Button disabled={busy} onClick={() => begin(template.id)}>
                  <Play size={15} /> Start workout
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setTemplateEdit(template.id);
                    setTemplateJson(
                      JSON.stringify(template.exercises, null, 2),
                    );
                  }}
                >
                  Edit prescription
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      {templateEdit && (
        <Card>
          <h2>Edit exercise prescription</h2>
          <p className="text-sm text-slate-400">
            Adjust names, sets, repetition range, rest seconds, or technique
            notes. This changes future sessions only.
          </p>
          <Field label="Exercise prescription JSON">
            <textarea
              rows={16}
              value={templateJson}
              onChange={(e) => setTemplateJson(e.target.value)}
            />
          </Field>
          <div className="flex gap-2">
            <Button
              onClick={async () => {
                try {
                  const exercises = validateExercises(JSON.parse(templateJson));
                  const old = records.find(
                    (r) => r.id === `template-${templateEdit}`,
                  );
                  await save({
                    id: `template-${templateEdit}`,
                    kind: "workout",
                    date: today(),
                    title:
                      templates.find((t) => t.id === templateEdit)?.name ??
                      "Workout template",
                    revision: old?.revision,
                    data: {
                      isTemplate: true,
                      exercises: exercisesAsJson(exercises),
                    },
                  });
                  setTemplateEdit(null);
                  setError("");
                } catch (e) {
                  setError(String(e));
                }
              }}
            >
              Save prescription
            </Button>
            <Button variant="ghost" onClick={() => setTemplateEdit(null)}>
              Cancel
            </Button>
          </div>
        </Card>
      )}
      {active && (
        <>
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm text-slate-400">
                  {active.date} ·{" "}
                  {str(active, "status") === "completed"
                    ? "Completed session · editable history"
                    : "SESSION IN PROGRESS · changes save per set"}
                </p>
                <h2 className="text-2xl">{active.title}</h2>
                <p>
                  {sets.filter((r) => r.data.completed === true).length}{" "}
                  completed sets · {trainingVolume(sets).toLocaleString()}{" "}
                  lb·reps
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setSelected("__new__")}
                >
                  Back to workouts
                </Button>
                {str(active, "status") !== "completed" && (
                  <Button onClick={finish}>
                    <Check size={16} /> Finish workout
                  </Button>
                )}
              </div>
            </div>
          </Card>
          {rest > 0 && (
            <Card>
              <div
                className="flex items-center justify-between gap-3"
                role="timer"
                aria-label="Rest timer"
              >
                <span className="flex items-center gap-2">
                  <Timer size={20} /> Rest · {Math.floor(rest / 60)}:
                  {String(rest % 60).padStart(2, "0")}
                </span>
                <Button variant="ghost" onClick={() => setRest(0)}>
                  Dismiss timer
                </Button>
              </div>
            </Card>
          )}
          {exercises.map((exercise, exerciseIndex) => {
            const logged = sets.filter(
              (s) => str(s, "exercise") === exercise.name,
            );
            const previous = previousExerciseSets(
              records,
              active,
              exercise.name,
            );
            const advice = progression(
              exercise,
              previous,
              latestRecovery ? num(latestRecovery, "fatigue") : undefined,
              latestRecovery?.data.sleepHours == null
                ? undefined
                : num(latestRecovery, "sleepHours"),
              workHours,
            );
            const indices = Array.from(
              new Set([
                ...Array.from(
                  { length: exercise.sets + (extras[exercise.name] ?? 0) },
                  (_, i) => i + 1,
                ),
                ...logged.map((s) => num(s, "index")),
              ]),
            ).sort((a, b) => a - b);
            const done =
              Array.isArray(active.data.exercisesDone) &&
              active.data.exercisesDone.includes(exercise.name);
            const skipped =
              Array.isArray(active.data.exercisesSkipped) &&
              active.data.exercisesSkipped.includes(exercise.name);
            return (
              <Card key={exercise.name}>
                <div className="grid gap-6 lg:grid-cols-[1fr_1.5fr]">
                  <div>
                    <p className="text-xs tracking-widest text-slate-400">
                      PRESCRIPTION
                    </p>
                    <h3 className="text-xl" style={{ margin: "8px 0" }}>
                      {exercise.name}
                    </h3>
                    <strong>
                      {exercise.sets} sets × {exercise.minReps}–
                      {exercise.maxReps} reps
                    </strong>
                    <p
                      className="text-sm text-slate-400"
                      style={{ marginTop: 8 }}
                    >
                      Rest {exercise.rest} seconds · {exercise.notes}
                    </p>
                    <p style={{ marginTop: 16 }}>
                      Previous:{" "}
                      {previous.length
                        ? previous
                            .map(
                              (s) =>
                                `${num(s, "weight")} lb × ${num(s, "reps")}`,
                            )
                            .join(" / ")
                        : "No previous performance recorded."}
                    </p>
                    <p
                      className="text-sm text-slate-400"
                      style={{ marginTop: 12 }}
                    >
                      <strong className="uppercase">{advice.action}</strong> ·{" "}
                      {advice.reason}
                    </p>
                    <div
                      className="flex flex-wrap gap-2"
                      style={{ marginTop: 16 }}
                    >
                      <Button
                        variant="secondary"
                        onClick={() => setRest(exercise.rest)}
                      >
                        <Timer size={15} /> Rest timer
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={async () => {
                          const current = Array.isArray(
                            active.data.exercisesDone,
                          )
                            ? active.data.exercisesDone
                            : [];
                          await updateSession({
                            exercisesDone: done
                              ? current.filter((e) => e !== exercise.name)
                              : [...current, exercise.name],
                          });
                        }}
                      >
                        {done ? "Reopen exercise" : "Complete exercise"}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={async () => {
                          const current = Array.isArray(
                            active.data.exercisesSkipped,
                          )
                            ? active.data.exercisesSkipped
                            : [];
                          await updateSession({
                            exercisesSkipped: skipped
                              ? current.filter((e) => e !== exercise.name)
                              : [...current, exercise.name],
                          });
                        }}
                      >
                        {skipped ? "Unskip exercise" : "Skip exercise"}
                      </Button>
                    </div>
                    {done && (
                      <p className="text-emerald-400">
                        Exercise marked complete
                      </p>
                    )}
                    {skipped && (
                      <p className="text-amber-400">
                        Exercise skipped · no fabricated sets
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs tracking-widest text-slate-400">
                      ACTUAL PERFORMANCE
                    </p>
                    {!skipped &&
                      indices.map((index) => (
                        <SetEditor
                          key={`${active.id}-${exercise.name}-${index}`}
                          set={logged.find((s) => num(s, "index") === index)}
                          index={index}
                          session={active}
                          exercise={exercise}
                          exerciseIndex={exerciseIndex}
                          onSaved={() => {}}
                          onRest={setRest}
                          repeat={logged
                            .filter((s) => num(s, "index") < index)
                            .at(-1)}
                        />
                      ))}
                    {!skipped && (
                      <Button
                        variant="ghost"
                        onClick={() =>
                          setExtras((v) => ({
                            ...v,
                            [exercise.name]:
                              Math.max(
                                v[exercise.name] ?? 0,
                                Math.max(...indices) - exercise.sets,
                              ) + 1,
                          }))
                        }
                      >
                        <Plus size={15} /> Add set
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
          <Card>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Session notes">
                <textarea
                  value={workoutNotes}
                  onChange={(e) => setWorkoutNotes(e.target.value)}
                />
              </Field>
              <Field label="Soreness (0–10)">
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  max="10"
                  value={soreness}
                  onChange={(e) => setSoreness(e.target.value)}
                />
              </Field>
            </div>
            <Button
              variant="secondary"
              onClick={() =>
                updateSession({
                  notes: workoutNotes,
                  soreness:
                    soreness === ""
                      ? null
                      : Math.min(10, Math.max(0, Number(soreness))),
                })
              }
            >
              Save session notes
            </Button>
          </Card>
        </>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2>Workout history</h2>
          {sessions.length ? (
            <div className="space-y-3" style={{ marginTop: 16 }}>
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between gap-3"
                >
                  <button
                    className="text-left"
                    onClick={() => {
                      setSelected(session.id);
                      setExtras({});
                    }}
                  >
                    <strong>{session.title}</strong>
                    <p className="text-sm text-slate-400">
                      {session.date} · {str(session, "status")} ·{" "}
                      {num(session, "duration")} min
                    </p>
                  </button>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      aria-label={`Open ${session.title} ${session.date}`}
                      onClick={() => setSelected(session.id)}
                    >
                      <ChevronRight size={18} />
                    </Button>
                    <Button
                      variant="ghost"
                      aria-label={`Delete ${session.title} ${session.date}`}
                      onClick={async () => {
                        if (
                          confirm(
                            "Delete this workout and all of its saved sets?",
                          )
                        ) {
                          try {
                            for (const set of sessionSets(records, session.id))
                              await remove(set.id);
                            await remove(session.id);
                            if (selected === session.id) setSelected(null);
                          } catch (e) {
                            setError(String(e));
                          }
                        }
                      }}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              title="Your first session starts here"
              description="Prescriptions are starting templates; no workouts or working weights have been recorded."
            />
          )}
        </Card>
        <Card>
          <h2>Training volume</h2>
          <p className="text-sm text-slate-400">
            Completed sets only. Volume never awards bonus rank XP.
          </p>
          {chart.length ? (
            <div style={{ height: 240, marginTop: 20 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chart}>
                  <CartesianGrid stroke="#283140" strokeDasharray="3 3" />
                  <XAxis dataKey="date" stroke="#8b96a8" />
                  <YAxis stroke="#8b96a8" />
                  <Tooltip
                    contentStyle={{
                      background: "#171e29",
                      border: "1px solid #334155",
                    }}
                  />
                  <Line dataKey="volume" stroke="#d6b76a" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty
              title="No completed training data yet"
              description="Finish a session to see your actual volume over time."
            />
          )}
        </Card>
      </div>
      {personalBests.length > 0 && (
        <Card>
          <h2>Exercise performance</h2>
          <p className="text-sm text-slate-400">
            Heaviest completed working sets. Estimated strength uses weight × (1
            + repetitions / 30), only for 1–12 reps. It is a rough trend
            indicator, not a prescribed maximal attempt.
          </p>
          <div className="space-y-3" style={{ marginTop: 16 }}>
            {personalBests.map((best) => (
              <div
                key={best.exercise}
                className="flex flex-wrap justify-between gap-3"
              >
                <strong>{best.exercise}</strong>
                <span>
                  {best.weight} lb × {best.reps} reps · estimated strength{" "}
                  {best.estimatedStrength === null
                    ? "unavailable"
                    : `${Math.round(best.estimatedStrength)} lb`}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
      <EntryManager
        kind="workout"
        title="Correct session details"
        description="Edit session dates, duration, status, and recovery notes. Exercise sets remain independent records."
        filter={(r) => !r.data.isTemplate}
        fields={[
          {
            key: "status",
            label: "Status",
            type: "select",
            options: ["in-progress", "completed"],
          },
          {
            key: "duration",
            label: "Duration (minutes)",
            type: "number",
            min: 0,
          },
          {
            key: "soreness",
            label: "Soreness (0–10)",
            type: "number",
            min: 0,
            max: 10,
          },
          { key: "notes", label: "Notes", type: "textarea" },
        ]}
      />
    </div>
  );
}
