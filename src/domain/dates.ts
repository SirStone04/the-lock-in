import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export const TIMEZONE = "America/New_York";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export function validDate(date: string): boolean {
  if (!DATE_PATTERN.test(date)) return false;
  const d = new Date(`${date}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date;
}
export function today(now: Date = new Date()): string {
  return formatInTimeZone(now, TIMEZONE, "yyyy-MM-dd");
}
export function addDays(date: string, amount: number): string {
  if (!validDate(date) || !Number.isInteger(amount))
    throw new Error("Use a valid calendar date and whole number of days.");
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + amount);
  return d.toISOString().slice(0, 10);
}
export function dayOfWeek(date: string): number {
  if (!validDate(date)) throw new Error("Invalid calendar date.");
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}
export function weekStart(date: string = today()): string {
  return addDays(date, -dayOfWeek(date));
}
export function weekEnd(date: string = today()): string {
  return addDays(weekStart(date), 6);
}
export function weekDates(date: string = today()): string[] {
  const start = weekStart(date);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}
export function formatDate(date: string, pattern = "EEE, MMM d"): string {
  if (!validDate(date)) return date;
  return formatInTimeZone(new Date(`${date}T12:00:00Z`), TIMEZONE, pattern);
}
export function localDateTime(value: string): Date {
  if (!value) throw new Error("Enter a date and time.");
  const d = /(?:Z|[+-]\d\d:\d\d)$/.test(value)
    ? new Date(value)
    : fromZonedTime(value, TIMEZONE);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid date and time.");
  return d;
}
export function dateTimeHours(start: string, end: string): number {
  const duration =
    (localDateTime(end).getTime() - localDateTime(start).getTime()) / 3_600_000;
  if (duration < 0 || duration > 48)
    throw new Error("End must follow start and be within 48 hours.");
  return Math.round(duration * 10000) / 10000;
}
export function inRange(date: string, start?: string, end?: string): boolean {
  return (!start || date >= start) && (!end || date <= end);
}
