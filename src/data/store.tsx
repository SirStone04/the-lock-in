import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from "firebase/auth";
import type { User } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import type { AppRecord, RecordInput } from "../domain/models";
import { auth, configured, db, trustedDevice } from "./firebase";
import {
  LocalConflictError,
  localRecords,
  localRemove,
  localRestore,
  localSave,
} from "./local";
import { validateInput } from "./validation";
import { decodeBackup, encodeBackup } from "./backup";
import {
  clearAttempt,
  equivalentData,
  keepAttempt,
  readAttempts,
} from "./recovery";
type Conflict = { proposed: RecordInput; current: AppRecord | null };
interface Store {
  records: AppRecord[];
  save: (input: RecordInput) => Promise<string>;
  remove: (id: string) => Promise<void>;
  maintenance: boolean;
  loading: boolean;
  error: string | null;
  clearError: () => void;
  online: boolean;
  pending: boolean;
  configured: boolean;
  user: User | null;
  mode: "cloud" | "local" | "setup";
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  enterLocal: () => void;
  exitLocal: () => void;
  trusted: boolean;
  setTrusted: (trusted: boolean) => void;
  conflict: Conflict | null;
  resolveConflict: (choice: "remote" | "local") => Promise<void>;
  exportBackup: (password?: string) => Promise<string>;
  restoreBackup: (text: string, password?: string) => Promise<number>;
  deleteAll: () => Promise<void>;
}
const Context = createContext<Store | null>(null);
const message = (e: unknown) =>
  e instanceof Error ? e.message : "The operation failed. Please try again.";
export function AppProvider({ children }: { children: ReactNode }) {
  const [records, setRecords] = useState<AppRecord[]>([]),
    [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(configured),
    [error, setError] = useState<string | null>(null),
    [pending, setPending] = useState(false),
    [online, setOnline] = useState(navigator.onLine),
    [local, setLocal] = useState(
      !configured && sessionStorage.getItem("lock-in-local") === "yes",
    ),
    [conflict, setConflict] = useState<Conflict | null>(null),
    [maintenance, setMaintenance] = useState(false);
  const maintenanceRef = useRef(false),
    serverCurrent = useRef(false);
  const recordsRef = useRef(records);
  recordsRef.current = records;
  const inFlight = useRef(new Set<string>());
  const latestAttempts = useRef(new Map<string, RecordInput>());
  const mode = local ? "local" : user ? "cloud" : "setup";
  useEffect(() => {
    const on = () => setOnline(navigator.onLine);
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
    };
  }, []);
  useEffect(
    () =>
      auth
        ? onAuthStateChanged(auth, (u) => {
            serverCurrent.current = false;
            setRecords([]);
            setUser(u);
            setLoading(false);
          })
        : undefined,
    [],
  );
  useEffect(() => {
    if (!local) return;
    setLoading(true);
    let active = true;
    localRecords()
      .then((r) => {
        if (active) setRecords(r);
      })
      .catch((e) => setError(message(e)))
      .finally(() => {
        if (active) setLoading(false);
      });
    const refresh = () =>
      void localRecords()
        .then(setRecords)
        .catch((e) => setError(message(e)));
    window.addEventListener("lock-in-local-change", refresh);
    const channel = new BroadcastChannel("lock-in-local");
    channel.onmessage = refresh;
    return () => {
      active = false;
      window.removeEventListener("lock-in-local-change", refresh);
      channel.close();
    };
  }, [local]);
  useEffect(() => {
    if (!db || !user || local) return;
    setLoading(true);
    return onSnapshot(
      collection(db, "users", user.uid, "records"),
      { includeMetadataChanges: true },
      (snapshot) => {
        serverCurrent.current = !snapshot.metadata.fromCache;
        const next = snapshot.docs.map((d) => d.data() as AppRecord);
        setRecords(next);
        setPending(snapshot.metadata.hasPendingWrites);
        setLoading(false);
        if (
          trustedDevice &&
          !snapshot.metadata.fromCache &&
          !snapshot.metadata.hasPendingWrites
        ) {
          for (const attempted of readAttempts(user.uid)) {
            if (!attempted.id || inFlight.current.has(attempted.id)) continue;
            const current = next.find((r) => r.id === attempted.id) ?? null;
            if (
              current &&
              current.title === attempted.title &&
              current.date === attempted.date &&
              equivalentData(current.data, attempted.data)
            ) {
              clearAttempt(user.uid, attempted.id);
              continue;
            }
            setConflict({ proposed: attempted, current });
            setError(
              "An unacknowledged edit was recovered from this private device. Review it in Settings before discarding or applying it.",
            );
            break;
          }
        }
      },
      (e) => {
        setError(message(e));
        setLoading(false);
      },
    );
  }, [user, local]);
  const notifyLocal = () => {
    window.dispatchEvent(new Event("lock-in-local-change"));
    const c = new BroadcastChannel("lock-in-local");
    c.postMessage("changed");
    c.close();
  };
  const save = useCallback(
    async (input: RecordInput): Promise<string> => {
      if (maintenanceRef.current)
        throw new Error(
          "Data maintenance is in progress. Wait for it to finish before saving.",
        );
      const id = input.id || crypto.randomUUID();
      validateInput({ ...input, id });
      const existing = recordsRef.current.find((r) => r.id === id),
        expected = input.revision ?? existing?.revision ?? 0;
      const record: AppRecord = {
        id,
        kind: input.kind,
        date: input.date,
        title: input.title,
        data: input.data,
        createdAt: existing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        revision: expected + 1,
      };
      if (
        !local &&
        existing &&
        input.revision !== undefined &&
        input.revision !== existing.revision
      ) {
        setConflict({ proposed: input, current: existing });
        throw new Error(
          "This record changed while you were editing. Review the conflict before saving.",
        );
      }
      if (local) {
        try {
          const saved = await localSave({ ...input, id });
          recordsRef.current = [
            ...recordsRef.current.filter((r) => r.id !== id),
            saved,
          ];
          setRecords(recordsRef.current);
          notifyLocal();
          return id;
        } catch (e) {
          if (e instanceof LocalConflictError)
            setConflict({ proposed: input, current: e.current });
          throw e;
        }
      }
      if (!db || !user) throw new Error("Sign in before saving.");
      const ref = doc(db, "users", user.uid, "records", id);
      if (online && ["week", "settings"].includes(input.kind)) {
        try {
          await runTransaction(db, async (tx) => {
            const snap = await tx.get(ref);
            const remote = snap.exists() ? (snap.data() as AppRecord) : null;
            if ((remote?.revision ?? 0) !== expected) {
              setConflict({ proposed: input, current: remote });
              throw new Error(
                "A newer version exists. Choose which version to keep.",
              );
            }
            tx.set(ref, {
              ...record,
              createdAt: remote?.createdAt ?? record.createdAt,
            });
          });
          return id;
        } catch (e) {
          setError(message(e));
          throw e;
        }
      }
      const attempted = { ...input, id, revision: expected };
      if (trustedDevice) {
        try {
          keepAttempt(user.uid, attempted);
        } catch {
          throw new Error(
            "Private-device recovery storage is full. Export a backup and free browser storage before editing.",
          );
        }
      }
      latestAttempts.current.set(id, attempted);
      inFlight.current.add(id);
      setPending(true);
      void setDoc(ref, record)
        .then(() => {
          if (latestAttempts.current.get(id) === attempted) {
            latestAttempts.current.delete(id);
            inFlight.current.delete(id);
          }
          if (trustedDevice) clearAttempt(user.uid, id, attempted);
        })
        .catch(async (e) => {
          inFlight.current.delete(id);
          setError(
            `Save rejected: ${message(e)}. Your attempted edit is available in the conflict panel.`,
          );
          let current: AppRecord | null = null;
          try {
            const snap = await getDoc(ref);
            current = snap.exists() ? (snap.data() as AppRecord) : null;
          } catch {
            /* Reconnection will refresh authoritative records. */
          }
          setConflict({
            proposed: latestAttempts.current.get(id) ?? attempted,
            current,
          });
        });
      return id;
    },
    [local, user, online],
  );
  const remove = async (id: string) => {
    if (maintenanceRef.current)
      throw new Error("Data maintenance is in progress.");
    try {
      if (local) {
        await localRemove(id);
        setRecords((prev) => prev.filter((r) => r.id !== id));
        notifyLocal();
      } else if (db && user) {
        setPending(true);
        void deleteDoc(doc(db, "users", user.uid, "records", id)).catch((e) =>
          setError(message(e)),
        );
      } else throw new Error("Sign in before deleting.");
    } catch (e) {
      setError(message(e));
      throw e;
    }
  };
  const restoreBackup = async (text: string, password?: string) => {
    if (maintenanceRef.current)
      throw new Error("Another data maintenance operation is already running.");
    const backup = await decodeBackup(text, password);
    const existing = new Set(recordsRef.current.map((r) => r.id));
    const additions = backup.records.filter((r) => !existing.has(r.id));
    if (!additions.length) return 0;
    if (!local && !online)
      throw new Error("Reconnect before restoring a cloud backup.");
    if (!local && pending)
      throw new Error(
        "Wait for pending changes to synchronize before restoring.",
      );
    maintenanceRef.current = true;
    setMaintenance(true);
    try {
      if (local) {
        const inserted = await localRestore(additions);
        recordsRef.current = [
          ...recordsRef.current,
          ...inserted.filter(
            (r) => !recordsRef.current.some((existing) => existing.id === r.id),
          ),
        ];
        setRecords(recordsRef.current);
        notifyLocal();
        return inserted.length;
      }
      if (!db || !user) throw new Error("Sign in before restoring.");
      for (let i = 0; i < additions.length; i += 400) {
        const batch = writeBatch(db);
        additions.slice(i, i + 400).forEach((r) =>
          batch.set(doc(db!, "users", user.uid, "records", r.id), {
            ...r,
            revision: 1,
          }),
        );
        await batch.commit();
      }
      return additions.length;
    } finally {
      maintenanceRef.current = false;
      setMaintenance(false);
    }
  };
  const deleteAll = async () => {
    if (maintenanceRef.current)
      throw new Error("Another data maintenance operation is already running.");
    if (!local && (!online || !serverCurrent.current))
      throw new Error(
        "Wait for a current connection to Firestore before deleting cloud data.",
      );
    if (!local && pending)
      throw new Error(
        "Wait for pending changes to synchronize before deleting cloud data.",
      );
    const doomed = [...recordsRef.current];
    maintenanceRef.current = true;
    setMaintenance(true);
    try {
      if (local) {
        for (const r of doomed) await localRemove(r.id);
        recordsRef.current = [];
        setRecords([]);
        notifyLocal();
      } else if (db && user) {
        for (const r of readAttempts(user.uid))
          if (r.id) clearAttempt(user.uid, r.id);
        for (let i = 0; i < doomed.length; i += 400) {
          const batch = writeBatch(db);
          doomed
            .slice(i, i + 400)
            .forEach((r) =>
              batch.delete(doc(db!, "users", user.uid, "records", r.id)),
            );
          await batch.commit();
        }
        recordsRef.current = [];
        setRecords([]);
      } else throw new Error("Sign in before deleting data.");
    } finally {
      maintenanceRef.current = false;
      setMaintenance(false);
    }
  };
  const signIn = async (email: string, password: string) => {
    if (!auth) throw new Error("Configure Firebase first.");
    await signInWithEmailAndPassword(auth, email, password);
  };
  const signUp = async (email: string, password: string) => {
    if (!auth) throw new Error("Configure Firebase first.");
    await createUserWithEmailAndPassword(auth, email, password);
  };
  const signOut = async () => {
    if (maintenanceRef.current)
      throw new Error(
        "Wait for data maintenance to finish before signing out.",
      );
    if (pending)
      throw new Error(
        "Wait for pending writes to synchronize before signing out.",
      );
    if (auth) await firebaseSignOut(auth);
    setRecords([]);
  };
  const resetPassword = async (email: string) => {
    if (!auth) throw new Error("Configure Firebase first.");
    await sendPasswordResetEmail(auth, email);
  };
  return (
    <Context.Provider
      value={{
        records,
        save,
        remove,
        maintenance,
        loading,
        error,
        clearError: () => setError(null),
        online,
        pending,
        configured,
        user,
        mode,
        signIn,
        signUp,
        signOut,
        resetPassword,
        enterLocal: () => {
          sessionStorage.setItem("lock-in-local", "yes");
          setLocal(true);
        },
        exitLocal: () => {
          sessionStorage.removeItem("lock-in-local");
          setLocal(false);
          setRecords([]);
        },
        trusted: trustedDevice,
        setTrusted: (value) => {
          localStorage.setItem("lock-in-trusted-device", value ? "yes" : "no");
          location.reload();
        },
        conflict,
        resolveConflict: async (choice) => {
          if (choice === "local" && conflict) {
            await save({
              ...conflict.proposed,
              revision: conflict.current?.revision ?? 0,
            });
          } else if (choice === "remote" && conflict?.proposed.id && user) {
            clearAttempt(user.uid, conflict.proposed.id);
          }
          setConflict(null);
        },
        exportBackup: (password) => encodeBackup(recordsRef.current, password),
        restoreBackup,
        deleteAll,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useApp() {
  const value = useContext(Context);
  if (!value) throw new Error("useApp must be used inside AppProvider.");
  return value;
}
