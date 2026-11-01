// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppProvider, useApp } from "../data/store";
import { LOCAL_DATABASE_NAME, localRecords, localSave } from "../data/local";
import { makeBackup } from "../data/backup";
import type { AppRecord, RecordInput } from "../domain/models";
const draft: RecordInput = {
  id: "daily-2026-11-01",
  kind: "daily",
  date: "2026-11-01",
  title: "Daily check-in",
  data: { energy: 5, reflection: "A realistic first day." },
};
const savedRecord: AppRecord = {
  ...draft,
  id: draft.id!,
  createdAt: "2026-11-01T12:00:00Z",
  updatedAt: "2026-11-01T12:00:00Z",
  revision: 1,
};
const resetDatabase = () =>
  new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(LOCAL_DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(new Error("A test left an IndexedDB connection open."));
  });
const mount = () => renderHook(() => useApp(), { wrapper: AppProvider });
beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  sessionStorage.setItem("lock-in-local", "yes");
  await resetDatabase();
  vi.stubGlobal(
    "BroadcastChannel",
    class {
      onmessage: ((event: unknown) => void) | null = null;
      postMessage() {}
      close() {}
    },
  );
});
afterEach(async () => {
  cleanup();
  await new Promise((resolve) => setTimeout(resolve, 0));
  vi.unstubAllGlobals();
});
describe("explicit local workspace integration", () => {
  it("persists an offline entry across provider close and reopen", async () => {
    const first = mount();
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });
    window.dispatchEvent(new Event("offline"));
    await act(async () => {
      await first.result.current.save(draft);
    });
    expect(first.result.current.mode).toBe("local");
    expect(first.result.current.records).toHaveLength(1);
    first.unmount();
    const reopened = mount();
    await waitFor(() => expect(reopened.result.current.loading).toBe(false));
    expect(reopened.result.current.records[0].data.energy).toBe(5);
    expect(reopened.result.current.online).toBe(false);
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    });
    window.dispatchEvent(new Event("online"));
  });
  it("edits one stable ID repeatedly without duplicate records or lost revisions", async () => {
    const app = mount();
    await waitFor(() => expect(app.result.current.loading).toBe(false));
    await act(async () => {
      await app.result.current.save(draft);
      await app.result.current.save({ ...draft, data: { energy: 6 } });
      await app.result.current.save({ ...draft, data: { energy: 7 } });
    });
    await waitFor(() =>
      expect(app.result.current.records[0]?.revision).toBe(3),
    );
    const persisted = await localRecords();
    expect(persisted).toHaveLength(1);
    expect(persisted[0].data.energy).toBe(7);
    expect(persisted[0].id).toBe(draft.id);
  });
  it("restores only missing IDs and preserves originals on repeated imports", async () => {
    const app = mount();
    await waitFor(() => expect(app.result.current.loading).toBe(false));
    const text = JSON.stringify(makeBackup([savedRecord]));
    let first = 0,
      second = 0;
    await act(async () => {
      first = await app.result.current.restoreBackup(text);
      second = await app.result.current.restoreBackup(text);
    });
    expect(first).toBe(1);
    expect(second).toBe(0);
    expect(await localRecords()).toEqual([savedRecord]);
  });
  it("rejects a stale edit from another session and exposes both versions", async () => {
    await localSave(draft);
    const app = mount();
    await waitFor(() => expect(app.result.current.records).toHaveLength(1));
    await localSave({ ...draft, revision: 1, data: { energy: 8 } });
    await act(async () => {
      await expect(
        app.result.current.save({ ...draft, revision: 1, data: { energy: 3 } }),
      ).rejects.toThrow("changed");
    });
    expect(app.result.current.conflict?.current?.data.energy).toBe(8);
    expect(app.result.current.conflict?.proposed.data.energy).toBe(3);
    expect((await localRecords())[0].data.energy).toBe(8);
  });
  it("blocks new saves during deletion and releases maintenance after completion", async () => {
    const app = mount();
    await waitFor(() => expect(app.result.current.loading).toBe(false));
    await act(async () => {
      await app.result.current.save(draft);
    });
    await act(async () => {
      const deletion = app.result.current.deleteAll();
      await expect(app.result.current.save(draft)).rejects.toThrow(
        "maintenance",
      );
      await deletion;
    });
    expect(app.result.current.maintenance).toBe(false);
    expect(await localRecords()).toHaveLength(0);
    await act(async () => {
      await app.result.current.save(draft);
    });
    expect(await localRecords()).toHaveLength(1);
  });
  it("rejects impossible dates and nonfinite JSON numbers before writing", async () => {
    const app = mount();
    await waitFor(() => expect(app.result.current.loading).toBe(false));
    await expect(
      app.result.current.save({ ...draft, date: "2026-02-30" }),
    ).rejects.toThrow("calendar date");
    await expect(
      app.result.current.save({ ...draft, data: { amount: NaN } }),
    ).rejects.toThrow("finite");
    expect(await localRecords()).toHaveLength(0);
  });
});
