import { useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
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
  Folder as FolderIcon,
  FileText,
  CornerDownLeft,
} from "lucide-react";
import { Wordmark } from "../lib/logo";
import {
  useDb,
  selectCollections,
  selectFolders,
  selectCurrentUser,
  selectTotalCards,
  selectCardsDueToday,
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
  const totalCards = useDb(selectTotalCards);
  const cardsDueToday = useDb(selectCardsDueToday);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searchIndex, setSearchIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const routeKey = `${location.pathname}?${searchParams.toString()}`;
  const [prevRouteKey, setPrevRouteKey] = useState(routeKey);
  if (prevRouteKey !== routeKey) {
    setPrevRouteKey(routeKey);
    setSidebarOpen(false);
    setSearchOpen(false);
    setSearchQuery("");
  }

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [location.pathname, searchParams]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sidebarOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      } else if (e.key === "Escape" && searchOpen) {
        setSearchOpen(false);
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [searchOpen]);

  type SearchHit =
    | { kind: "collection"; id: string; label: string; subtitle: string; emoji: string }
    | { kind: "card"; id: string; collectionId: string; label: string; subtitle: string; emoji: string }
    | { kind: "folder"; id: string; label: string; subtitle: string; emoji: string };

  const searchResults = useMemo<SearchHit[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const hits: SearchHit[] = [];

    for (const f of folders) {
      if (f.name.toLowerCase().includes(q)) {
        hits.push({
          kind: "folder",
          id: f.name,
          label: f.name,
          subtitle: `Folder · ${f.count} ${f.count === 1 ? "collection" : "collections"}`,
          emoji: f.emoji,
        });
      }
    }

    for (const c of collections) {
      const matchesCollection =
        c.name.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.folder.toLowerCase().includes(q);
      if (matchesCollection) {
        hits.push({
          kind: "collection",
          id: c.id,
          label: c.name,
          subtitle: `Collection · ${c.folder} · ${c.cards.length} cards`,
          emoji: c.emoji,
        });
      }
      for (const card of c.cards) {
        if (
          card.question.toLowerCase().includes(q) ||
          card.answer.toLowerCase().includes(q)
        ) {
          hits.push({
            kind: "card",
            id: card.id,
            collectionId: c.id,
            label: card.question,
            subtitle: `Card in ${c.name}`,
            emoji: c.emoji,
          });
        }
      }
    }

    return hits.slice(0, 12);
  }, [searchQuery, collections, folders]);

  const [prevSearchQuery, setPrevSearchQuery] = useState(searchQuery);
  if (prevSearchQuery !== searchQuery) {
    setPrevSearchQuery(searchQuery);
    setSearchIndex(0);
  }

  function goToHit(hit: SearchHit) {
    setSearchOpen(false);
    setSearchQuery("");
    searchInputRef.current?.blur();
    if (hit.kind === "folder") {
      navigate(`/app/collections?folder=${encodeURIComponent(hit.id)}`);
    } else if (hit.kind === "collection") {
      navigate(`/app/c/${hit.id}`);
    } else {
      navigate(`/app/c/${hit.collectionId}`);
    }
  }

  function onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSearchIndex((i) => Math.min(i + 1, Math.max(searchResults.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSearchIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      const hit = searchResults[searchIndex];
      if (hit) goToHit(hit);
    }
  }

  if (isStudy) {
    return <Outlet />;
  }

  return (
    <div
      className={`shell${sidebarOpen ? " shell--sidebar-open" : ""}${
        searchOpen ? " shell--search-open" : ""
      }`}
    >
      <button
        type="button"
        className="shell__backdrop"
        aria-label="Close navigation"
        onClick={() => setSidebarOpen(false)}
      />
      <button
        type="button"
        className="shell__search-backdrop"
        aria-label="Close search"
        onClick={() => {
          setSearchOpen(false);
          setSearchQuery("");
        }}
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
            {user?.avatarUrl ? (
              <img
                className="shell__userbar-avatar"
                src={user.avatarUrl}
                alt={`${user.firstName ?? "You"}'s avatar`}
              />
            ) : (
              <CircleUser size={22} strokeWidth={1.5} />
            )}
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
          <div className={`shell__search${searchOpen ? " open" : ""}`}>
            <Search size={14} strokeWidth={1.8} />
            <input
              ref={searchInputRef}
              className="shell__search-input"
              placeholder="Search collections, cards, or folders…"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (!searchOpen) setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              onKeyDown={onSearchKeyDown}
            />
            {searchQuery ? (
              <button
                type="button"
                className="shell__search-clear"
                aria-label="Clear search"
                onClick={() => {
                  setSearchQuery("");
                  searchInputRef.current?.focus();
                }}
              >
                <X size={12} strokeWidth={2} />
              </button>
            ) : (
              <span className="shell__search-kbd">⌘ K</span>
            )}

            {searchOpen && (
              <div className="shell__search-panel" role="listbox">
                {searchQuery.trim() === "" ? (
                  <div className="shell__search-empty">
                    <Search size={14} strokeWidth={1.8} />
                    <span>Search across your collections, cards, and folders.</span>
                    <span className="shell__search-hint">
                      <kbd>↑</kbd>
                      <kbd>↓</kbd> to navigate · <kbd>↵</kbd> to open · <kbd>esc</kbd> to close
                    </span>
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="shell__search-empty">
                    <span>No matches for "{searchQuery}".</span>
                  </div>
                ) : (
                  <ul className="shell__search-list">
                    {searchResults.map((hit, i) => {
                      const active = i === searchIndex;
                      const Icon =
                        hit.kind === "folder"
                          ? FolderIcon
                          : hit.kind === "card"
                            ? FileText
                            : Library;
                      return (
                        <li
                          key={`${hit.kind}-${hit.id}-${i}`}
                          role="option"
                          aria-selected={active}
                          className={`shell__search-item${active ? " active" : ""}`}
                          onMouseEnter={() => setSearchIndex(i)}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            goToHit(hit);
                          }}
                        >
                          <span className="shell__search-emoji" aria-hidden>
                            {hit.emoji}
                          </span>
                          <div className="shell__search-text">
                            <span className="shell__search-label">
                              {hit.label}
                            </span>
                            <span className="shell__search-sub">
                              <Icon size={11} strokeWidth={2} />
                              {hit.subtitle}
                            </span>
                          </div>
                          {active && (
                            <CornerDownLeft
                              size={12}
                              strokeWidth={2}
                              className="shell__search-enter"
                            />
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
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
