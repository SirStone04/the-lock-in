import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { readFileSync } from "node:fs";
let env: RulesTestEnvironment;
const record = {
  id: "m1",
  kind: "mission",
  date: "2026-11-01",
  title: "Prayer",
  data: { status: "not_started" },
  createdAt: "2026-11-01T12:00:00Z",
  updatedAt: "2026-11-01T12:00:00Z",
  revision: 1,
};
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-lock-in",
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});
beforeEach(async () => env.clearFirestore());
afterAll(async () => env?.cleanup());
describe("owner-only records and revision integrity", () => {
  it("allows owner create/read/update/delete", async () => {
    const ref = doc(
      env.authenticatedContext("alice").firestore(),
      "users/alice/records/m1",
    );
    await assertSucceeds(setDoc(ref, record));
    await assertSucceeds(getDoc(ref));
    await assertSucceeds(
      setDoc(ref, { ...record, title: "Updated", revision: 2 }),
    );
    await assertSucceeds(deleteDoc(ref));
  });
  it("denies anonymous and cross-user access", async () => {
    for (const db of [
      env.unauthenticatedContext().firestore(),
      env.authenticatedContext("bob").firestore(),
    ]) {
      const ref = doc(db, "users/alice/records/m1");
      await assertFails(setDoc(ref, record));
      await assertFails(getDoc(ref));
      await assertFails(deleteDoc(ref));
    }
  });
  it("rejects stale simultaneous edits and schema manipulation", async () => {
    const ref = doc(
      env.authenticatedContext("alice").firestore(),
      "users/alice/records/m1",
    );
    await assertSucceeds(setDoc(ref, record));
    await assertSucceeds(setDoc(ref, { ...record, revision: 2 }));
    await assertFails(setDoc(ref, { ...record, title: "Stale", revision: 2 }));
    await assertFails(
      setDoc(ref, { ...record, revision: 3, kind: "transaction" }),
    );
    await assertFails(setDoc(ref, { ...record, revision: 3, public: true }));
  });
  it("rejects mismatched identity and unrecognized collections", async () => {
    const db = env.authenticatedContext("alice").firestore();
    await assertFails(setDoc(doc(db, "users/alice/records/wrong"), record));
    await assertFails(setDoc(doc(db, "public/m1"), record));
  });
});
