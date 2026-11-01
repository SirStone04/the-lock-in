import { fromZonedTime } from "date-fns-tz";
import { Moon } from "lucide-react";
import { useApp } from "../../data/store";
import { num, str } from "../../domain/models";
import type { Data } from "../../domain/models";
import { Card, PageHeader } from "../../components/ui";
import { EntryManager } from "../../components/EntryManager";
import {
  nfield,
  textfield,
  notes,
  metric10,
  Stat,
  usePeriod,
  Chart,
  average,
  formatAvg,
} from "./TrackerUI";

export function Sleep() {
  const { records } = useApp();
  const profile = records.find((r) => r.id === "settings-profile");
  const period = usePeriod();
  const logs = records.filter((r) => r.kind === "sleep" && period.includes(r));
  const actual = logs.filter((r) => typeof r.data.sleepHours === "number");
  const fatigue = average(logs, "fatigue");
  const validate = (data: Data, date: string, id?: string) => {
    const begin = fromZonedTime(
        String(data.bedtime ?? ""),
        "America/New_York",
      ).getTime(),
      end = fromZonedTime(
        String(data.wakeTime ?? ""),
        "America/New_York",
      ).getTime();
    if (
      !Number.isFinite(begin) ||
      !Number.isFinite(end) ||
      end <= begin ||
      end - begin > 24 * 3600000
    )
      return "Wake time must follow bedtime within 24 hours. Include the next calendar date when sleep crosses midnight.";
    const opportunity = (end - begin) / 3600000;
    if (
      typeof data.sleepHours === "number" &&
      data.sleepHours > opportunity + 0.02
    )
      return `Actual sleep cannot exceed the ${opportunity.toFixed(2)}-hour time in bed. Enter sleep actually obtained, allowing for time awake.`;
    if (
      records.some((r) => r.kind === "sleep" && r.date === date && r.id !== id)
    )
      return "A sleep log already exists for this wake-up date. Edit it to correct the night or add nap minutes.";
    return undefined;
  };
  const rows = logs
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => {
      const workFatigue = average(
        records.filter(
          (shift) => shift.kind === "shift" && shift.date === r.date,
        ),
        "fatigue",
      );
      return {
        date: r.date,
        ...(typeof r.data.sleepHours === "number"
          ? { sleepHours: num(r, "sleepHours") }
          : {}),
        ...(typeof r.data.energy === "number"
          ? { energy: num(r, "energy") }
          : {}),
        ...(typeof r.data.fatigue === "number"
          ? { fatigue: num(r, "fatigue") }
          : {}),
        ...(workFatigue === null ? {} : { workFatigue }),
      };
    });
  return (
    <div className="section-stack">
      <PageHeader
        eyebrow="RECOVERY IS PART OF THE PLAN"
        title="Sleep & recovery"
        description="Protect the foundation of your work, study, and training. Time in bed is separate from sleep actually obtained."
        actions={period.control}
      />
      <div className="stats-grid">
        <Stat
          label="Average actual sleep"
          value={formatAvg(average(actual, "sleepHours"), " h")}
          detail={`${actual.length} logged nights`}
        />
        <Stat
          label="Nights under seven hours"
          value={actual.filter((r) => num(r, "sleepHours") < 7).length}
        />
        <Stat
          label="Average energy"
          value={formatAvg(average(logs, "energy"), " / 10")}
        />
        <Stat label="Average fatigue" value={formatAvg(fatigue, " / 10")} />
      </div>
      <div className="grid-2">
        <Card>
          <Moon size={26} />
          <h3>Your target sleep opportunity</h3>
          <h2>
            {str(profile, "bedtime") && str(profile, "wakeTime")
              ? `${str(profile, "bedtime")} → ${str(profile, "wakeTime")}`
              : "No sleep window set"}
          </h2>
          <p className="muted">
            A sleep opportunity is separate from actual sleep.{" "}
            {str(profile, "homeArrival")
              ? `Your recorded expected arrival home is ${str(profile, "homeArrival")}. `
              : "Set your own sleep window in your private profile. "}
            Adjust your plan based on actual sleep and fatigue.
          </p>
        </Card>
        <Card>
          <h3>Recovery check</h3>
          {actual.length === 0 ? (
            <p className="muted">
              Log a night of actual sleep to see a recovery review.
            </p>
          ) : (
            <>
              <p>
                {actual.some((r) => num(r, "sleepHours") < 6)
                  ? "A logged night was below six hours. Prioritize recovery and reduce optional tasks; do not add shifts to compensate."
                  : "Keep protecting a realistic sleep opportunity alongside fixed commitments."}
              </p>
              {fatigue !== null && fatigue >= 8 && (
                <p className="warning">
                  High reported fatigue: consider rest or lower gym volume.
                  These observations are not a medical diagnosis.
                </p>
              )}
              <p className="muted">
                Energy, soreness, and fatigue are subjective. Use trends to
                guide sustainable planning.
              </p>
            </>
          )}
        </Card>
      </div>
      <EntryManager
        kind="sleep"
        title="Sleep and recovery log"
        description="Use the wake-up date for this record. All times are America/New_York, including daylight-saving transitions. Actual sleep can remain blank if unknown."
        fields={[
          textfield("bedtime", "Bedtime · Eastern", {
            type: "datetime-local",
            required: true,
          }),
          textfield("wakeTime", "Wake time · Eastern", {
            type: "datetime-local",
            required: true,
          }),
          nfield("sleepHours", "Actual sleep · hours", { max: 24 }),
          metric10("quality", "Sleep quality"),
          metric10("energy", "Energy"),
          metric10("fatigue", "Fatigue"),
          metric10("soreness", "Soreness"),
          nfield("napMinutes", "Nap · minutes", { max: 1440 }),
          nfield("steps", "Steps · optional", { step: 1 }),
          notes,
        ]}
        validate={validate}
      />
      <Chart
        title="Sleep, energy, and fatigue"
        rows={rows}
        series={[
          { key: "sleepHours", label: "Actual sleep · h" },
          { key: "energy", label: "Energy / 10" },
          { key: "fatigue", label: "Fatigue / 10", color: "#ca8e88" },
        ]}
      />
      {rows.some((r) => typeof r.workFatigue === "number") && (
        <Chart
          title="Sleep and same-day warehouse fatigue"
          rows={rows}
          series={[
            { key: "sleepHours", label: "Actual sleep · h", color: "#71a6e5" },
            {
              key: "workFatigue",
              label: "Shift fatigue / 10",
              color: "#ca8e88",
            },
          ]}
        />
      )}
    </div>
  );
}
