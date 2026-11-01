import type { RecordInput } from "../domain/models";
// Crash-recovery drafts are never read as records or included in calculations.
// They only preserve the user's attempted content until Firestore acknowledges it.
const prefix = (uid: string) => `lock-in-recovery-v1:${uid}:`;
export function keepAttempt(uid: string, input: RecordInput) {
  localStorage.setItem(prefix(uid) + input.id, JSON.stringify(input));
}
export function clearAttempt(uid: string, id: string, expected?: RecordInput) {
  const key = prefix(uid) + id;
  if (expected && localStorage.getItem(key) !== JSON.stringify(expected))
    return;
  localStorage.removeItem(key);
}
export function readAttempts(uid: string): RecordInput[] {
  const drafts: RecordInput[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(prefix(uid))) continue;
    try {
      const v = JSON.parse(localStorage.getItem(key) ?? "null");
      if (
        v &&
        typeof v.id === "string" &&
        typeof v.kind === "string" &&
        typeof v.date === "string" &&
        typeof v.title === "string" &&
        v.data &&
        typeof v.data === "object"
      )
        drafts.push(v as RecordInput);
    } catch {
      /* A corrupt recovery hint is never promoted to an authoritative record. */
    }
  }
  return drafts;
}
export function equivalentData(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) || Array.isArray(b))
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((value, index) => equivalentData(value, b[index]))
    );
  const left = a as Record<string, unknown>,
    right = b as Record<string, unknown>,
    keys = Object.keys(left);
  return (
    keys.length === Object.keys(right).length &&
    keys.every(
      (key) =>
        Object.hasOwn(right, key) && equivalentData(left[key], right[key]),
    )
  );
}
