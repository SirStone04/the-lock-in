import {
  Component,
  Suspense,
  lazy,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ErrorInfo, ReactNode } from "react";
import {
  LayoutDashboard,
  ListChecks,
  CalendarDays,
  GraduationCap,
  BriefcaseBusiness,
  Wallet,
  Dumbbell,
  BookHeart,
  Utensils,
  Droplets,
  Moon,
  Shield,
  FileText,
  Settings2,
  Plus,
  Menu,
  X,
  WifiOff,
  RefreshCw,
  ChevronRight,
  ArrowUpRight,
  Bell,
  LockKeyhole,
  MoreHorizontal,
  Check,
  Download,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { useApp } from "./data/store";
import { useProgressAudit } from "./data/useProgressAudit";
import { useForegroundReminders } from "./data/useForegroundReminders";
import { AuthGate } from "./data/AuthGate";
import { today, formatDate, dayOfWeek } from "./domain/dates";
import { getRank } from "./domain/rank";
import { Card, Button, Modal } from "./components/ui";
import QuickLog from "./components/QuickLog";
import RankEmblem from "./components/RankEmblem";
import Dashboard from "./pages/Dashboard";
const Today = lazy(() => import("./pages/Today")),
  Planner = lazy(() => import("./pages/Planner")),
  Education = lazy(() => import("./pages/Education")),
  Fitness = lazy(() => import("./pages/Fitness")),
  Ranks = lazy(() => import("./pages/Ranks")),
  Reports = lazy(() => import("./pages/Reports")),
  Settings = lazy(() => import("./pages/Settings")),
  Briefing = lazy(() => import("./pages/Briefing"));
const Employment = lazy(() =>
    import("./pages/Trackers").then((m) => ({ default: m.Employment })),
  ),
  Finances = lazy(() =>
    import("./pages/Trackers").then((m) => ({ default: m.Finances })),
  ),
  Faith = lazy(() =>
    import("./pages/Trackers").then((m) => ({ default: m.Faith })),
  ),
  Nutrition = lazy(() =>
    import("./pages/Trackers").then((m) => ({ default: m.Nutrition })),
  ),
  Skincare = lazy(() =>
    import("./pages/Trackers").then((m) => ({ default: m.Skincare })),
  ),
  Sleep = lazy(() =>
    import("./pages/Trackers").then((m) => ({ default: m.Sleep })),
  );
const navigation: {
  id: string;
  label: string;
  icon: LucideIcon;
  group: string;
}[] = [
  {
    id: "dashboard",
    label: "Command Dashboard",
    icon: LayoutDashboard,
    group: "COMMAND CENTER",
  },
  {
    id: "today",
    label: "Daily Missions",
    icon: ListChecks,
    group: "COMMAND CENTER",
  },
  {
    id: "planner",
    label: "Weekly Planner",
    icon: CalendarDays,
    group: "COMMAND CENTER",
  },
  {
    id: "education",
    label: "Education",
    icon: GraduationCap,
    group: "LIFE OPERATIONS",
  },
  {
    id: "employment",
    label: "Employment",
    icon: BriefcaseBusiness,
    group: "LIFE OPERATIONS",
  },
  { id: "finances", label: "Finances", icon: Wallet, group: "LIFE OPERATIONS" },
  { id: "fitness", label: "Fitness", icon: Dumbbell, group: "LIFE OPERATIONS" },
  { id: "faith", label: "Faith", icon: BookHeart, group: "LIFE OPERATIONS" },
  {
    id: "nutrition",
    label: "Nutrition",
    icon: Utensils,
    group: "LIFE OPERATIONS",
  },
  {
    id: "skincare",
    label: "Skincare & Maintenance",
    icon: Droplets,
    group: "LIFE OPERATIONS",
  },
  {
    id: "sleep",
    label: "Sleep & Recovery",
    icon: Moon,
    group: "LIFE OPERATIONS",
  },
  {
    id: "ranks",
    label: "Ranks & Achievements",
    icon: Shield,
    group: "PROGRESS & INSIGHTS",
  },
  {
    id: "reports",
    label: "Weekly Reports",
    icon: FileText,
    group: "PROGRESS & INSIGHTS",
  },
  {
    id: "settings",
    label: "Settings & Backup",
    icon: Settings2,
    group: "PROGRESS & INSIGHTS",
  },
];

export class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      "Application rendering failed",
      error.message,
      info.componentStack,
    );
  }
  render() {
    return this.state.error ? (
      <main className="auth-page">
        <Card>
          <h1>Unable to open this screen.</h1>
          <p>
            Your saved records remain in storage. Reload the application to
            retry.
          </p>
          <Button onClick={() => location.reload()}>Reload application</Button>
        </Card>
      </main>
    ) : (
      this.props.children
    );
  }
}
function Shell() {
  const app = useApp();
  const [route, setRoute] = useState(location.hash.slice(1) || "dashboard");
  const [navOpen, setNavOpen] = useState(false),
    [quick, setQuick] = useState(false),
    [notification, setNotification] = useState(false);
  const rank = useMemo(() => getRank(app.records), [app.records]);
  useProgressAudit();
  useForegroundReminders();
  const [promotion, setPromotion] = useState<number | null>(null);
  const previousRank = useRef<number | null>(null);
  const sw = useRegisterSW();
  const [updateBusy, setUpdateBusy] = useState(false);
  useEffect(() => {
    const on = () => {
      setRoute(location.hash.slice(1) || "dashboard");
      setNavOpen(false);
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const preferences = app.records.find((r) => r.id === "preferences");
  useEffect(() => {
    document.documentElement.dataset.theme =
      preferences?.data.theme === "light" ? "light" : "dark";
    document.documentElement.classList.toggle(
      "reduce-motion",
      preferences?.data.reducedMotion === true,
    );
  }, [preferences]);
  useEffect(() => {
    if (app.loading) return;
    if (
      previousRank.current !== null &&
      rank.index > previousRank.current &&
      preferences?.data.reducedMotion !== true
    )
      setPromotion(rank.index);
    previousRank.current = rank.index;
  }, [rank.index, app.loading, preferences]);
  const navItem = navigation.find((n) => n.id === route);
  const Page = (
    {
      today: Today,
      planner: Planner,
      education: Education,
      employment: Employment,
      finances: Finances,
      fitness: Fitness,
      faith: Faith,
      nutrition: Nutrition,
      skincare: Skincare,
      sleep: Sleep,
      ranks: Ranks,
      reports: Reports,
      settings: Settings,
      briefing: Briefing,
    } as Record<string, React.ComponentType>
  )[route];
  const day = dayOfWeek(today());
  const showReminder = preferences?.data.reminders !== false;
  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Skip to content
      </a>
      <div
        className={`nav-backdrop ${navOpen ? "visible" : ""}`}
        onClick={() => setNavOpen(false)}
      />
      <aside className={`sidebar ${navOpen ? "open" : ""}`}>
        <a className="brand" href="#dashboard">
          <span className="brand-icon">
            <LockKeyhole size={22} />
          </span>
          <div>
            THE LOCK-IN<span>DISCIPLINE. CONSISTENCY. PROGRESS.</span>
          </div>
        </a>
        <button
          className="mobile-close"
          aria-label="Close navigation"
          onClick={() => setNavOpen(false)}
        >
          <X />
        </button>
        <nav aria-label="Main navigation">
          {navigation.map((n, i) => (
            <div key={n.id}>
              {(i === 0 || navigation[i - 1].group !== n.group) && (
                <div className="nav-group">{n.group}</div>
              )}
              <a
                href={`#${n.id}`}
                className={`nav-item ${route === n.id ? "active" : ""}`}
                aria-current={route === n.id ? "page" : undefined}
              >
                <n.icon size={18} />
                <span>{n.label}</span>
                {route === n.id && <span className="nav-active-dot" />}
              </a>
            </div>
          ))}
        </nav>
        <div className="sidebar-rank">
          <RankEmblem size={48} index={rank.index} />
          <div>
            <strong>
              {rank.name} {rank.division}
            </strong>
            <span>{rank.xp.toLocaleString()} consistency XP</span>
          </div>
          <a href="#ranks" aria-label="View rank">
            <ChevronRight size={17} />
          </a>
        </div>
        <div className="sidebar-foot">
          <span className="status-dot" /> YOUR PROGRESS. YOUR PURPOSE.
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <Button
              variant="ghost"
              className="mobile-menu"
              aria-label="Open navigation"
              onClick={() => setNavOpen(true)}
            >
              <Menu size={20} />
            </Button>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>{navItem?.label ?? "Mission Briefing"}</strong>
          </div>
          <div className="topbar-right">
            <span
              className={`sync-status ${!app.online ? "offline" : ""}`}
              title={
                app.mode === "local"
                  ? "Saved on this device only"
                  : app.pending
                    ? "Changes waiting for Firebase"
                    : "Firebase sync status"
              }
            >
              {!app.online ? (
                <WifiOff size={13} />
              ) : app.pending ? (
                <RefreshCw size={13} className="spin" />
              ) : (
                <span className="status-dot" />
              )}
              {app.mode === "local"
                ? "Local workspace"
                : !app.online
                  ? "Offline"
                  : app.pending
                    ? "Sync pending"
                    : "Synced"}
            </span>
            <span className="topbar-date">
              {formatDate(today(), "MMM d, yyyy")}
            </span>
            <button
              className="notification-btn"
              aria-label="Open reminders"
              onClick={() => setNotification(!notification)}
            >
              <Bell size={18} />
              {showReminder && <i />}
            </button>
            <a
              href="#settings"
              className="avatar"
              aria-label="Account settings"
            >
              {app.user?.email?.slice(0, 1).toUpperCase() ?? "LI"}
            </a>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="main-content">
          {app.error && (
            <div className="error-banner" role="alert">
              <span>{app.error}</span>
              <Button variant="ghost" onClick={app.clearError}>
                Dismiss
              </Button>
            </div>
          )}
          {app.conflict && (
            <div className="notice">
              A record needs conflict review.{" "}
              <a href="#settings">
                Compare versions in Settings <ArrowUpRight size={14} />
              </a>
            </div>
          )}
          {!app.online && (
            <div className="notice">
              <WifiOff size={17} />
              Offline.{" "}
              {app.mode === "cloud" && app.trusted
                ? "Private-device Firestore caching keeps entries pending until reconnection."
                : "Changes are retained only according to your current storage settings."}
            </div>
          )}
          {sw.needRefresh[0] && (
            <div className="notice">
              An application update is ready.{" "}
              {app.pending ? (
                "Wait for synchronization before updating."
              ) : (
                <Button
                  disabled={updateBusy}
                  onClick={() => {
                    setUpdateBusy(true);
                    void sw.updateServiceWorker(true);
                  }}
                >
                  <Download size={15} /> Update app
                </Button>
              )}
            </div>
          )}
          {notification && (
            <Card className="reminder-card">
              <div className="section-title">
                <h2>Today's reminders</h2>
                <Button
                  variant="ghost"
                  onClick={() => setNotification(false)}
                  aria-label="Close reminders"
                >
                  <X size={18} />
                </Button>
              </div>
              {showReminder ? (
                <>
                  <p>
                    Review your daily missions and log an honest check-in before
                    closing your day.
                  </p>
                  {day === 6 && (
                    <p>
                      Saturday review: generate a preliminary weekly report.
                    </p>
                  )}
                  {day === 0 && (
                    <p>
                      Sunday planning: finalize the previous report, then plan
                      the next seven days.
                    </p>
                  )}
                  <a href="#reports" onClick={() => setNotification(false)}>
                    Open weekly reports →
                  </a>
                </>
              ) : (
                <p className="muted">
                  In-app reminders are disabled in Settings.
                </p>
              )}
            </Card>
          )}
          {app.loading ? (
            <Card>
              <div className="loading">
                <RefreshCw className="spin" />
                Loading your records…
              </div>
            </Card>
          ) : (
            <Suspense
              fallback={
                <Card>
                  <div className="loading">
                    <RefreshCw className="spin" />
                    Opening section…
                  </div>
                </Card>
              }
            >
              {Page ? <Page /> : <Dashboard quickLog={() => setQuick(true)} />}
            </Suspense>
          )}
          <footer className="app-footer">
            <span>
              THE LOCK-IN <span className="muted">/</span> Built on consistency.
            </span>
            <span>
              <LockKeyhole size={11} /> Private personal workspace · Eastern
              Time
            </span>
          </footer>
        </main>
      </div>
      <button
        className="quick-fab"
        onClick={() => setQuick(true)}
        aria-label="Quick daily log"
      >
        <Plus size={21} />
      </button>
      <nav className="bottom-nav" aria-label="Mobile navigation">
        <a className={route === "dashboard" ? "active" : ""} href="#dashboard">
          <LayoutDashboard size={21} />
          Home
        </a>
        <a className={route === "today" ? "active" : ""} href="#today">
          <ListChecks size={21} />
          Today
        </a>
        <button onClick={() => setQuick(true)}>
          <span className="quick-bottom">
            <Plus size={22} />
          </span>
          Quick log
        </button>
        <a className={route === "planner" ? "active" : ""} href="#planner">
          <CalendarDays size={21} />
          Planner
        </a>
        <button onClick={() => setNavOpen(true)}>
          <MoreHorizontal size={21} />
          More
        </button>
      </nav>
      {quick && <QuickLog onClose={() => setQuick(false)} />}{" "}
      {promotion !== null && (
        <Modal title="PROMOTION EARNED" onClose={() => setPromotion(null)}>
          <div className="promotion">
            <RankEmblem index={promotion} size={190} />
            <h2>
              {rank.name} {rank.division}
            </h2>
            <p>
              Consistency creates progress. Keep your commitments sustainable.
            </p>
            <Button variant="primary" onClick={() => setPromotion(null)}>
              <Check size={16} /> Continue the journey
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
export default function App() {
  return (
    <ErrorBoundary>
      <AuthGate>
        <Shell />
      </AuthGate>
    </ErrorBoundary>
  );
}
