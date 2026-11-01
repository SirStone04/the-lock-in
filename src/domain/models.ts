export type Kind =
  | "mission"
  | "daily"
  | "sleep"
  | "shift"
  | "payroll"
  | "account"
  | "transaction"
  | "budget"
  | "bill"
  | "debt"
  | "study"
  | "assessment"
  | "milestone"
  | "application"
  | "research"
  | "workout"
  | "exerciseSet"
  | "faith"
  | "nutrition"
  | "skincare"
  | "maintenance"
  | "week"
  | "xp"
  | "rankHistory"
  | "achievement"
  | "report"
  | "settings"
  | "routine"
  | "inventory";
export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type Data = { [key: string]: JsonValue };
export interface AppRecord {
  id: string;
  kind: Kind;
  date: string;
  title: string;
  data: Data;
  createdAt: string;
  updatedAt: string;
  revision: number;
}
export interface RecordInput {
  id?: string;
  kind: Kind;
  date: string;
  title: string;
  data: Data;
  revision?: number;
}
export type Category =
  | "Faith"
  | "Education"
  | "Employment"
  | "Fitness"
  | "Finances"
  | "Nutrition"
  | "Skincare"
  | "Maintenance"
  | "Recovery";
export const categories: Category[] = [
  "Faith",
  "Education",
  "Employment",
  "Fitness",
  "Finances",
  "Nutrition",
  "Skincare",
  "Maintenance",
  "Recovery",
];
export const num = (
  r: AppRecord | undefined,
  key: string,
  fallback = 0,
): number =>
  typeof r?.data[key] === "number" ? (r.data[key] as number) : fallback;
export const str = (
  r: AppRecord | undefined,
  key: string,
  fallback = "",
): string =>
  typeof r?.data[key] === "string" ? (r.data[key] as string) : fallback;
export const bool = (r: AppRecord | undefined, key: string): boolean =>
  r?.data[key] === true;
