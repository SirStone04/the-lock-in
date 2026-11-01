import { useRef, useState } from "react";
import {
  Download,
  KeyRound,
  LogOut,
  ShieldCheck,
  Smartphone,
  Upload,
  Bell,
  Trash2,
} from "lucide-react";
import { useApp } from "../data/store";
import { decodeBackup, downloadText } from "../data/backup";
import { Button, Card, Field, PageHeader } from "../components/ui";
export default function Settings() {
  const app = useApp(),
    [password, setPassword] = useState(""),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false),
    [deleteText, setDeleteText] = useState(""),
    [importText, setImportText] = useState(""),
    [preview, setPreview] = useState<{
      count: number;
      duplicates: number;
    } | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const settings = app.records.find((r) => r.id === "preferences");
  const lastBackup = localStorage.getItem("lock-in-last-backup");
  const perform = async (fn: () => Promise<void>) => {
    setBusy(true);
    setStatus("");
    try {
      await fn();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Unable to complete request.");
    } finally {
      setBusy(false);
    }
  };
  const savePreference = async (key: string, value: string | boolean) => {
    await app.save({
      id: "preferences",
      kind: "settings",
      date: new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/New_York",
      }).format(new Date()),
      title: "Preferences",
      data: { ...settings?.data, [key]: value },
      revision: settings?.revision ?? 0,
    });
  };
  return (
    <>
      <PageHeader
        eyebrow="YOUR WORKSPACE"
        title="Settings & Backup"
        description="Keep your account private, your data protected, and your routine your own."
      />
      <div className="grid-2">
        <Card>
          <div className="section-heading">
            <ShieldCheck />
            <h2>Account & synchronization</h2>
          </div>
          <p>
            <strong>
              {app.mode === "local" ? "Local workspace" : app.user?.email}
            </strong>
          </p>
          <p className="muted">
            {app.mode === "local"
              ? "Records are saved in this browser only. Device changes and browser data removal can erase them. Export a backup before moving devices."
              : "Firebase is the synchronized record store. Separate records reduce collisions. Revision checks reject stale changes instead of silently replacing newer edits."}
          </p>
          <div className="metric-row">
            <span>Connection</span>
            <strong>{app.online ? "Online" : "Offline"}</strong>
          </div>
          <div className="metric-row">
            <span>Write status</span>
            <strong>
              {app.pending ? "Waiting to synchronize" : "No pending writes"}
            </strong>
          </div>
          {app.mode === "cloud" && (
            <>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={app.trusted}
                  onChange={(e) => {
                    if (app.pending) {
                      setStatus(
                        "Wait for pending writes before changing persistence.",
                      );
                      return;
                    }
                    if (
                      e.target.checked &&
                      !confirm(
                        "Enable persistent offline storage on this private device? Sensitive financial and personal records will remain in browser storage after sign out. Do not enable this on a shared device.",
                      )
                    )
                      return;
                    app.setTrusted(e.target.checked);
                  }}
                />
                Enable offline persistence on this private device
              </label>
              <p className="muted">
                Shared devices use memory caching and a session login. Turning
                persistence off does not erase a previous browser cache; use
                your browser’s site-data controls when leaving a device.
              </p>
              <Button
                variant="secondary"
                onClick={() =>
                  void perform(async () => {
                    await app.resetPassword(app.user?.email ?? "");
                    setStatus("Password reset requested. Check your email.");
                  })
                }
              >
                <KeyRound size={16} />
                Reset password
              </Button>
            </>
          )}
          <div className="button-row">
            <Button
              variant="secondary"
              onClick={() =>
                void perform(async () => {
                  if (app.mode === "local") app.exitLocal();
                  else await app.signOut();
                })
              }
            >
              <LogOut size={16} />
              {app.mode === "local" ? "Leave local workspace" : "Sign out"}
            </Button>
          </div>
        </Card>
        <Card>
          <div className="section-heading">
            <Download />
            <h2>Versioned backups</h2>
          </div>
          <p className="muted">
            Cloud synchronization is not a backup. Export weekly and store a
            copy somewhere you trust. Encrypted backups use AES-256-GCM and a
            password-derived key; a forgotten password cannot be recovered.
          </p>
          <Field label="Optional backup password (12+ characters)">
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave blank for plain JSON"
            />
          </Field>
          <Button
            disabled={busy}
            onClick={() =>
              void perform(async () => {
                downloadText(
                  await app.exportBackup(password),
                  `the-lock-in-backup-${new Date().toISOString().slice(0, 10)}.json`,
                );
                localStorage.setItem(
                  "lock-in-last-backup",
                  new Date().toISOString(),
                );
                setStatus("Backup downloaded. Keep it outside this browser.");
              })
            }
          >
            <Download size={16} />
            Export all data
          </Button>
          <p className="muted">
            Last backup:{" "}
            {lastBackup
              ? new Date(lastBackup).toLocaleDateString()
              : "No backup recorded on this device"}
            .{" "}
            {(!lastBackup ||
              Date.now() - Date.parse(lastBackup) > 7 * 86400000) &&
              "A weekly backup is due."}
          </p>
          <input
            ref={file}
            hidden
            type="file"
            accept="application/json,.json"
            onChange={(e) =>
              void perform(async () => {
                const f = e.target.files?.[0];
                if (!f) return;
                const text = await f.text();
                const backup = await decodeBackup(text, password);
                const ids = new Set(app.records.map((r) => r.id));
                setImportText(text);
                setPreview({
                  count: backup.records.filter((r) => !ids.has(r.id)).length,
                  duplicates: backup.records.filter((r) => ids.has(r.id))
                    .length,
                });
                setStatus("Backup validated. Review the import below.");
              })
            }
          />
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => file.current?.click()}
          >
            <Upload size={16} />
            Select backup to restore
          </Button>
          {preview && (
            <div className="notice">
              <p>
                {preview.count} new records · {preview.duplicates} existing IDs
                will be preserved. Restore adds missing records only.
              </p>
              <Button
                disabled={busy || preview.count === 0}
                onClick={() =>
                  void perform(async () => {
                    const count = await app.restoreBackup(importText, password);
                    setPreview(null);
                    setImportText("");
                    setStatus(
                      `Restored ${count} records. Cloud writes may still be pending; check synchronization status.`,
                    );
                  })
                }
              >
                Confirm restore
              </Button>
            </div>
          )}
        </Card>
        <Card>
          <div className="section-heading">
            <Smartphone />
            <h2>Appearance & installation</h2>
          </div>
          <Field label="Color theme">
            <select
              value={String(settings?.data.theme ?? "dark")}
              onChange={(e) =>
                void perform(() => savePreference("theme", e.target.value))
              }
            >
              <option value="dark">Dark tactical</option>
              <option value="light">Light</option>
            </select>
          </Field>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={settings?.data.reducedMotion === true}
              onChange={(e) =>
                void perform(() =>
                  savePreference("reducedMotion", e.target.checked),
                )
              }
            />
            Reduce animations and promotion effects
          </label>
          <p className="muted">
            On iPhone, open your deployed HTTPS app in Safari, tap Share, then
            Add to Home Screen. Sign in with the same Firebase account on your
            laptop. Offline entry requires loading the app online first and
            enabling private-device persistence.
          </p>
          <p className="muted">
            Timezone: America/New_York. Weeks run Sunday through Saturday.
          </p>
        </Card>
        <Card>
          <div className="section-heading">
            <Bell />
            <h2>Reminders</h2>
          </div>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={settings?.data.reminders !== false}
              onChange={(e) =>
                void perform(() =>
                  savePreference("reminders", e.target.checked),
                )
              }
            />
            Show in-app planning and check-in reminders
          </label>
          <div className="form-grid">
            <Field label="Morning reminder · Eastern">
              <input
                type="time"
                defaultValue={String(settings?.data.morningReminder ?? "08:30")}
                onBlur={(e) => {
                  if (e.target.value)
                    void perform(() =>
                      savePreference("morningReminder", e.target.value),
                    );
                }}
              />
            </Field>
            <Field label="Evening reminder · Eastern">
              <input
                type="time"
                defaultValue={String(settings?.data.eveningReminder ?? "22:30")}
                onBlur={(e) => {
                  if (e.target.value)
                    void perform(() =>
                      savePreference("eveningReminder", e.target.value),
                    );
                }}
              />
            </Field>
          </div>
          <Button
            variant="secondary"
            onClick={() =>
              void perform(async () => {
                if (!("Notification" in window))
                  throw new Error(
                    "This browser does not support notifications. In-app reminders remain available.",
                  );
                const permission = await Notification.requestPermission();
                setStatus(
                  permission === "granted"
                    ? "Notifications are allowed while the app is open. Closed iPhone background scheduling is not supported."
                    : "Notification permission was not granted. In-app reminders remain available.",
                );
              })
            }
          >
            Enable browser notifications
          </Button>
          <p className="muted">
            Reminders appear when the app is opened. No closed-app iPhone jobs
            or paid push infrastructure are used.
          </p>
        </Card>
        <Card>
          <div className="section-heading">
            <Trash2 />
            <h2>Delete personal data</h2>
          </div>
          <p className="muted">
            This permanently deletes all records in the current workspace,
            including reports and financial entries. Your Firebase login remains
            active. Export a backup first.
          </p>
          <Field label="Type DELETE ALL to confirm">
            <input
              value={deleteText}
              onChange={(e) => setDeleteText(e.target.value)}
              placeholder="DELETE ALL"
            />
          </Field>
          <Button
            variant="danger"
            disabled={busy || deleteText !== "DELETE ALL"}
            onClick={() =>
              void perform(async () => {
                await app.deleteAll();
                setDeleteText("");
                setStatus("All workspace records deleted.");
              })
            }
          >
            Delete all workspace records
          </Button>
        </Card>
      </div>
      {status && (
        <div className="notice" role="status">
          {status}
        </div>
      )}
      {app.conflict && (
        <Card>
          <h2>A record changed on another device</h2>
          <p className="muted">
            Review both versions. Keeping your edit explicitly replaces the
            newer content using its current revision.
          </p>
          <div className="grid-2">
            <div>
              <h3>Your attempted edit</h3>
              <pre>{JSON.stringify(app.conflict.proposed.data, null, 2)}</pre>
            </div>
            <div>
              <h3>Current synchronized record</h3>
              <pre>
                {JSON.stringify(app.conflict.current?.data ?? null, null, 2)}
              </pre>
            </div>
          </div>
          <div className="button-row">
            <Button
              variant="secondary"
              onClick={() => void perform(() => app.resolveConflict("remote"))}
            >
              Keep synchronized version
            </Button>
            <Button
              onClick={() => void perform(() => app.resolveConflict("local"))}
            >
              Use my reviewed edit
            </Button>
          </div>
        </Card>
      )}
    </>
  );
}
