import { useState } from "react";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { useApp } from "../data/store";
import type {
  AppRecord,
  Data,
  Kind,
  RecordInput,
  JsonValue,
} from "../domain/models";
import { today } from "../domain/dates";
import { Card, Button, Modal, Field, Empty } from "./ui";

export interface FieldSpec {
  key: string;
  label: string;
  type?:
    | "text"
    | "number"
    | "date"
    | "time"
    | "datetime-local"
    | "textarea"
    | "select"
    | "checkbox";
  options?: string[];
  required?: boolean;
  min?: number;
  max?: number;
  step?: number | string;
  default?: JsonValue;
  help?: string;
}
export interface EntryManagerProps {
  kind: Kind;
  title: string;
  fields: FieldSpec[];
  defaults?: Data;
  description?: string;
  filter?: (r: AppRecord) => boolean;
  validate?: (data: Data, date: string, id?: string) => string | undefined;
  onSaved?: (id: string, input: RecordInput) => Promise<void>;
}
export function EntryManager({
  kind,
  title,
  fields,
  defaults = {},
  description,
  filter,
  validate,
  onSaved,
}: EntryManagerProps) {
  const { records, save, remove } = useApp();
  const [editing, setEditing] = useState<AppRecord | null | undefined>();
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const list = records
    .filter((r) => r.kind === kind && (!filter || filter(r)))
    .filter((r) =>
      `${r.title} ${r.date} ${JSON.stringify(r.data)}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    )
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt),
    );
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const fd = new FormData(event.currentTarget);
    const data: Data = { ...defaults, ...editing?.data };
    for (const field of fields) {
      const value = fd.get(field.key);
      data[field.key] =
        field.type === "checkbox"
          ? fd.has(field.key)
          : field.type === "number"
            ? value === ""
              ? null
              : Number(value)
            : String(value ?? "");
    }
    const date = String(fd.get("_date"));
    const problem = validate?.(data, date, editing?.id);
    if (problem) {
      setError(problem);
      setBusy(false);
      return;
    }
    try {
      const input: RecordInput = {
        id: editing?.id,
        revision: editing?.revision,
        kind,
        date,
        title: String(fd.get("_title")).trim(),
        data,
      };
      const id = await save(input);
      await onSaved?.(id, input);
      setEditing(undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="entry-manager">
      <div className="section-title">
        <div>
          <h2>{title}</h2>
          {description && <p className="muted small">{description}</p>}
        </div>
        <Button
          onClick={() => {
            setError("");
            setEditing(null);
          }}
        >
          <Plus size={16} /> Add record
        </Button>
      </div>
      {list.length > 3 && (
        <label className="search">
          <Search size={16} />
          <input
            aria-label={`Search ${title}`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search records…"
          />
        </label>
      )}
      {list.length === 0 ? (
        <Empty
          title="Nothing logged yet"
          description="Your actual records will appear here."
        />
      ) : (
        <div className="record-list">
          {list.map((r) => (
            <div key={r.id} className="record-row">
              <div className="record-main">
                <span className="muted small">{r.date}</span>
                <strong>{r.title}</strong>
                <div className="record-details">
                  {fields.map(
                    (f) =>
                      r.data[f.key] !== undefined &&
                      r.data[f.key] !== null &&
                      r.data[f.key] !== "" && (
                        <span key={f.key}>
                          {f.label}:{" "}
                          {typeof r.data[f.key] === "boolean"
                            ? r.data[f.key]
                              ? "Yes"
                              : "No"
                            : String(r.data[f.key])}
                        </span>
                      ),
                  )}
                </div>
              </div>
              <div className="row-actions">
                <Button
                  variant="ghost"
                  aria-label={`Edit ${r.title}`}
                  onClick={() => {
                    setError("");
                    setEditing(r);
                  }}
                >
                  <Pencil size={16} />
                </Button>
                <Button
                  variant="ghost"
                  aria-label={`Delete ${r.title}`}
                  onClick={async () => {
                    if (confirm(`Delete “${r.title}”?`))
                      try {
                        await remove(r.id);
                      } catch (e) {
                        setError(String(e));
                      }
                  }}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      {error && editing === undefined && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {editing !== undefined && (
        <Modal
          title={`${editing ? "Edit" : "Add"} ${title.toLowerCase()}`}
          onClose={() => setEditing(undefined)}
        >
          <form onSubmit={submit} className="form-grid">
            <Field label="Date">
              <input
                name="_date"
                type="date"
                required
                defaultValue={editing?.date ?? today()}
              />
            </Field>
            <Field label="Title">
              <input
                name="_title"
                required
                maxLength={200}
                defaultValue={editing?.title ?? title}
              />
            </Field>
            {fields.map((f) => (
              <Field key={f.key} label={f.label}>
                {f.type === "select" ? (
                  <select
                    name={f.key}
                    defaultValue={String(
                      editing?.data[f.key] ??
                        defaults[f.key] ??
                        f.default ??
                        f.options?.[0] ??
                        "",
                    )}
                  >
                    {f.options?.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                ) : f.type === "textarea" ? (
                  <textarea
                    name={f.key}
                    defaultValue={String(
                      editing?.data[f.key] ??
                        defaults[f.key] ??
                        f.default ??
                        "",
                    )}
                    rows={3}
                  />
                ) : f.type === "checkbox" ? (
                  <input
                    name={f.key}
                    type="checkbox"
                    defaultChecked={Boolean(
                      editing?.data[f.key] ??
                      defaults[f.key] ??
                      f.default ??
                      false,
                    )}
                  />
                ) : (
                  <input
                    name={f.key}
                    type={f.type ?? "text"}
                    required={f.required}
                    min={f.min}
                    max={f.max}
                    step={f.step ?? (f.type === "number" ? "any" : undefined)}
                    defaultValue={String(
                      editing?.data[f.key] ??
                        defaults[f.key] ??
                        f.default ??
                        "",
                    )}
                  />
                )}{" "}
                {f.help && <span className="muted small">{f.help}</span>}
              </Field>
            ))}
            {error && (
              <p className="error full" role="alert">
                {error}
              </p>
            )}
            <div className="form-actions full">
              <Button type="button" onClick={() => setEditing(undefined)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={busy}>
                {busy ? "Saving…" : "Save record"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </Card>
  );
}
export default EntryManager;
