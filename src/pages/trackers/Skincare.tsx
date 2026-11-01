import { useState } from "react";
import { useApp } from "../../data/store";
import { bool, num, str } from "../../domain/models";
import type { Data } from "../../domain/models";
import { Button, Card, PageHeader } from "../../components/ui";
import { EntryManager } from "../../components/EntryManager";
import {
  nfield,
  textfield,
  check,
  notes,
  Stat,
  usePeriod,
  Chart,
  dateRows,
} from "./TrackerUI";
import { QuickRoutine } from "./QuickRoutine";

export function Skincare() {
  const { records } = useApp();
  const profile = records.find((r) => r.id === "settings-profile");
  const rawBaseline = profile?.data.skinBaseline;
  const baselineValues: Data =
    rawBaseline &&
    typeof rawBaseline === "object" &&
    !Array.isArray(rawBaseline)
      ? rawBaseline
      : {};
  const reviewDates = Array.isArray(profile?.data.skinReviewDates)
    ? profile.data.skinReviewDates.filter(
        (value): value is string => typeof value === "string",
      )
    : [];
  const [tab, setTab] = useState("skin");
  const period = usePeriod();
  const logs = records.filter(
    (r) => r.kind === "skincare" && period.includes(r),
  );
  const maintenance = records.filter(
    (r) => r.kind === "maintenance" && period.includes(r),
  );
  const baseline = [
    { key: "breakouts", label: "New breakouts" },
    { key: "texture", label: "Bumps / texture" },
    { key: "darkMarks", label: "Dark marks" },
    { key: "irritation", label: "Dryness / irritation" },
  ];
  return (
    <div className="section-stack">
      <PageHeader
        eyebrow="CARE FOR THE DETAILS"
        title="Skincare & maintenance"
        description="Simple routines that support everyday life. Treatment scheduling remains product specific and is not prefilled."
        actions={period.control}
      />
      <div className="stats-grid">
        <Stat
          label="Morning routine"
          value={
            new Set(logs.filter((r) => bool(r, "am")).map((r) => r.date)).size
          }
          detail="Days logged complete"
        />
        <Stat
          label="Evening routine"
          value={
            new Set(logs.filter((r) => bool(r, "pm")).map((r) => r.date)).size
          }
          detail="Days logged complete"
        />
        <Stat
          label="Maintenance complete"
          value={maintenance.filter((r) => bool(r, "completed")).length}
        />
        <Stat
          label="Tracking began"
          value={str(profile, "skinStartDate") || "Not set"}
          detail={
            str(profile, "skinBaselineDate")
              ? `Baseline: ${str(profile, "skinBaselineDate")}`
              : "No baseline date set"
          }
        />
      </div>
      <QuickRoutine
        kind="skincare"
        title="Daily skin routine"
        items={[
          { key: "am", label: "AM complete" },
          { key: "pm", label: "PM complete" },
        ]}
        hint="AM: gentle cleanse, moisturizer, SPF 30+ when appropriate. PM: cleanse, scheduled treatment if applicable, moisturizer."
      />
      <Card>
        <h3>Baseline and logged comparison</h3>
        <div className="grid-2">
          {baseline.map((b) => {
            const latest = records
              .filter(
                (r) =>
                  r.kind === "skincare" && typeof r.data[b.key] === "number",
              )
              .sort((a, c) => c.date.localeCompare(a.date))[0];
            return (
              <div className="record-row" key={b.key}>
                <span>{b.label}</span>
                <strong>
                  {typeof baselineValues[b.key] === "number"
                    ? `${baselineValues[b.key]}/3 baseline`
                    : "No baseline"}{" "}
                  →{" "}
                  {latest
                    ? `${num(latest, b.key)}/3 · ${latest.date}`
                    : "not reassessed"}
                </strong>
              </div>
            );
          })}
        </div>
        <p className="muted">
          {reviewDates.length
            ? `Your review dates: ${reviewDates.join(", ")}. `
            : "No review dates set. "}
          No improvement is assumed without logged comparisons. Scores describe
          your own observations.
        </p>
      </Card>
      <div className="tabs">
        {[
          ["skin", "Skin log"],
          ["products", "Products"],
          ["treatments", "Treatment calendar"],
          ["maintenance", "Personal maintenance"],
        ].map(([key, label]) => (
          <Button
            key={key}
            variant={tab === key ? "primary" : "ghost"}
            onClick={() => setTab(key)}
          >
            {label}
          </Button>
        ))}
      </div>
      {tab === "skin" && (
        <EntryManager
          kind="skincare"
          title="Skincare log"
          fields={[
            check("am", "AM routine completed"),
            check("pm", "PM routine completed"),
            ...baseline.map((b) =>
              nfield(b.key, `${b.label} · 0–3`, { min: 0, max: 3, step: 1 }),
            ),
            textfield("productsUsed", "Products used"),
            notes,
          ]}
        />
      )}
      {tab === "products" && (
        <EntryManager
          kind="inventory"
          title="Product inventory"
          description="Track only the products you actually use. Product recommendations are not a medical treatment plan."
          fields={[
            textfield("purpose", "Purpose"),
            nfield("quantity", "Remaining quantity"),
            textfield("unit", "Unit"),
            textfield("opened", "Opened date", { type: "date" }),
            textfield("expires", "Expiry date", { type: "date" }),
            check("active", "Currently using"),
            notes,
          ]}
        />
      )}
      {tab === "treatments" && (
        <EntryManager
          kind="maintenance"
          title="Treatment calendar"
          filter={(r) => str(r, "type") === "Skincare treatment"}
          defaults={{ type: "Skincare treatment" }}
          description="Add your own confirmed product-specific treatment dates. Nothing is scheduled automatically."
          fields={[
            textfield("product", "Product / treatment", { required: true }),
            textfield("time", "Planned time", { type: "time" }),
            check("completed", "Applied as planned"),
            textfield("reaction", "Irritation or reaction"),
            notes,
          ]}
        />
      )}
      {tab === "maintenance" && (
        <EntryManager
          kind="maintenance"
          title="Personal maintenance"
          filter={(r) => str(r, "type") !== "Skincare treatment"}
          description="Use the Weekly Planner for recurring maintenance missions. Keep the routine realistic."
          fields={[
            {
              key: "type",
              label: "Task",
              type: "select",
              options: [
                "Laundry",
                "Hair care",
                "Nail care",
                "Grooming",
                "Clean work clothes",
                "Clean towels",
                "Pillowcase change",
                "Shower after work / gym",
                "Other",
              ],
            },
            check("completed", "Completed"),
            nfield("duration", "Minutes"),
            notes,
          ]}
        />
      )}
      <Chart
        title="Skin observations · logged values"
        rows={dateRows(logs, [
          "breakouts",
          "texture",
          "darkMarks",
          "irritation",
        ])}
        series={[
          { key: "breakouts", label: "Breakouts / 3" },
          { key: "irritation", label: "Irritation / 3" },
          { key: "texture", label: "Texture / 3", color: "#9c97cf" },
        ]}
      />
    </div>
  );
}
