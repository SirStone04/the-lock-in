import type { AppRecord, Kind } from "../domain/models";
export const BACKUP_VERSION = 1;
const kinds: Kind[] = [
  "mission",
  "daily",
  "sleep",
  "shift",
  "payroll",
  "account",
  "transaction",
  "budget",
  "bill",
  "debt",
  "study",
  "assessment",
  "milestone",
  "application",
  "research",
  "workout",
  "exerciseSet",
  "faith",
  "nutrition",
  "skincare",
  "maintenance",
  "week",
  "xp",
  "rankHistory",
  "achievement",
  "report",
  "settings",
  "routine",
  "inventory",
];
export interface Backup {
  application: "THE LOCK-IN";
  schemaVersion: 1;
  exportedAt: string;
  records: AppRecord[];
}
export function makeBackup(records: AppRecord[]): Backup {
  return {
    application: "THE LOCK-IN",
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    records,
  };
}
export function validateBackup(value: unknown): Backup {
  if (!value || typeof value !== "object")
    throw new Error("Backup must be a JSON object.");
  const v = value as Partial<Backup>;
  if (
    v.application !== "THE LOCK-IN" ||
    v.schemaVersion !== 1 ||
    typeof v.exportedAt !== "string" ||
    !Number.isFinite(Date.parse(v.exportedAt)) ||
    !Array.isArray(v.records)
  )
    throw new Error("Unsupported backup format or schema version.");
  if (v.records.length > 25000)
    throw new Error(
      "Backup exceeds 25,000 records. Restore in reviewed batches.",
    );
  const ids = new Set<string>();
  for (const r of v.records) {
    if (
      !r ||
      typeof r !== "object" ||
      typeof r.id !== "string" ||
      !/^[A-Za-z0-9_.:-]{1,200}$/.test(r.id) ||
      !kinds.includes(r.kind) ||
      typeof r.title !== "string" ||
      r.title.length > 500 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(r.date) ||
      !Number.isFinite(Date.parse(r.date + "T12:00:00Z")) ||
      new Date(r.date + "T12:00:00Z").toISOString().slice(0, 10) !== r.date ||
      !Number.isInteger(r.revision) ||
      r.revision < 1 ||
      typeof r.createdAt !== "string" ||
      !Number.isFinite(Date.parse(r.createdAt)) ||
      typeof r.updatedAt !== "string" ||
      !Number.isFinite(Date.parse(r.updatedAt)) ||
      !r.data ||
      typeof r.data !== "object" ||
      Array.isArray(r.data)
    )
      throw new Error(
        "Backup contains an invalid record. Nothing has been imported.",
      );
    if (JSON.stringify(r).length > 100000)
      throw new Error("A backup record is too large.");
    if (ids.has(r.id)) throw new Error(`Duplicate record ID: ${r.id}`);
    ids.add(r.id);
  }
  return v as Backup;
}
const b64 = (bytes: Uint8Array) =>
  btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(""));
const unb64 = (value: string) =>
  Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
async function derive(password: string, salt: Uint8Array<ArrayBuffer>) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 310000, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
export async function encodeBackup(
  records: AppRecord[],
  password = "",
): Promise<string> {
  const plain = JSON.stringify(makeBackup(records), null, 2);
  if (!password) return plain;
  if (password.length < 12)
    throw new Error(
      "Use at least 12 characters for an encrypted backup password.",
    );
  const salt = crypto.getRandomValues(new Uint8Array(16)),
    iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await derive(password, salt),
    new TextEncoder().encode(plain),
  );
  return JSON.stringify({
    application: "THE LOCK-IN",
    encryptedVersion: 1,
    algorithm: "AES-256-GCM",
    kdf: "PBKDF2-SHA256",
    iterations: 310000,
    salt: b64(salt),
    iv: b64(iv),
    cipher: b64(new Uint8Array(cipher)),
  });
}
export async function decodeBackup(
  text: string,
  password = "",
): Promise<Backup> {
  if (text.length > 30_000_000)
    throw new Error("Backup exceeds the 30 MB import limit.");
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("Backup is not valid JSON.");
  }
  if (value && typeof value === "object" && "encryptedVersion" in value) {
    const v = value as Record<string, unknown>;
    if (
      v.encryptedVersion !== 1 ||
      v.algorithm !== "AES-256-GCM" ||
      v.kdf !== "PBKDF2-SHA256" ||
      v.iterations !== 310000 ||
      typeof v.salt !== "string" ||
      typeof v.iv !== "string" ||
      typeof v.cipher !== "string"
    )
      throw new Error("Unsupported encrypted backup format.");
    try {
      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: unb64(v.iv) },
        await derive(password, unb64(v.salt)),
        unb64(v.cipher),
      );
      value = JSON.parse(new TextDecoder().decode(decrypted));
    } catch {
      throw new Error("Unable to decrypt backup. Check the password and file.");
    }
  }
  return validateBackup(value);
}
export function downloadText(
  text: string,
  name: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
