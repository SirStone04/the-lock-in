import { useEffect, useRef } from "react";
import { useApp } from "./store";
import { progressAudit, progressSourceSignature } from "../domain/audit";
export function useProgressAudit() {
  const app = useApp(),
    latest = useRef(app),
    running = useRef(false),
    dirty = useRef(false),
    mounted = useRef(true);
  latest.current = app;
  const signature = progressSourceSignature(app.records);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (app.loading || app.maintenance) return;
    dirty.current = true;
    if (running.current) return;
    running.current = true;
    void (async () => {
      try {
        while (
          dirty.current &&
          mounted.current &&
          !latest.current.maintenance
        ) {
          dirty.current = false;
          const changes = progressAudit(latest.current.records);
          for (const input of changes) {
            if (dirty.current || !mounted.current || latest.current.maintenance)
              break;
            const current = latest.current.records.find(
              (r) => r.id === input.id,
            );
            await latest.current.save({
              ...input,
              revision: current?.revision,
            });
          }
        }
      } catch {
        /* The store surfaces rejected writes and retains attempted edits. */
      } finally {
        running.current = false;
      }
    })();
  }, [signature, app.loading, app.mode, app.maintenance]);
}
