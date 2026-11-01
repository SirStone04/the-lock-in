import { useMemo, useState } from "react";
import { BookOpen, Check, Clock, GraduationCap, Target } from "lucide-react";
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
import { num, str } from "../domain/models";
import type { Data } from "../domain/models";
import { addDays, today, weekDates, weekStart } from "../domain/dates";
import { assessmentAccuracy, examReadiness } from "../domain/education";

const ROADMAP = [
  "NREMT examination",
  "Ohio EMT certification",
  "EMT employment opportunities",
  "ADN prerequisites",
  "Nursing school applications",
  "ADN enrollment",
  "ADN completion",
  "NCLEX-RN",
  "RN license",
];
const TOPICS = [
  "Airway",
  "Respiratory assessment",
  "Patient prioritization",
  "Cardiac emergencies",
  "Clinical scenarios",
  "Mixed questions",
  "Other",
];
function validateQuestions(data: Data) {
  const questions = data.questions == null ? 0 : Number(data.questions);
  const correct = data.correct == null ? 0 : Number(data.correct);
  if (
    !Number.isInteger(questions) ||
    !Number.isInteger(correct) ||
    correct > questions ||
    correct < 0 ||
    questions < 0
  )
    return "Enter whole question totals. Correct answers cannot exceed attempted questions.";
  if (
    typeof data.startTime === "string" &&
    typeof data.endTime === "string" &&
    data.startTime &&
    data.endTime &&
    data.endTime < data.startTime
  )
    return "The session end must come after its start.";
  return undefined;
}
export default function Education() {
  const { records, save } = useApp();
  const profile = records.find((r) => r.id === "settings-profile");
  const [tab, setTab] = useState<
    "study" | "assessments" | "roadmap" | "research"
  >("study");
  const [range, setRange] = useState("week");
  const [error, setError] = useState("");
  const current = today();
  const week = weekStart(current);
  const start =
    range === "week"
      ? week
      : range === "month"
        ? addDays(current, -29)
        : "0000-01-01";
  const study = records.filter(
    (r) => r.kind === "study" && r.date >= start && r.date <= current,
  );
  const assessments = records
    .filter(
      (r) => r.kind === "assessment" && r.date >= start && r.date <= current,
    )
    .sort((a, b) => a.date.localeCompare(b.date));
  const readiness = examReadiness(records.filter((r) => r.date <= current));
  const allAssessments = records
    .filter((r) => r.kind === "assessment" && r.date <= current)
    .sort((a, b) => b.date.localeCompare(a.date));
  const lastAccuracy = allAssessments.find(
    (r) => assessmentAccuracy(r) !== null,
  );
  const weeklyMinutes = records
    .filter((r) => r.kind === "study" && r.date >= week && r.date <= current)
    .reduce((s, r) => s + num(r, "duration"), 0);
  const topicData = useMemo(() => {
    const map = new Map<
      string,
      { minutes: number; questions: number; correct: number; missed: string[] }
    >();
    for (const record of study) {
      const topic = str(record, "topic", "Uncategorized");
      const entry = map.get(topic) ?? {
        minutes: 0,
        questions: 0,
        correct: 0,
        missed: [],
      };
      entry.minutes += num(record, "duration");
      const accuracy = assessmentAccuracy(record);
      if (accuracy !== null) {
        entry.questions += num(record, "questions");
        entry.correct += num(record, "correct");
      }
      if (str(record, "missedConcepts"))
        entry.missed.push(str(record, "missedConcepts"));
      map.set(topic, entry);
    }
    return [...map]
      .map(([topic, values]) => ({
        topic,
        ...values,
        accuracy: values.questions
          ? Math.round((values.correct / values.questions) * 100)
          : null,
      }))
      .sort((a, b) => (a.accuracy ?? 101) - (b.accuracy ?? 101));
  }, [study]);
  const invalid = [...study, ...assessments].filter(
    (r) => num(r, "questions") > 0 && assessmentAccuracy(r) === null,
  );
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="EDUCATION / THE RN ROADMAP"
        title="Build your future."
        description="One focused study block at a time. NREMT Basic → Ohio EMT → ADN → NCLEX-RN."
        actions={
          <div className="flex items-center gap-2">
            <Field label="Analysis period">
              <select value={range} onChange={(e) => setRange(e.target.value)}>
                <option value="week">This week</option>
                <option value="month">Last 30 days</option>
                <option value="all">All records</option>
              </select>
            </Field>
          </div>
        }
      />
      {error && (
        <p className="text-red-400" role="alert">
          {error}
        </p>
      )}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <p className="text-sm text-slate-400">Study this week</p>
          <strong className="text-3xl">
            {(weeklyMinutes / 60).toFixed(1)}{" "}
            <small className="text-sm">hours</small>
          </strong>
        </Card>
        <Card>
          <p className="text-sm text-slate-400">Latest assessment</p>
          <strong className="text-3xl">
            {lastAccuracy ? `${assessmentAccuracy(lastAccuracy)}%` : "—"}
          </strong>
          <p className="text-xs text-slate-400">
            {lastAccuracy?.date ?? "Current baseline not reassessed"}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-slate-400">Booking readiness</p>
          <strong className="text-3xl">{readiness.count}/3</strong>
          <p className="text-xs text-slate-400">
            Latest fresh mixed assessments ≥85%
          </p>
        </Card>
        <Card>
          <p className="text-sm text-slate-400">Exam status</p>
          <strong>
            {str(
              records
                .filter(
                  (r) =>
                    r.id === "nremt-exam-settings" ||
                    (r.kind === "settings" &&
                      (r.data.section === "nremt-exam" ||
                        r.title === "NREMT examination status")),
                )
                .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0],
              "status",
              str(profile, "examStatus", "Not recorded"),
            )}
          </strong>
          <p className="text-xs text-slate-400">No exam result is assumed.</p>
        </Card>
      </div>
      <Card>
        <div className="flex items-start gap-3">
          <Target className="text-amber-300" size={23} />
          <div>
            <h2>
              {readiness.ready
                ? "Readiness target reached"
                : "Your next milestone: a fresh baseline"}
            </h2>
            <p className="text-sm text-slate-400">
              {readiness.ready
                ? "Your three most recent fresh mixed assessments reached 85%. Review weak areas and official exam requirements before deciding to book."
                : str(profile, "historicalAssessment")
                  ? `Private historical context: ${str(profile, "historicalAssessment")}. Log fresh assessments to establish today's baseline.`
                  : "No current baseline is recorded. Log fresh assessments to establish today's baseline."}
            </p>
            <p className="text-sm text-slate-400" style={{ marginTop: 8 }}>
              Suggested topics: airway, respiratory assessment, patient
              prioritization, cardiac emergencies, and clinical scenarios.
            </p>
          </div>
        </div>
      </Card>
      <div
        className="flex flex-wrap gap-2"
        role="tablist"
        aria-label="Education sections"
      >
        {(["study", "assessments", "roadmap", "research"] as const).map(
          (item) => (
            <Button
              key={item}
              role="tab"
              aria-selected={tab === item}
              variant={tab === item ? "primary" : "secondary"}
              onClick={() => setTab(item)}
            >
              {item === "study"
                ? "Study log"
                : item === "assessments"
                  ? "Assessments"
                  : item === "roadmap"
                    ? "Career roadmap"
                    : "Schools & applications"}
            </Button>
          ),
        )}
      </div>
      {invalid.length > 0 && (
        <Card>
          <p className="text-amber-300">
            {invalid.length} record(s) contain invalid question totals. Correct
            them below; they are excluded from accuracy and readiness
            calculations.
          </p>
        </Card>
      )}
      {tab === "study" && (
        <>
          <Card>
            <h2>Study calendar · this week</h2>
            <div
              className="grid grid-cols-2 gap-3 md:grid-cols-7"
              style={{ marginTop: 16 }}
            >
              {weekDates(current).map((date) => {
                const sessions = records.filter(
                  (r) => r.kind === "study" && r.date === date,
                );
                const minutes = sessions.reduce(
                  (s, r) => s + num(r, "duration"),
                  0,
                );
                return (
                  <div
                    key={date}
                    style={{
                      border: `1px solid ${date === current ? "#d6b76a" : "#29313f"}`,
                      borderRadius: 12,
                      padding: 12,
                    }}
                  >
                    <p className="text-xs text-slate-400">
                      {new Date(`${date}T12:00:00Z`).toLocaleDateString(
                        "en-US",
                        { weekday: "short", timeZone: "UTC" },
                      )}{" "}
                      {date.slice(8)}
                    </p>
                    <strong>{minutes} min</strong>
                    <p className="text-xs text-slate-400">
                      {sessions.length} sessions
                    </p>
                  </div>
                );
              })}
            </div>
            <p className="text-sm text-slate-400" style={{ marginTop: 16 }}>
              Choose realistic study blocks in Weekly Planner. Your recorded
              sessions and assessments determine progress; no personal schedule
              is stored in the public application source.
            </p>
          </Card>
          <EntryManager
            kind="study"
            title="Study sessions"
            validate={validateQuestions}
            description="Log actual work, including missed concepts. A duration is not inferred from planned time."
            fields={[
              {
                key: "topic",
                label: "Topic",
                type: "select",
                options: TOPICS,
                required: true,
              },
              { key: "startTime", label: "Start time", type: "datetime-local" },
              { key: "endTime", label: "End time", type: "datetime-local" },
              {
                key: "duration",
                label: "Actual study minutes",
                type: "number",
                min: 0,
                max: 720,
                required: true,
              },
              {
                key: "questions",
                label: "Questions attempted",
                type: "number",
                min: 0,
                step: 1,
              },
              {
                key: "correct",
                label: "Correct answers (must not exceed attempted)",
                type: "number",
                min: 0,
                step: 1,
              },
              {
                key: "missedConcepts",
                label: "Missed concepts",
                type: "textarea",
              },
              {
                key: "followUp",
                label: "Follow-up study tasks",
                type: "textarea",
              },
              { key: "notes", label: "Notes", type: "textarea" },
            ]}
          />
          <Card>
            <h2>Topic performance & weak areas</h2>
            {topicData.length ? (
              <div className="space-y-4" style={{ marginTop: 16 }}>
                {topicData.map((topic) => (
                  <div key={topic.topic}>
                    <div className="flex justify-between gap-3">
                      <strong>{topic.topic}</strong>
                      <span>
                        {topic.minutes} min ·{" "}
                        {topic.accuracy === null
                          ? "No scored questions"
                          : `${topic.accuracy}% (${topic.correct}/${topic.questions})`}
                      </span>
                    </div>
                    {topic.accuracy !== null && (
                      <div
                        className="h-2 rounded bg-slate-700"
                        style={{ marginTop: 8 }}
                      >
                        <div
                          style={{
                            width: `${topic.accuracy}%`,
                            height: "100%",
                            background:
                              topic.accuracy >= 85 ? "#79b89c" : "#d6b76a",
                            borderRadius: 10,
                          }}
                        />
                      </div>
                    )}
                    {topic.missed.length > 0 && (
                      <p
                        className="text-sm text-slate-400"
                        style={{ marginTop: 6 }}
                      >
                        Review: {topic.missed.join(" · ")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <Empty
                title="No study records in this period"
                description="Start with a fresh diagnostic; your weak areas will come from your logged results."
              />
            )}
          </Card>
        </>
      )}
      {tab === "assessments" && (
        <>
          <EntryManager
            kind="assessment"
            title="Practice assessments"
            validate={validateQuestions}
            description="Only valid, fresh mixed assessments count toward the three-assessment booking target."
            fields={[
              {
                key: "questions",
                label: "Questions attempted",
                type: "number",
                min: 1,
                step: 1,
                required: true,
              },
              {
                key: "correct",
                label: "Correct answers (≤ attempted)",
                type: "number",
                min: 0,
                step: 1,
                required: true,
              },
              {
                key: "fresh",
                label: "Fresh questions (not repeated)",
                type: "checkbox",
              },
              {
                key: "mixed",
                label: "Mixed-topic assessment",
                type: "checkbox",
              },
              { key: "source", label: "Assessment source", type: "text" },
              {
                key: "missedConcepts",
                label: "Weak topics / missed concepts",
                type: "textarea",
              },
              { key: "notes", label: "Notes", type: "textarea" },
            ]}
          />
          <Card>
            <h2>Assessment trend</h2>
            {assessments.filter((r) => assessmentAccuracy(r) !== null)
              .length ? (
              <div style={{ height: 280, marginTop: 20 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={assessments
                      .filter((r) => assessmentAccuracy(r) !== null)
                      .map((r) => ({
                        date: r.date.slice(5),
                        accuracy: assessmentAccuracy(r),
                        title: r.title,
                      }))}
                  >
                    <CartesianGrid stroke="#283140" strokeDasharray="3 3" />
                    <XAxis dataKey="date" stroke="#8b96a8" />
                    <YAxis domain={[0, 100]} unit="%" stroke="#8b96a8" />
                    <Tooltip
                      contentStyle={{
                        background: "#171e29",
                        border: "1px solid #334155",
                      }}
                    />
                    <Line dataKey="accuracy" stroke="#d6b76a" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <Empty
                title="No scored assessments yet"
                description="Only recorded assessment results appear in this chart."
              />
            )}
          </Card>
          <EntryManager
            kind="settings"
            title="NREMT examination status"
            filter={(r) =>
              r.id === "nremt-exam-settings" ||
              r.data.section === "nremt-exam" ||
              r.title === "NREMT examination status"
            }
            defaults={{ status: "Not recorded", section: "nremt-exam" }}
            fields={[
              {
                key: "status",
                label: "Booking status",
                type: "select",
                options: [
                  "Not recorded",
                  "Not yet booked",
                  "Considering a date",
                  "Booked",
                  "Taken · awaiting result",
                  "Passed",
                  "Retake planning",
                ],
              },
              {
                key: "examDate",
                label: "Scheduled examination date",
                type: "date",
              },
              { key: "notes", label: "Verified details", type: "textarea" },
            ]}
          />
        </>
      )}
      {tab === "roadmap" && (
        <>
          <Card>
            <div className="flex items-center gap-3">
              <GraduationCap size={25} />
              <div>
                <h2>The Ohio RN pathway</h2>
                <p className="text-sm text-slate-400">
                  Career milestones are separate achievements. They never bypass
                  consistency rank divisions.
                </p>
              </div>
            </div>
            <div
              className="grid gap-4 md:grid-cols-3"
              style={{ marginTop: 20 }}
            >
              {ROADMAP.map((name, i) => {
                const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
                const record = records.find(
                  (r) =>
                    r.kind === "milestone" &&
                    (r.id === `career-${slug}` || r.title === name),
                );
                const status = record
                  ? str(record, "status", "Not started")
                  : "Not started";
                return (
                  <div
                    key={name}
                    style={{
                      border: "1px solid #29313f",
                      borderRadius: 12,
                      padding: 16,
                    }}
                  >
                    <p className="text-xs text-slate-400">
                      MILESTONE {String(i + 1).padStart(2, "0")}
                    </p>
                    <h3 style={{ margin: "7px 0" }}>{name}</h3>
                    <p
                      className={
                        status === "Completed"
                          ? "text-emerald-400"
                          : "text-slate-400"
                      }
                    >
                      {status === "Completed" && (
                        <Check size={14} style={{ display: "inline" }} />
                      )}{" "}
                      {status}
                    </p>
                    {record && str(record, "notes") && (
                      <p className="text-sm text-slate-400">
                        {str(record, "notes")}
                      </p>
                    )}
                    <Button
                      variant="ghost"
                      onClick={async () => {
                        try {
                          const next =
                            status === "Not started"
                              ? "In progress"
                              : status === "In progress"
                                ? "Completed"
                                : "Not started";
                          if (
                            next === "Completed" &&
                            !confirm(
                              `Mark ${name} completed based on your actual verified outcome?`,
                            )
                          )
                            return;
                          await save({
                            id: record?.id ?? `career-${slug}`,
                            kind: "milestone",
                            title: name,
                            date: current,
                            revision: record?.revision,
                            data: {
                              ...(record?.data ?? {}),
                              status: next,
                              verified: next === "Completed",
                            },
                          });
                        } catch (e) {
                          setError(String(e));
                        }
                      }}
                    >
                      {status === "Not started"
                        ? "Begin milestone"
                        : status === "In progress"
                          ? "Mark verified completion"
                          : "Reopen milestone"}
                    </Button>
                  </div>
                );
              })}
            </div>
            <p className="text-sm text-slate-400" style={{ marginTop: 16 }}>
              Paramedic training remains optional if firefighter employment
              provides or requires it; it is not a required step in this RN
              plan.
            </p>
          </Card>
          <EntryManager
            kind="milestone"
            title="Career milestone details"
            fields={[
              {
                key: "status",
                label: "Status",
                type: "select",
                options: [
                  "Not started",
                  "In progress",
                  "Completed",
                  "Verification pending",
                ],
              },
              { key: "verified", label: "Outcome verified", type: "checkbox" },
              { key: "targetDate", label: "Target date", type: "date" },
              {
                key: "notes",
                label: "Evidence, requirements, and next steps",
                type: "textarea",
              },
            ]}
          />
        </>
      )}
      {tab === "research" && (
        <>
          <Card>
            <BookOpen size={22} />
            <h2>Research your nursing-school options</h2>
            <p className="text-sm text-slate-400">
              Add schools you are considering and verify current prerequisites,
              admission requirements, and tuition directly with each school.
              Your saved research stays in your private workspace. No school
              selection, requirement, or cost is assumed.
            </p>
          </Card>
          <EntryManager
            kind="research"
            title="Nursing-school research"
            fields={[
              {
                key: "school",
                label: "School",
                type: "text",
              },
              {
                key: "status",
                label: "Information status",
                type: "select",
                options: ["Unverified", "Estimate", "Verified with school"],
              },
              { key: "source", label: "Source URL / contact", type: "text" },
              { key: "verifiedDate", label: "Date verified", type: "date" },
              {
                key: "requirements",
                label: "Verified prerequisites / admission requirements",
                type: "textarea",
              },
              {
                key: "estimatedCost",
                label: "Estimated cost (USD; optional)",
                type: "number",
                min: 0,
              },
              {
                key: "verifiedCost",
                label: "Verified cost (USD; optional)",
                type: "number",
                min: 0,
              },
              {
                key: "notes",
                label: "Questions and next steps",
                type: "textarea",
              },
            ]}
          />
          <Card>
            <div className="flex items-start gap-3">
              <Clock size={23} />
              <div>
                <h2>Track application next steps</h2>
                <p className="text-sm text-slate-400">
                  Record employers, application stages, and verified updates
                  below. No application or hiring outcome is assumed.
                </p>
              </div>
            </div>
          </Card>
          <EntryManager
            kind="application"
            title="Employment applications"
            fields={[
              { key: "employer", label: "Employer", type: "text" },
              {
                key: "status",
                label: "Application status",
                type: "select",
                options: [
                  "Researching",
                  "Applied",
                  "Assessment",
                  "Interview",
                  "Offer",
                  "Closed",
                ],
              },
              { key: "contact", label: "Contact / source", type: "text" },
              { key: "nextAction", label: "Next action", type: "textarea" },
              { key: "deadline", label: "Follow-up date", type: "date" },
              { key: "notes", label: "Verified details", type: "textarea" },
            ]}
          />
        </>
      )}
    </div>
  );
}
