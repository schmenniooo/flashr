import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutGrid,
  Library,
  Sparkles,
  Flame,
  Search,
  Settings,
  CircleUser,
  Plus,
} from "lucide-react";
import { Wordmark } from "../lib/logo";
import { folders, stats } from "../data/mock";
import "./AppShell.css";

export function AppShell() {
  const location = useLocation();
  const isStudy = location.pathname.includes("/study");

  if (isStudy) {
    return <Outlet />;
  }

  return (
    <div className="shell">
      <aside className="shell__sidebar">
        <div className="shell__brand">
          <Wordmark size={22} />
          <span className="shell__brand-dot" />
        </div>

        <nav className="shell__nav">
          <span className="shell__nav-label">Navigation</span>
          <NavLink to="/" end className="shell__nav-link">
            <LayoutGrid size={16} strokeWidth={1.8} />
            Dashboard
          </NavLink>
          <NavLink to="/collections" className="shell__nav-link">
            <Library size={16} strokeWidth={1.8} />
            Collections
            <span className="shell__nav-count">{stats.totalCollections}</span>
          </NavLink>
          <NavLink to="/upload" className="shell__nav-link shell__nav-link--accent">
            <Sparkles size={16} strokeWidth={1.8} />
            Mit KI erstellen
          </NavLink>
        </nav>

        <nav className="shell__nav">
          <span className="shell__nav-label">Ordner</span>
          {folders.map((f) => (
            <a key={f.name} className="shell__nav-link shell__nav-link--folder" href="#">
              <span className="shell__folder-emoji">{f.emoji}</span>
              {f.name}
              <span className="shell__nav-count">{f.count}</span>
            </a>
          ))}
          <button className="shell__nav-new">
            <Plus size={14} strokeWidth={2} />
            Neuer Ordner
          </button>
        </nav>

        <div className="shell__sidebar-foot">
          <div className="shell__streak">
            <Flame size={16} strokeWidth={2} className="shell__streak-icon" />
            <div>
              <div className="shell__streak-val">{stats.streak} Tage</div>
              <div className="shell__streak-lbl">Lern-Streak</div>
            </div>
          </div>
          <div className="shell__userbar">
            <CircleUser size={22} strokeWidth={1.5} />
            <div className="shell__userbar-text">
              <span className="shell__userbar-name">Ennio</span>
              <span className="shell__userbar-plan">Pro · SmithLabs</span>
            </div>
            <Settings size={14} strokeWidth={1.8} className="shell__userbar-settings" />
          </div>
        </div>
      </aside>

      <div className="shell__content">
        <header className="shell__topbar">
          <div className="shell__search">
            <Search size={14} strokeWidth={1.8} />
            <input
              className="shell__search-input"
              placeholder="Collections, Karten oder Ordner durchsuchen …"
            />
            <span className="shell__search-kbd">⌘ K</span>
          </div>
          <div className="shell__topbar-right">
            <span className="shell__topbar-stat">
              <span className="shell__topbar-stat-dot" />
              {stats.cardsDueToday} Karten fällig heute
            </span>
          </div>
        </header>

        <main className="shell__main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
