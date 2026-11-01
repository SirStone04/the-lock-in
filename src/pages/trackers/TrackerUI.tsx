import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AppRecord } from "../../domain/models";
import { num } from "../../domain/models";
import { today, weekStart, weekEnd } from "../../domain/dates";
import { Button, Card, Empty } from "../../components/ui";
import type { FieldSpec } from "../../components/EntryManager";

export const money = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    value,
  );
export const nfield = (
  key: string,
  label: string,
  extra: Partial<FieldSpec> = {},
): FieldSpec => ({ key, label, type: "number", min: 0, step: "any", ...extra });
export const textfield = (
  key: string,
  label: string,
  extra: Partial<FieldSpec> = {},
): FieldSpec => ({ key, label, type: "text", ...extra });
export const check = (key: string, label: string): FieldSpec => ({
  key,
  label,
  type: "checkbox",
});
export const notes: FieldSpec = {
  key: "notes",
  label: "Notes",
  type: "textarea",
};
export const metric10 = (key: string, label: string) =>
  nfield(key, `${label} · 1–10`, { min: 1, max: 10, step: 1 });

export function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail?: string;
}) {
  return (
    <Card>
      <div className="eyebrow muted">{label}</div>
      <div
        className="metric-value"
        style={{ fontSize: "1.85rem", fontWeight: 700, margin: "8px 0" }}
      >
        {value}
      </div>
      {detail && <small className="muted">{detail}</small>}
    </Card>
  );
}

export function usePeriod() {
  const [period, setPeriod] = useState("week");
  const date = today();
  const start =
    period === "week"
      ? weekStart(date)
      : period === "month"
        ? `${date.slice(0, 7)}-01`
        : period === "year"
          ? `${date.slice(0, 4)}-01-01`
          : "0000-01-01";
  const end = period === "week" ? weekEnd(date) : date;
  const includes = (r: AppRecord) => r.date >= start && r.date <= end;
  return {
    start,
    end,
    includes,
    control: (
      <div className="tabs" role="group" aria-label="Analytics period">
        {[
          ["week", "This week"],
          ["month", "This month"],
          ["year", "This year"],
          ["all", "All time"],
        ].map(([value, label]) => (
          <Button
            key={value}
            variant={period === value ? "primary" : "ghost"}
            onClick={() => setPeriod(value)}
            aria-pressed={period === value}
          >
            {label}
          </Button>
        ))}
      </div>
    ),
  };
}

export function Chart({
  title,
  rows,
  series,
  kind = "line",
}: {
  title: string;
  rows: { date: string; [key: string]: number | string }[];
  series: { key: string; label: string; color?: string }[];
  kind?: "line" | "bar" | "area";
}) {
  return (
    <Card>
      <h3>{title}</h3>
      {rows.some((row) =>
        series.some((s) => typeof row[s.key] === "number"),
      ) ? (
        <div
          style={{ width: "100%", height: 245, marginTop: 16 }}
          role="img"
          aria-label={`${title}. ${rows.map((r) => `${r.date}: ${series.map((s) => `${s.label} ${r[s.key] ?? "missing"}`).join(", ")}`).join("; ")}`}
        >
          <ResponsiveContainer width="100%" height="100%">
            {kind === "bar" ? (
              <BarChart data={rows}>
                <CartesianGrid strokeDasharray="3 3" stroke="#293242" />
                <XAxis
                  dataKey="date"
                  stroke="#9aa9bd"
                  tick={{ fontSize: 11 }}
                />
                <YAxis stroke="#9aa9bd" tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                {series.map((s, i) => (
                  <Bar
                    key={s.key}
                    dataKey={s.key}
                    name={s.label}
                    fill={s.color ?? ["#d8b267", "#71a6e5", "#7fc7a9"][i % 3]}
                    radius={[3, 3, 0, 0]}
                  />
                ))}
              </BarChart>
            ) : kind === "area" ? (
              <AreaChart data={rows}>
                <CartesianGrid strokeDasharray="3 3" stroke="#293242" />
                <XAxis
                  dataKey="date"
                  stroke="#9aa9bd"
                  tick={{ fontSize: 11 }}
                />
                <YAxis stroke="#9aa9bd" />
                <Tooltip />
                <Legend />
                {series.map((s, i) => (
                  <Area
                    key={s.key}
                    dataKey={s.key}
                    name={s.label}
                    stroke={s.color ?? ["#d8b267", "#71a6e5"][i % 2]}
                    fill={s.color ?? ["#d8b267", "#71a6e5"][i % 2]}
                    fillOpacity={0.1}
                    connectNulls={false}
                  />
                ))}
              </AreaChart>
            ) : (
              <LineChart data={rows}>
                <CartesianGrid strokeDasharray="3 3" stroke="#293242" />
                <XAxis
                  dataKey="date"
                  stroke="#9aa9bd"
                  tick={{ fontSize: 11 }}
                />
                <YAxis stroke="#9aa9bd" tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                {series.map((s, i) => (
                  <Line
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    name={s.label}
                    stroke={s.color ?? ["#d8b267", "#71a6e5", "#7fc7a9"][i % 3]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls={false}
                  />
                ))}
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      ) : (
        <Empty
          title="Your history starts here"
          description="Charts appear when you save actual records. Planned activity is never shown as completed."
        />
      )}
    </Card>
  );
}

export function total(records: AppRecord[], key: string) {
  return records.reduce((sum, r) => sum + num(r, key), 0);
}
export function average(records: AppRecord[], key: string) {
  const logged = records.filter((r) => typeof r.data[key] === "number");
  return logged.length ? total(logged, key) / logged.length : null;
}
export function formatAvg(value: number | null, suffix = "") {
  return value === null ? "Not logged" : `${value.toFixed(1)}${suffix}`;
}
export function dateRows(records: AppRecord[], keys: string[]) {
  const grouped = new Map<
    string,
    { date: string; [key: string]: number | string }
  >();
  for (const record of records) {
    const row = grouped.get(record.date) ?? { date: record.date };
    for (const key of keys)
      if (typeof record.data[key] === "number")
        row[key] = Number(row[key] ?? 0) + num(record, key);
    grouped.set(record.date, row);
  }
  return [...grouped.values()].sort((a, b) => a.date.localeCompare(b.date));
}
