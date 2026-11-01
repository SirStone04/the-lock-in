import type { RecordInput } from "../domain/models";
export function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const timestamp = Date.parse(`${value}T12:00:00Z`);
  return (
    Number.isFinite(timestamp) &&
    new Date(timestamp).toISOString().slice(0, 10) === value
  );
}
export function validJson(
  value: unknown,
  depth = 0,
  visited = new Set<object>(),
): boolean {
  if (depth > 20) return false;
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object" || visited.has(value)) return false;
  if (
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) !== Object.prototype &&
    Object.getPrototypeOf(value) !== null
  )
    return false;
  visited.add(value);
  const valid = (Array.isArray(value) ? value : Object.values(value)).every(
    (item) => validJson(item, depth + 1, visited),
  );
  visited.delete(value);
  return valid;
}
export function validateInput(input: RecordInput) {
  if (input.id !== undefined && !/^[A-Za-z0-9_.:-]{1,200}$/.test(input.id))
    throw new Error("Invalid record ID.");
  if (!validDate(input.date)) throw new Error("Enter a valid calendar date.");
  if (typeof input.title !== "string" || input.title.length > 500)
    throw new Error("Record titles must contain at most 500 characters.");
  if (!input.data || Array.isArray(input.data) || !validJson(input.data))
    throw new Error("Record data must contain valid JSON and finite numbers.");
  if (JSON.stringify(input.data).length > 100000)
    throw new Error("Record data exceeds the 100 KB limit.");
  if (
    input.revision !== undefined &&
    (!Number.isInteger(input.revision) || input.revision < 0)
  )
    throw new Error("Invalid record revision.");
}
