import type { AppRecord, RecordInput } from "../domain/models";
import { validateInput } from "./validation";
export const LOCAL_DATABASE_NAME = "lock-in-explicit-local-workspace-v1";
const database = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(LOCAL_DATABASE_NAME, 1);
    req.onupgradeneeded = () =>
      req.result.createObjectStore("records", { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
export class LocalConflictError extends Error {
  constructor(public current: AppRecord | null) {
    super(
      "This record changed while you were editing. Review the conflict before saving.",
    );
  }
}
export async function localRecords(): Promise<AppRecord[]> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("records", "readonly"),
      req = tx.objectStore("records").getAll();
    let result: AppRecord[] = [];
    req.onsuccess = () => {
      result = req.result;
    };
    tx.oncomplete = () => {
      db.close();
      resolve(result);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error ?? new Error("Reading local records was interrupted."));
    };
  });
}
// Revision validation and write happen in the same IndexedDB transaction. A React
// render or another tab cannot insert a competing revision between these steps.
export async function localSave(input: RecordInput): Promise<AppRecord> {
  validateInput(input);
  const id = input.id ?? crypto.randomUUID(),
    db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("records", "readwrite"),
      store = tx.objectStore("records"),
      req = store.get(id);
    let saved: AppRecord, failure: Error | undefined;
    req.onsuccess = () => {
      const existing = req.result as AppRecord | undefined;
      const revision = existing?.revision ?? 0;
      if (input.revision !== undefined && input.revision !== revision) {
        failure = new LocalConflictError(existing ?? null);
        tx.abort();
        return;
      }
      if (existing && existing.kind !== input.kind) {
        failure = new Error("An existing record cannot change its type.");
        tx.abort();
        return;
      }
      const now = new Date().toISOString();
      saved = {
        id,
        kind: input.kind,
        date: input.date,
        title: input.title,
        data: input.data,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        revision: revision + 1,
      };
      store.put(saved);
    };
    tx.oncomplete = () => {
      db.close();
      resolve(saved);
    };
    tx.onabort = () => {
      db.close();
      reject(
        failure ??
          tx.error ??
          new Error("Saving local records was interrupted."),
      );
    };
    tx.onerror = () => {
      db.close();
      reject(failure ?? tx.error);
    };
  });
}
// Restore adds absent IDs only, even if another tab imports the same backup.
export async function localRestore(records: AppRecord[]): Promise<AppRecord[]> {
  records.forEach(validateInput);
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("records", "readwrite"),
      store = tx.objectStore("records"),
      inserted: AppRecord[] = [];
    const seen = new Set<string>();
    for (const record of records) {
      if (seen.has(record.id)) continue;
      seen.add(record.id);
      const req = store.get(record.id);
      req.onsuccess = () => {
        if (!req.result) {
          const copy = { ...record, revision: 1 };
          store.put(copy);
          inserted.push(copy);
        }
      };
    }
    tx.oncomplete = () => {
      db.close();
      resolve(inserted);
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error ?? new Error("Restoring local records was interrupted."));
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
export async function localWrite(record: AppRecord) {
  validateInput(record);
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("records", "readwrite");
    tx.objectStore("records").put(record);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error ?? new Error("Local write interrupted."));
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
export async function localRemove(id: string) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("records", "readwrite");
    tx.objectStore("records").delete(id);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error ?? new Error("Local deletion interrupted."));
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
