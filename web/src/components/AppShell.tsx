import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useSearchParams } from "react-router-dom";
import {
  LayoutGrid,
  Library,
  Sparkles,
  Flame,
  Search,
  Settings,
  CircleUser,
  Plus,
  Menu,
  X,
} from "lucide-react";
import { Wordmark } from "../lib/logo";
import {
  useDb,
  selectCollections,
  selectFolders,
  selectCurrentUser,
} from "../lib/store";
import { NewFolderModal } from "./NewFolderModal";
import "./AppShell.css";

export function AppShell() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const activeFolder = searchParams.get("folder");
  const isStudy = location.pathname.includes("/study");
  const isCollections =
    location.pathname === "/app/collections" ||
    location.pathname.startsWith("/app/collections/");

  const collections = useDb(selectCollections);
  const folders = useDb(selectFolders);
  const user = useDb(selectCurrentUser);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const totalCards = collections.reduce((s, c) => s + c.cards.length, 0);
  const cardsDueToday = collections.reduce(
    (s, c) => s + c.cards.filter((k) => k.mastery !== "known").length,
    0,
  );

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    setSidebarOpen(false);
  }, [location.pathname, searchParams]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sidebarOpen]);

  if (isStudy) {
    return <Outlet />;
  }

  return (
    <div className={`shell${sidebarOpen ? " shell--sidebar-open" : ""}`}>
      <button
        type="button"
        className="shell__backdrop"
        aria-label="Close navigation"
        onClick={() => setSidebarOpen(false)}
      />
      <aside className="shell__sidebar">
        <div className="shell__brand">
          <Wordmark size={22} />
          <span className="shell__brand-dot" />
        </div>

        <nav className="shell__nav">
          <span className="shell__nav-label">Navigation</span>
          <NavLink to="/app" end className="shell__nav-link">
            <LayoutGrid size={16} strokeWidth={1.8} />
            Dashboard
          </NavLink>
          <Link
            to="/app/collections"
            className={`shell__nav-link${
              isCollections && !activeFolder ? " active" : ""
            }`}
          >
            <Library size={16} strokeWidth={1.8} />
            Collections
            <span className="shell__nav-count">{collections.length}</span>
          </Link>
          <NavLink to="/app/upload" className="shell__nav-link shell__nav-link--accent">
            <Sparkles size={16} strokeWidth={1.8} />
            Create with AI
          </NavLink>
        </nav>

        <nav className="shell__nav">
          <span className="shell__nav-label">Folders</span>
          {folders.map((f) => {
            const isActive = isCollections && activeFolder === f.name;
            return (
              <Link
                key={f.name}
                to={`/app/collections?folder=${encodeURIComponent(f.name)}`}
                className={`shell__nav-link shell__nav-link--folder${
                  isActive ? " active" : ""
                }`}
              >
                <span className="shell__folder-emoji">{f.emoji}</span>
                {f.name}
                <span className="shell__nav-count">{f.count}</span>
              </Link>
            );
          })}
          <button
            className="shell__nav-new"
            onClick={() => setNewFolderOpen(true)}
          >
            <Plus size={14} strokeWidth={2} />
            New folder
          </button>
        </nav>

        <div className="shell__sidebar-foot">
          <div className="shell__streak">
            <Flame size={16} strokeWidth={2} className="shell__streak-icon" />
            <div>
              <div className="shell__streak-val">{totalCards} cards</div>
              <div className="shell__streak-lbl">Across all collections</div>
            </div>
          </div>
          <Link to="/app/profile" className="shell__userbar">
            <CircleUser size={22} strokeWidth={1.5} />
            <div className="shell__userbar-text">
              <span className="shell__userbar-name">{user?.firstName ?? "You"}</span>
              <span className="shell__userbar-plan">
                {user?.plan === "pro" ? "Pro" : user?.plan === "teams" ? "Teams" : "Free"} · flashr
              </span>
            </div>
            <Settings size={14} strokeWidth={1.8} className="shell__userbar-settings" />
          </Link>
        </div>
      </aside>

      <div className="shell__content">
        <header className="shell__topbar">
          <button
            type="button"
            className="shell__nav-toggle"
            aria-label={sidebarOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={sidebarOpen}
            onClick={() => setSidebarOpen((v) => !v)}
          >
            {sidebarOpen ? (
              <X size={18} strokeWidth={1.8} />
            ) : (
              <Menu size={18} strokeWidth={1.8} />
            )}
          </button>
          <div className="shell__search">
            <Search size={14} strokeWidth={1.8} />
            <input
              className="shell__search-input"
              placeholder="Search collections, cards, or folders…"
            />
            <span className="shell__search-kbd">⌘ K</span>
          </div>
          <div className="shell__topbar-right">
            <span className="shell__topbar-stat">
              <span className="shell__topbar-stat-dot" />
              {cardsDueToday} cards due today
            </span>
          </div>
        </header>

        <main className="shell__main">
          <Outlet />
        </main>
      </div>

      <NewFolderModal
        open={newFolderOpen}
        onClose={() => setNewFolderOpen(false)}
      />
    </div>
  );
}
