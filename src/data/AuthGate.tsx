import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";
import { useApp } from "./store";
import { Button, Card, Field } from "../components/ui";
export function AuthGate({ children }: { children: ReactNode }) {
  const app = useApp();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [create, setCreate] = useState(false),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [trust, setTrust] = useState(false);
  if (app.mode === "local" || app.user) return children;
  if (app.loading)
    return (
      <div className="auth-page">
        <Card>
          <p>Opening your private workspace…</p>
        </Card>
      </div>
    );
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      if (create) await app.signUp(email, password);
      else await app.signIn(email, password);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="auth-page">
      <div className="auth-brand">
        <div className="brand-mark">
          <LockKeyhole size={28} />
        </div>
        <span>THE LOCK-IN</span>
        <p>Discipline. Consistency. Progress.</p>
      </div>
      <Card className="auth-card">
        <div className="eyebrow">YOUR PRIVATE COMMAND CENTER</div>
        <h1>
          {app.configured ? "Welcome back." : "Your next chapter starts here."}
        </h1>
        <p className="muted">
          A clear plan. Honest accountability. Sustainable progress toward the
          life you are building.
        </p>
        {app.configured ? (
          <form onSubmit={submit}>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={app.trusted}
                onChange={(e) => {
                  if (
                    e.target.checked &&
                    !confirm(
                      "Is this your private device? Enabling offline persistence keeps sensitive records and your session in browser storage. Never enable it on a shared device.",
                    )
                  )
                    return;
                  app.setTrusted(e.target.checked);
                }}
              />
              Private device: keep me signed in and enable offline records
            </label>
            <p className="muted small">
              Changing this option reloads the page before sign-in. Shared
              devices use session sign-in and memory-only records. Previously
              saved site data must be cleared through browser settings.
            </p>
            <Field label="Email">
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field label="Password">
              <input
                type="password"
                autoComplete={create ? "new-password" : "current-password"}
                minLength={8}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <Button type="submit" disabled={busy}>
              {busy
                ? "Please wait…"
                : create
                  ? "Create private account"
                  : "Sign in"}{" "}
              <ArrowRight size={16} />
            </Button>
            <div className="button-row">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setCreate(!create)}
              >
                {create ? "Use existing account" : "Create account"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={async () => {
                  try {
                    await app.resetPassword(email);
                    setNotice(
                      "If this email has an account, a reset message will arrive.",
                    );
                  } catch (e) {
                    setNotice(
                      e instanceof Error
                        ? e.message
                        : "Enter your email first.",
                    );
                  }
                }}
              >
                Reset password
              </Button>
            </div>
          </form>
        ) : (
          <>
            <div className="notice">
              <ShieldCheck size={20} />
              <div>
                <strong>Firebase setup required for private cloud sync</strong>
                <p>
                  The app is ready to connect. Add your Firebase web
                  configuration and deploy the owner-only security rules
                  following the included setup guide. No cloud account or
                  synchronization has been fabricated.
                </p>
              </div>
            </div>
            <p className="muted">
              You can also use a local workspace on this browser. Its records
              stay on this device, are not synchronized, and can be exported for
              backup.
            </p>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={trust}
                onChange={(e) => setTrust(e.target.checked)}
              />
              This is my private device. I understand local records remain on
              this browser.
            </label>
            <Button disabled={!trust} onClick={() => app.enterLocal()}>
              Open local workspace <ArrowRight size={16} />
            </Button>
          </>
        )}
        {notice && (
          <p role="alert" className="notice">
            {notice}
          </p>
        )}
        <p className="auth-footnote">Faith first. Progress with purpose.</p>
      </Card>
    </main>
  );
}
