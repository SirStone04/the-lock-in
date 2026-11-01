import { useApp } from "../../data/store";
import { bool, str } from "../../domain/models";
import { Card, PageHeader } from "../../components/ui";
import { EntryManager } from "../../components/EntryManager";
import {
  nfield,
  textfield,
  check,
  notes,
  Stat,
  usePeriod,
  Chart,
  total,
  dateRows,
} from "./TrackerUI";
import { QuickRoutine } from "./QuickRoutine";

export function Faith() {
  const { records } = useApp();
  const profile = records.find((r) => r.id === "settings-profile");
  const durations = profile?.data.faithDurations;
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const period = usePeriod();
  const logs = records.filter((r) => r.kind === "faith" && period.includes(r));
  const count = (key: string) =>
    new Set(logs.filter((r) => bool(r, key)).map((r) => r.date)).size;
  return (
    <div className="section-stack">
      <PageHeader
        eyebrow="FIRST THINGS FIRST"
        title="Faith"
        description="Track prayer, Scripture, and your planned faith commitments without putting a number on spiritual maturity."
        actions={period.control}
      />
      <div className="stats-grid">
        <Stat
          label="Prayer days"
          value={count("prayer")}
          detail="Actual logged days"
        />
        <Stat
          label="Scripture days"
          value={count("scripture")}
          detail="Actual logged days"
        />
        <Stat label="Study time" value={`${total(logs, "duration")} min`} />
        <Stat label="Church attendance" value={count("church")} />
      </div>
      <QuickRoutine
        kind="faith"
        title="Time with God"
        items={[
          { key: "prayer", label: "Prayer" },
          { key: "scripture", label: "Scripture" },
          { key: "church", label: "Church" },
        ]}
        hint="Tap when completed. Tap again to correct a mistake."
      />
      <div className="grid-2">
        <Card>
          <span className="eyebrow">YOUR SCRIPTURE FOCUS</span>
          <h2>{str(profile, "faithPassage") || "No passage selected"}</h2>
          <p className="muted">
            Select your passage in your private profile, then record what you
            noticed and one practical application below. Scripture text is not
            fetched from a paid API.
          </p>
        </Card>
        <Card>
          <h3>A sustainable weekly rhythm</h3>
          <p className="muted">
            {Array.isArray(durations) &&
            durations.some((value) => typeof value === "number")
              ? durations
                  .map((value, index) =>
                    typeof value === "number"
                      ? `${days[index] ?? "Day"}: ${value} min`
                      : "",
                  )
                  .filter(Boolean)
                  .join(" · ")
              : "Choose realistic prayer, Scripture, worship, and reflection commitments in your weekly plan."}
          </p>
          <p>
            Your private profile and weekly plan hold your chosen commitments.
          </p>
        </Card>
      </div>
      <EntryManager
        kind="faith"
        title="Spiritual journal"
        description="Search your entries by title, passage, notes, or date. Daily routine entries from the quick buttons can be edited here."
        fields={[
          check("prayer", "Prayer completed"),
          check("scripture", "Scripture read"),
          check("bibleStudy", "Bible study"),
          check("church", "Church attended"),
          check("youthGroup", "Youth group · optional"),
          nfield("duration", "Time · minutes"),
          textfield("reference", "Scripture passage"),
          { key: "reflection", label: "Reflection", type: "textarea" },
          {
            key: "application",
            label: "One personal application",
            type: "textarea",
          },
          notes,
        ]}
      />
      <Chart
        title="Logged time with God"
        kind="bar"
        rows={dateRows(logs, ["duration"])}
        series={[{ key: "duration", label: "Minutes" }]}
      />
    </div>
  );
}
