import { Link } from "react-router-dom";
import {
  Sparkles,
  Flame,
  BookOpen,
  TrendingUp,
  Upload,
  ArrowRight,
  Clock,
  Zap,
} from "lucide-react";
import { collections, stats, recentActivity } from "../data/mock";
import { CollectionCard } from "../components/CollectionCard";
import "./Dashboard.css";

export function Dashboard() {
  const dueCollection = collections.find((c) => c.id === "biochem-7")!;
  const recentCollections = collections.slice(0, 6);

  return (
    <div className="dash">
      <header className="dash__head">
        <div>
          <span className="text-meta">Dashboard · Wednesday, April 23</span>
          <h1 className="text-h1 dash__greeting">
            Hey Ennio 👋 <span className="dash__greeting-sub">Ready for a few cards?</span>
          </h1>
        </div>
        <div className="dash__head-cta">
          <Link to="/upload" className="btn-primary">
            <Sparkles size={14} strokeWidth={2} />
            Create cards from PDF
          </Link>
        </div>
      </header>

      {/* ── Hero: Today's session + Streak ── */}
      <section className="dash__hero">
        <article className="dash__session">
          <div className="dash__session-left">
            <span className="badge">
              <Zap size={11} strokeWidth={2} style={{ marginRight: 5 }} />
              Today's session
            </span>
            <h2 className="text-h1 dash__session-title">
              {stats.cardsDueToday} cards are waiting for you.
            </h2>
            <p className="text-body dash__session-sub">
              Start with <strong style={{ color: "var(--color-text)" }}>{dueCollection.name}</strong> — you
              last studied it {dueCollection.lastStudied}. Only ~7&nbsp;minutes at 30&nbsp;sec per card.
            </p>
            <div className="dash__session-ctas">
              <Link to={`/c/${dueCollection.id}/study`} className="btn-primary">
                Start studying
                <ArrowRight size={14} strokeWidth={2} />
              </Link>
              <Link to={`/c/${dueCollection.id}`} className="btn-ghost">
                Open collection
              </Link>
            </div>
          </div>

          <div className="dash__session-visual" aria-hidden>
            <div className="dash__session-card dash__session-card--back">
              <span className="text-meta">Question</span>
            </div>
            <div className="dash__session-card dash__session-card--mid">
              <span className="text-meta">Question</span>
              <p>How does a competitive inhibitor affect Kₘ?</p>
            </div>
            <div className="dash__session-card dash__session-card--front">
              <span className="text-meta">Question · 1 / {dueCollection.cards.length}</span>
              <p>What does the Michaelis constant (Kₘ) describe?</p>
              <span className="dash__session-hint">Press space to reveal</span>
            </div>
          </div>
        </article>

        <div className="dash__stats">
          <article className="dash__stat-card">
            <Flame size={18} strokeWidth={2} color="#ff9b4a" />
            <div>
              <div className="dash__stat-val">{stats.streak}</div>
              <div className="dash__stat-lbl">Day streak</div>
            </div>
            <div className="dash__stat-trend">
              <TrendingUp size={12} strokeWidth={2} /> personal best
            </div>
          </article>

          <article className="dash__stat-card">
            <BookOpen size={18} strokeWidth={2} color="var(--color-accent-light)" />
            <div>
              <div className="dash__stat-val">{stats.cardsLearnedThisWeek}</div>
              <div className="dash__stat-lbl">Cards this week</div>
            </div>
            <div className="dash__stat-trend dash__stat-trend--up">
              <TrendingUp size={12} strokeWidth={2} /> +34%
            </div>
          </article>

          <article className="dash__stat-card">
            <Sparkles size={18} strokeWidth={2} color="var(--color-accent)" />
            <div>
              <div className="dash__stat-val">{stats.totalCards}</div>
              <div className="dash__stat-lbl">Total cards</div>
            </div>
            <div className="dash__stat-trend">
              <Clock size={12} strokeWidth={2} /> across {stats.totalCollections} collections
            </div>
          </article>
        </div>
      </section>

      {/* ── Continue / Recent collections ── */}
      <section className="dash__section">
        <div className="dash__section-head">
          <div>
            <h2 className="text-h2">Pick up where you left off</h2>
            <p className="text-body">Your most recently touched collections.</p>
          </div>
          <Link to="/collections" className="dash__section-link">
            View all
            <ArrowRight size={14} strokeWidth={2} />
          </Link>
        </div>

        <div className="dash__grid">
          {recentCollections.map((c) => (
            <CollectionCard key={c.id} collection={c} />
          ))}
        </div>
      </section>

      {/* ── Bottom row: Upload CTA + Activity ── */}
      <section className="dash__bottom">
        <Link to="/upload" className="dash__upload-cta">
          <div className="dash__upload-cta-bg" aria-hidden />
          <div className="dash__upload-cta-inner">
            <div className="dash__upload-cta-icon">
              <Upload size={20} strokeWidth={1.8} />
            </div>
            <div>
              <h3 className="text-h2">Got a lecture as a PDF?</h3>
              <p className="text-body">
                Drop it in — flashr reads it and builds the cards for you. You review, we do the rest.
              </p>
            </div>
            <div className="dash__upload-cta-arrow">
              <ArrowRight size={18} strokeWidth={2} />
            </div>
          </div>
        </Link>

        <article className="dash__activity card">
          <div className="dash__activity-head">
            <h3 className="text-h2">Activity</h3>
            <span className="text-meta">Last 2 weeks</span>
          </div>
          <ul className="dash__activity-list">
            {recentActivity.map((a, i) => (
              <li key={i} className="dash__activity-item">
                <span className="dash__activity-dot" />
                <div>
                  <div className="dash__activity-label">{a.label}</div>
                  <div className="dash__activity-meta">
                    {a.collection} · <span className="text-meta" style={{ textTransform: "none" }}>{a.time}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </article>
      </section>
    </div>
  );
}
