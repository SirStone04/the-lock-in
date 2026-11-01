import { describe, it, expect } from "vitest";
import {
  decodeBackup,
  encodeBackup,
  makeBackup,
  validateBackup,
} from "../data/backup";
import type { AppRecord } from "../domain/models";
const r: AppRecord = {
  id: "one",
  kind: "daily",
  date: "2026-11-01",
  title: "Daily",
  data: { energy: 5 },
  createdAt: "2026-11-01T00:00:00Z",
  updatedAt: "2026-11-01T00:00:00Z",
  revision: 1,
};
describe("versioned backups", () => {
  it("roundtrips plain backups", async () => {
    expect((await decodeBackup(await encodeBackup([r]))).records).toEqual([r]);
  });
  it("rejects duplicates, corrupt records, unsupported schemas", () => {
    expect(() =>
      validateBackup({ ...makeBackup([r]), records: [r, r] }),
    ).toThrow("Duplicate");
    expect(() =>
      validateBackup({ ...makeBackup([r]), schemaVersion: 2 }),
    ).toThrow("schema");
    expect(() =>
      validateBackup({
        ...makeBackup([r]),
        records: [{ ...r, id: "../invalid" }],
      }),
    ).toThrow("invalid");
  });
  it("roundtrips authenticated encrypted backup and rejects wrong password", async () => {
    const encrypted = await encodeBackup([r], "a long password for backup");
    expect(encrypted).not.toContain("Daily");
    expect(
      (await decodeBackup(encrypted, "a long password for backup")).records,
    ).toEqual([r]);
    await expect(decodeBackup(encrypted, "wrong")).rejects.toThrow("decrypt");
    const damaged = JSON.parse(encrypted);
    damaged.cipher =
      (damaged.cipher[0] === "A" ? "B" : "A") + damaged.cipher.slice(1);
    await expect(
      decodeBackup(JSON.stringify(damaged), "a long password for backup"),
    ).rejects.toThrow("decrypt");
  });
});
