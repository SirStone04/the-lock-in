import { useApp } from "../../data/store";
import { bool, str } from "../../domain/models";
import type { Data } from "../../domain/models";
import { Card, PageHeader } from "../../components/ui";
import { EntryManager } from "../../components/EntryManager";
import {
  nfield,
  textfield,
  check,
  notes,
  metric10,
  Stat,
  usePeriod,
  Chart,
  total,
  average,
  formatAvg,
  dateRows,
} from "./TrackerUI";
import { QuickRoutine } from "./QuickRoutine";

export function Nutrition() {
  const { records } = useApp();
  const profile = records.find((r) => r.id === "settings-profile");
  const rawRoutine = profile?.data.nutritionRoutine;
  const routine: Data =
    rawRoutine && typeof rawRoutine === "object" && !Array.isArray(rawRoutine)
      ? rawRoutine
      : {};
  const period = usePeriod();
  const logs = records.filter(
    (r) => r.kind === "nutrition" && period.includes(r),
  );
  const mealCount = logs.reduce(
    (sum, r) =>
      sum +
      ["breakfast", "lunch", "dinner", "snack"].filter((k) => bool(r, k))
        .length,
    0,
  );
  return (
    <div className="section-stack">
      <PageHeader
        eyebrow="FUEL YOUR COMMITMENTS"
        title="Nutrition"
        description="Affordable meals, hydration, and adequate energy for demanding shifts. Calorie and protein targets remain unset until you choose them."
        actions={period.control}
      />
      <div className="stats-grid">
        <Stat label="Meals logged" value={mealCount} />
        <Stat label="Water logged" value={`${total(logs, "water")} oz`} />
        <Stat
          label="Protein measured"
          value={`${total(logs, "protein")} g`}
          detail="Logged amounts only · no target set"
        />
        <Stat
          label="Average energy"
          value={formatAvg(average(logs, "energy"), " / 10")}
        />
      </div>
      <QuickRoutine
        kind="nutrition"
        title="Daily fueling"
        items={[
          { key: "breakfast", label: "Breakfast" },
          { key: "lunch", label: "Lunch" },
          { key: "dinner", label: "Dinner" },
          { key: "snack", label: "Pre-work snack" },
        ]}
        hint="One tap records a routine meal. Add hydration and details in the log below."
      />
      <Card>
        <h3>Your meal routine</h3>
        <div className="grid-2">
          <div>
            <p>
              <strong>Breakfast</strong>
              <br />
              <span className="muted">
                {typeof routine.breakfast === "string" && routine.breakfast
                  ? routine.breakfast
                  : "No breakfast routine set."}
              </span>
            </p>
            <p>
              <strong>Before work</strong>
              <br />
              <span className="muted">
                {typeof routine.snack === "string" && routine.snack
                  ? routine.snack
                  : "No pre-work snack routine set."}
              </span>
            </p>
          </div>
          <div>
            <p>
              <strong>Lunch</strong>
              <br />
              <span className="muted">
                {typeof routine.lunch === "string" && routine.lunch
                  ? routine.lunch
                  : "No lunch routine set."}
              </span>
            </p>
            <p>
              <strong>Dinner</strong>
              <br />
              <span className="muted">
                {typeof routine.dinner === "string" && routine.dinner
                  ? routine.dinner
                  : "No dinner routine set."}
              </span>
            </p>
          </div>
        </div>
        <p className="muted">
          {str(profile, "nutritionNotes") ||
            "Add your own meal routine in your private profile. Actual meal entries remain separate below."}
        </p>
      </Card>
      <EntryManager
        kind="nutrition"
        title="Nutrition log"
        description="Enter measured amounts when known. Food cost here is context; log the actual purchase in Finances once."
        fields={[
          check("breakfast", "Breakfast"),
          check("lunch", "Lunch"),
          check("dinner", "Dinner"),
          check("snack", "Pre-work snack"),
          nfield("water", "Water · fluid ounces"),
          nfield("protein", "Protein measured · grams"),
          nfield("calories", "Calories measured · optional"),
          metric10("energy", "Energy"),
          metric10("hunger", "Hunger"),
          nfield("foodSpending", "Food spending reference · $"),
          nfield("bodyWeight", "Body weight · lb · optional"),
          textfield("measurements", "Body measurements · optional"),
          notes,
        ]}
      />
      <Chart
        title="Hydration and measured protein"
        rows={dateRows(logs, ["water", "protein"])}
        series={[
          { key: "water", label: "Water · oz", color: "#71a6e5" },
          { key: "protein", label: "Protein · g", color: "#d8b267" },
        ]}
      />
    </div>
  );
}
