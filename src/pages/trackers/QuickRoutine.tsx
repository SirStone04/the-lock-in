import { useState } from "react";
import { Check } from "lucide-react";
import { useApp } from "../../data/store";
import { bool } from "../../domain/models";
import { today } from "../../domain/dates";
import { Button, Card } from "../../components/ui";

export function QuickRoutine({
  kind,
  title,
  items,
  hint,
}: {
  kind: "faith" | "nutrition" | "skincare";
  title: string;
  items: { key: string; label: string }[];
  hint?: string;
}) {
  const { records, save } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const date = today(),
    id = `${kind}-${date}`;
  const record = records.find((r) => r.id === id);
  async function toggle(key: string) {
    setBusy(true);
    setError("");
    try {
      await save({
        id,
        kind,
        date,
        title: `${title} · ${date}`,
        revision: record?.revision,
        data: { ...record?.data, [key]: !bool(record, key) },
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <div className="section-heading">
        <div>
          <h3>{title} · today</h3>
          {hint && <p className="muted">{hint}</p>}
        </div>
        <span className="pill">{date}</span>
      </div>
      <div className="button-row">
        {items.map((item) => (
          <Button
            key={item.key}
            disabled={busy}
            variant={bool(record, item.key) ? "primary" : "secondary"}
            aria-pressed={bool(record, item.key)}
            onClick={() => toggle(item.key)}
          >
            {bool(record, item.key) && <Check size={16} />}
            {item.label}
          </Button>
        ))}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </Card>
  );
}
