import { afterEach, describe, it, expect, vi } from "vitest";
import {
  clearAttempt,
  equivalentData,
  keepAttempt,
  readAttempts,
} from "../data/recovery";
import type { RecordInput } from "../domain/models";
afterEach(() => vi.unstubAllGlobals());
describe("conflict recovery comparison", () => {
  it("does not mistake Firestore map key order for a conflict", () => {
    expect(
      equivalentData(
        { a: 1, nested: { b: 2, a: 1 } },
        { nested: { a: 1, b: 2 }, a: 1 },
      ),
    ).toBe(true);
  });
  it("detects real edits including missing fields and changed array order", () => {
    expect(equivalentData({ a: 1 }, { a: 2 })).toBe(false);
    expect(equivalentData({ a: null }, {})).toBe(false);
    expect(equivalentData([1, 2], [2, 1])).toBe(false);
  });
  it("retains a later offline attempt when an earlier write is acknowledged", () => {
    const items = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      get length() {
        return items.size;
      },
      key: (i: number) => [...items.keys()][i] ?? null,
      setItem: (k: string, v: string) => items.set(k, v),
      getItem: (k: string) => items.get(k) ?? null,
      removeItem: (k: string) => items.delete(k),
    });
    const first: RecordInput = {
      id: "daily-1",
      kind: "daily",
      date: "2026-11-01",
      title: "Daily check-in",
      data: { energy: 5 },
      revision: 1,
    };
    const later = { ...first, data: { energy: 6 }, revision: 2 };
    keepAttempt("owner", first);
    keepAttempt("owner", later);
    clearAttempt("owner", "daily-1", first);
    expect(readAttempts("owner")).toEqual([later]);
    expect(readAttempts("other-owner")).toEqual([]);
    clearAttempt("owner", "daily-1", later);
    expect(readAttempts("owner")).toEqual([]);
  });
});
