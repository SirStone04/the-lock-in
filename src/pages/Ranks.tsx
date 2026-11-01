import { useApp } from "../data/store";
import { getRank, RANKS, getAchievements } from "../domain/rank";
import { Card, PageHeader } from "../components/ui";
import RankEmblem from "../components/RankEmblem";
import { LockKeyhole, CheckCircle2, Award } from "lucide-react";
export default function Ranks() {
  const { records } = useApp();
  const rank = getRank(records);
  const achievements = getAchievements(records);
  return (
    <>
      <PageHeader
        eyebrow="EARNED THROUGH CONSISTENCY"
        title="Your rank journey"
        description="The rank measures consistency. The roadmap measures achievements."
      />
      <div className="grid-2">
        <Card className="rank-summary">
          <RankEmblem index={rank.index} size={150} />
          <div>
            <span className="eyebrow">CURRENT RANK</span>
            <h2>
              {rank.name} {rank.division}
            </h2>
            <p>{rank.xp.toLocaleString()} total consistency XP</p>
            <div className="progress gold">
              <div style={{ width: `${rank.progress}%` }} />
            </div>
            <p className="muted small">
              {rank.nextThreshold
                ? `${rank.nextThreshold.toLocaleString()} XP required for next division`
                : "Legendary I · Maximum division"}
            </p>
          </div>
        </Card>
        <Card>
          <span className="eyebrow">PROMOTION REQUIREMENTS</span>
          <h2>{rank.currentForm}</h2>
          <p>
            28-day consistency: <strong>{rank.rollingConsistency}%</strong> ·
            Weekly: <strong>{rank.weeklyConsistency}%</strong>
          </p>
          <p className="muted small">
            Promotions require 70% rolling consistency and enough XP. Onboarding
            requires at least 3 eligible days; from day 14, at least 14 eligible
            days within 28 days. Earned ranks are retained.
          </p>
          <p className="pill">
            {rank.qualified
              ? "Consistency qualification met"
              : "Consistency qualification pending"}
          </p>
        </Card>
      </div>
      <Card>
        <div className="section-title">
          <h2>24 divisions. One deliberate journey.</h2>
          <span className="muted small">III → II → I</span>
        </div>
        <div className="rank-ladder">
          {RANKS.map((r) => (
            <div
              key={r.index}
              className={`rank-tile ${r.index === rank.index ? "current" : ""} ${r.index > rank.index ? "locked" : ""}`}
            >
              <RankEmblem index={r.index} size={84} />
              <strong>
                {r.name} {r.division}
              </strong>
              <span className="muted small">
                {r.threshold.toLocaleString()} XP
              </span>
              {r.index === rank.index ? (
                <span className="pill">CURRENT</span>
              ) : r.index < rank.index ? (
                <CheckCircle2 size={15} />
              ) : (
                <LockKeyhole size={14} />
              )}
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <h2>
          <Award size={20} /> Achievements
        </h2>
        <p className="muted">
          Career, financial, and personal milestones are separate from
          consistency rank.
        </p>
        <div className="achievement-grid">
          {achievements.map((a) => (
            <div
              className={`achievement ${a.earned ? "earned" : ""}`}
              key={a.id}
            >
              <span className="icon-tile">
                {a.earned ? <Award size={21} /> : <LockKeyhole size={19} />}
              </span>
              <div>
                <strong>{a.title}</strong>
                <p className="muted small">{a.description}</p>
                <span className="small">
                  {a.earned ? "Unlocked" : "In progress"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>
      <div className="grid-2">
        <Card>
          <h2>Auditable XP ledger</h2>
          <p className="muted small">
            One derived entry per date. Edits replace that day's award. At most
            100 points per day; income, weight lifted, and extra hours earn no
            bonus.
          </p>
          <div className="record-list">
            {rank.ledger.length ? (
              rank.ledger
                .slice()
                .reverse()
                .map((l) => (
                  <div className="record-row" key={l.id}>
                    <div>
                      <strong>{l.date}</strong>
                      <details>
                        <summary className="muted small">
                          View source revisions
                        </summary>
                        <p className="small">{l.sources.join(", ")}</p>
                      </details>
                    </div>
                    <strong className="gold-text">+{l.points} XP</strong>
                  </div>
                ))
            ) : (
              <p className="muted">
                Your first planned day will start the ledger.
              </p>
            )}
          </div>
        </Card>
        <Card>
          <h2>Promotion history</h2>
          {rank.history.length ? (
            rank.history.map((h) => (
              <div className="record-row" key={h.index}>
                <RankEmblem index={h.index} size={48} />
                <strong>
                  {h.name} {h.division}
                </strong>
                <span className="muted small">{h.date}</span>
              </div>
            ))
          ) : (
            <p className="muted">
              Your journey begins at Recruit III. Promotions will appear here.
            </p>
          )}
          <h3>The scoring model</h3>
          <p className="muted small">
            80 points come from meaningful mission adherence, grouped by life
            category so small tasks cannot overwhelm main commitments. An honest
            complete check-in adds 10; reflection adds 10. Recorded partial
            progress earns proportional mission credit. Optional and
            legitimately excused commitments are excluded.
          </p>
        </Card>
      </div>
    </>
  );
}
