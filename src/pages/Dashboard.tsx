import { useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  BookOpen,
  Moon,
  Wallet,
  Dumbbell,
  BriefcaseBusiness,
  Flame,
  CheckCircle2,
  Crosshair,
  Sparkles,
  Plus,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { useApp } from "../data/store";
import {
  today,
  weekStart,
  weekEnd,
  weekDates,
  formatDate,
} from "../domain/dates";
import { getRank, scoreDay } from "../domain/rank";
import {
  financialTotals,
  shiftHours,
  estimatePay,
} from "../domain/calculations";
import { baselineRecords } from "../domain/seed";
import { num, str } from "../domain/models";
import { Card, PageHeader, Button, Stat } from "../components/ui";
import RankEmblem from "../components/RankEmblem";
import { MissionRow } from "./Today";

export default function Dashboard({ quickLog }: { quickLog: () => void }) {
  const { records, save, mode } = useApp();
  const date = today(),
    start = weekStart(date),
    end = weekEnd(date);
  const rank = getRank(records, date);
  const score = scoreDay(date, records);
  const week = records.filter((r) => r.date >= start && r.date <= end);
  const missions = records.filter(
    (r) => r.kind === "mission" && r.date === date,
  );
  missions.sort(
    (a, b) =>
      num(b, "priority", 2) - num(a, "priority", 2) ||
      (str(a, "category") === "Faith"
        ? -1
        : str(b, "category") === "Faith"
          ? 1
          : 0),
  );
  const done = missions.filter((r) => str(r, "status") === "completed").length;
  const finance = financialTotals(records, start, end);
  const studies = week.filter((r) => r.kind === "study");
  const shifts = week.filter((r) => r.kind === "shift");
  const sleep = records
    .filter((r) => r.kind === "sleep" && r.date <= date)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const chart = weekDates(date)
    .filter((d) => d <= date)
    .map((d) => ({
      date: formatDate(d, "EEE"),
      score: scoreDay(d, records).eligible ? scoreDay(d, records).points : null,
    }));
  let workHours = 0,
    earnings = 0;
  for (const shift of shifts)
    try {
      workHours += shiftHours(shift);
      earnings += estimatePay(shift).gross;
    } catch {
      /* A validation warning is visible in Employment. */
    }
  async function initialize() {
    setBusy(true);
    try {
      const existing = new Set(records.map((r) => r.id));
      for (const r of baselineRecords(date))
        if (!r.id || !existing.has(r.id)) {
          await save(r);
          if (r.id) existing.add(r.id);
        }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="YOUR PERSONAL OPERATING SYSTEM"
        title="Command dashboard"
        description={`${formatDate(date, "EEEE, MMMM d, yyyy")} · Make today count.`}
        actions={
          <Button variant="primary" onClick={quickLog}>
            <Plus size={16} /> Daily check-in
          </Button>
        }
      />
      {mode === "local" && (
        <div className="local-banner">
          <span className="status-dot amber" /> Local workspace · Records are
          saved on this browser. Configure Firebase for cross-device sync.{" "}
          <a href="#settings">
            Setup & backup <ArrowUpRight size={13} />
          </a>
        </div>
      )}
      <div className="dashboard-top">
        <Card className="rank-hero">
          <div className="rank-hero-copy">
            <div className="eyebrow">
              <span className="status-dot" /> YOUR CONSISTENCY RANK
            </div>
            <div className="rank-title">
              {rank.name} <span>{rank.division}</span>
            </div>
            <p className="muted">Every commitment kept is a step forward.</p>
            <div className="rank-xp">
              <strong>
                {rank.xp.toLocaleString()} <span>XP</span>
              </strong>
              <span>
                {rank.nextThreshold
                  ? `${Math.max(0, rank.nextThreshold - rank.xp).toLocaleString()} XP to ${rank.index === 23 ? "maximum" : "next division"}`
                  : "Highest division reached"}
              </span>
            </div>
            <div className="progress gold">
              <div style={{ width: `${rank.progress}%` }} />
            </div>
            <div className="rank-bottom">
              <span>{rank.progress}% to next division</span>
              <a href="#ranks">
                View rank journey <ArrowRight size={14} />
              </a>
            </div>
          </div>
          <div className="rank-hero-art">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <RankEmblem index={rank.index} size={178} />
            <span className="emblem-caption">
              {rank.currentForm.toUpperCase()}
            </span>
          </div>
        </Card>
        <Card className="daily-score">
          <div className="section-title">
            <span className="eyebrow">TODAY'S EXECUTION</span>
            <Crosshair size={18} />
          </div>
          <div
            className="score-ring"
            style={{ "--score": `${score.points}%` } as React.CSSProperties}
          >
            <div>
              <strong>
                {Math.round(score.points)}
                <span>%</span>
              </strong>
              <small>consistency</small>
            </div>
          </div>
          <div className="score-caption">
            <CheckCircle2 size={15} />
            {done} of {missions.length} missions complete
          </div>
          <a className="text-link" href="#today">
            Open daily missions <ArrowRight size={14} />
          </a>
        </Card>
      </div>
      {!records.some((r) => r.kind === "week") && (
        <Card className="onboarding">
          <div>
            <span className="eyebrow">READY WHEN YOU ARE</span>
            <h3>Give your week a clear starting point.</h3>
            <p className="muted">
              Create your editable faith, study, warehouse, fitness, and
              recovery plan. Every mission starts uncompleted.
            </p>
          </div>
          <Button disabled={busy} variant="primary" onClick={initialize}>
            {busy ? "Building plan…" : "Build my first week"}{" "}
            <ArrowRight size={16} />
          </Button>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </Card>
      )}
      <div className="stats-grid dashboard-stats">
        <Stat
          label="WEEKLY CONSISTENCY"
          value={`${rank.weeklyConsistency}%`}
          detail={`${week.filter((r) => r.kind === "mission" && str(r, "status") === "completed").length} / ${week.filter((r) => r.kind === "mission").length} weekly missions complete`}
          icon={<Flame size={18} />}
        />
        <Stat
          label="STUDY THIS WEEK"
          value={`${(studies.reduce((a, r) => a + num(r, "duration"), 0) / 60).toFixed(1)} h`}
          detail="Actual logged education time"
          icon={<BookOpen size={18} />}
        />
        <Stat
          label="PAID WORK HOURS"
          value={`${workHours.toFixed(1)} h`}
          detail={`$${earnings.toFixed(2)} estimated gross`}
          icon={<BriefcaseBusiness size={18} />}
        />
        <Stat
          label="SPENDING THIS WEEK"
          value={`$${finance.spending.toFixed(2)}`}
          detail={`$${finance.income.toFixed(2)} received · ${finance.availableCash === null ? "cash unreconciled" : `$${finance.availableCash.toFixed(2)} reconciled cash`}`}
          icon={<Wallet size={18} />}
        />
      </div>
      <div className="dashboard-middle">
        <Card className="missions-card">
          <div className="section-title">
            <div>
              <span className="eyebrow">FOCUS ON WHAT MATTERS</span>
              <h2>
                Today's missions{" "}
                <span className="count">{missions.length}</span>
              </h2>
            </div>
            <a href="#today" className="text-link">
              View all <ArrowUpRight size={15} />
            </a>
          </div>
          {missions.length ? (
            missions
              .slice(0, 6)
              .map((m) => <MissionRow key={m.id} mission={m} />)
          ) : (
            <div className="empty">
              <Crosshair size={30} />
              <h3>A clear day starts with a plan.</h3>
              <p>
                Create your first week or add today's meaningful commitments.
              </p>
              <Button onClick={() => (location.hash = "#today")}>
                Add a mission <Plus size={15} />
              </Button>
            </div>
          )}
          <a className="card-footer-link" href="#planner">
            Plan your week <ArrowRight size={15} />
          </a>
        </Card>
        <Card className="weekly-chart">
          <div className="section-title">
            <div>
              <span className="eyebrow">SMALL ACTIONS. LASTING PROGRESS.</span>
              <h2>Consistency overview</h2>
            </div>
            <span className="pill">This week</span>
          </div>
          <div className="chart-summary">
            <strong>
              {rank.weeklyConsistency}
              <span>%</span>
            </strong>
            <span className="muted small">
              weekly consistency
              <br />
              {rank.rollingConsistency}% over 28 days
            </span>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chart}
                margin={{ top: 10, right: 8, left: -28, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="chartGold" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#d8b768" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#d8b768" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  stroke="#252d38"
                  vertical={false}
                  strokeDasharray="3 5"
                />
                <XAxis
                  dataKey="date"
                  stroke="#798493"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                />
                <YAxis
                  domain={[0, 100]}
                  stroke="#798493"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                />
                <Tooltip
                  contentStyle={{
                    background: "#1b222d",
                    border: "1px solid #38414e",
                    borderRadius: 8,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="score"
                  name="Consistency"
                  stroke="#d8b768"
                  strokeWidth={2.5}
                  fill="url(#chartGold)"
                  connectNulls={false}
                  dot={{ r: 3, fill: "#d8b768" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="muted small">
            Only actual planned days and recorded check-ins are shown.
          </p>
        </Card>
      </div>
      <div className="dashboard-bottom">
        <Card className="recovery-card">
          <span className="icon-tile blue">
            <Moon size={21} />
          </span>
          <div>
            <span className="eyebrow">RECOVERY FIRST</span>
            <h3>
              {sleep
                ? `${num(sleep, "sleepHours").toFixed(1)} hours of sleep`
                : "How did you sleep?"}
            </h3>
            <p className="muted small">
              {sleep
                ? `Energy ${num(sleep, "energy") || "—"}/10 · Fatigue ${num(sleep, "fatigue") || "—"}/10`
                : "Log last night to inform a realistic plan."}
            </p>
          </div>
          <a href="#sleep" aria-label="Open sleep and recovery">
            <ArrowUpRight size={22} />
          </a>
        </Card>
        <Card className="recovery-card">
          <span className="icon-tile green">
            <Dumbbell size={21} />
          </span>
          <div>
            <span className="eyebrow">FITNESS, SUSTAINABLY</span>
            <h3>
              {
                week.filter(
                  (r) =>
                    r.kind === "workout" && str(r, "status") === "completed",
                ).length
              }{" "}
              workouts completed
            </h3>
            <p className="muted small">
              Use your weekly plan for training days and recovery.
            </p>
          </div>
          <a href="#fitness" aria-label="Open fitness">
            <ArrowUpRight size={22} />
          </a>
        </Card>
        <Card className="briefing-card">
          <span className="eyebrow">
            <Sparkles size={14} /> LOOK AHEAD
          </span>
          <h3>A sustainable tomorrow.</h3>
          <p className="muted small">
            Your next-day briefing adapts to sleep, fatigue, and fixed
            commitments.
          </p>
          <a href="#briefing" className="text-link">
            Open mission briefing <ArrowRight size={15} />
          </a>
        </Card>
      </div>
      <Card className="quick-actions-card">
        <div className="section-title">
          <h2>Quick actions</h2>
          <span className="muted small">
            Log what happened. Keep the record honest.
          </span>
        </div>
        <div className="button-row">
          <a className="btn btn-secondary" href="#sleep">
            <Moon size={15} /> Log sleep
          </a>
          <a className="btn btn-secondary" href="#fitness">
            <Dumbbell size={15} /> Start workout
          </a>
          <a className="btn btn-secondary" href="#employment">
            <BriefcaseBusiness size={15} /> Log work
          </a>
          <a className="btn btn-secondary" href="#education">
            <BookOpen size={15} /> Log study
          </a>
          <a className="btn btn-secondary" href="#finances">
            <Wallet size={15} /> Log transaction
          </a>
          <a className="btn btn-secondary" href="#today">
            <CheckCircle2 size={15} /> Complete mission
          </a>
          <a className="btn btn-secondary" href="#briefing">
            <Sparkles size={15} /> Tomorrow’s briefing
          </a>
          <a className="btn btn-secondary" href="#reports">
            <ArrowUpRight size={15} /> Weekly report
          </a>
        </div>
      </Card>
      <div className="dashboard-quote">
        “Consistency creates progress.”{" "}
        <span>DISCIPLINE. CONSISTENCY. PROGRESS.</span>
      </div>
    </>
  );
}
