import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Sparkles, Grid3x3, List, ArrowUpDown, Filter } from "lucide-react";
import { collections, folders } from "../data/mock";
import { CollectionCard } from "../components/CollectionCard";
import "./Collections.css";

export function Collections() {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [filter, setFilter] = useState<string>("Alle");

  const filtered =
    filter === "Alle" ? collections : collections.filter((c) => c.folder === filter);

  return (
    <div className="cols">
      <header className="cols__head">
        <div>
          <span className="text-meta">{collections.length} Collections · {folders.length} Ordner</span>
          <h1 className="text-h1" style={{ marginTop: 8 }}>Alle Collections</h1>
          <p className="text-body" style={{ marginTop: 4 }}>
            Hier lebt dein gesamtes Wissen. Klicke eine Collection an, um sie zu öffnen oder zu lernen.
          </p>
        </div>
        <div className="cols__head-cta">
          <button className="btn-ghost">
            <Plus size={14} strokeWidth={2} />
            Neue Collection
          </button>
          <Link to="/upload" className="btn-primary">
            <Sparkles size={14} strokeWidth={2} />
            Mit KI erstellen
          </Link>
        </div>
      </header>

      <div className="cols__toolbar">
        <div className="cols__filters">
          <button
            className={`cols__chip ${filter === "Alle" ? "cols__chip--active" : ""}`}
            onClick={() => setFilter("Alle")}
          >
            Alle <span className="cols__chip-count">{collections.length}</span>
          </button>
          {folders.map((f) => (
            <button
              key={f.name}
              className={`cols__chip ${filter === f.name ? "cols__chip--active" : ""}`}
              onClick={() => setFilter(f.name)}
            >
              <span>{f.emoji}</span>
              {f.name}
              <span className="cols__chip-count">{f.count}</span>
            </button>
          ))}
        </div>
        <div className="cols__view">
          <button className="cols__icon-btn" title="Filter">
            <Filter size={14} strokeWidth={1.8} />
          </button>
          <button className="cols__icon-btn" title="Sortieren">
            <ArrowUpDown size={14} strokeWidth={1.8} />
          </button>
          <div className="cols__view-toggle">
            <button
              className={`cols__icon-btn ${view === "grid" ? "cols__icon-btn--active" : ""}`}
              onClick={() => setView("grid")}
              title="Grid"
            >
              <Grid3x3 size={14} strokeWidth={1.8} />
            </button>
            <button
              className={`cols__icon-btn ${view === "list" ? "cols__icon-btn--active" : ""}`}
              onClick={() => setView("list")}
              title="Liste"
            >
              <List size={14} strokeWidth={1.8} />
            </button>
          </div>
        </div>
      </div>

      {view === "grid" ? (
        <div className="cols__grid">
          {filtered.map((c) => (
            <CollectionCard key={c.id} collection={c} />
          ))}
        </div>
      ) : (
        <div className="cols__list">
          {filtered.map((c) => (
            <Link key={c.id} to={`/c/${c.id}`} className="cols__row">
              <span className="cols__row-emoji">{c.emoji}</span>
              <div className="cols__row-main">
                <div className="cols__row-title">{c.name}</div>
                <div className="cols__row-meta">
                  {c.folder} · {c.cards.length} Karten · {c.lastStudied}
                </div>
              </div>
              <div className="cols__row-progress">
                <div className="cols__row-progress-bar">
                  <div
                    className="cols__row-progress-fill"
                    style={{ width: `${c.progress}%` }}
                  />
                </div>
                <span>{c.progress}%</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
