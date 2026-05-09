import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Sparkles,
  Flame,
  BookOpen,
  TrendingUp,
  Upload,
  ArrowRight,
  Clock,
  Zap,
  Plus,
  X,
  Lightbulb,
} from "lucide-react";
import {
  selectCollections,
  selectCurrentUser,
  selectSuggestionsForUser,
  selectTotalCards,
  selectCardsDueToday,
  selectKnownCards,
  suggestionsApi,
  useDb,
} from "../lib/store";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins} minutes ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs === 1 ? "1 hour ago" : `${hrs} hours ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "a week ago";
  return `${Math.floor(days / 7)} weeks ago`;
}
import { CollectionCard } from "../components/CollectionCard";
import "./Dashboard.css";

export function Dashboard() {
  const collections = useDb(selectCollections);
  const currentUser = useDb(selectCurrentUser);
  const suggestions = useDb(selectSuggestionsForUser);
  const cardsDue = useDb(selectCardsDueToday);
  const totalCards = useDb(selectTotalCards);
  const cardsLearned = useDb(selectKnownCards);
  const navigate = useNavigate();

  async function handleAcceptSuggestion(id: string) {
    const created = await suggestionsApi.accept(id);
    if (created) navigate(`/app/c/${created.id}`);
  }

  const recentActivity = useMemo(() => {
    return [...collections]
      .filter((c) => c.createdAt)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 4)
      .map((c) => ({
        label: "Collection created",
        collection: c.name,
        time: timeAgo(c.createdAt),
      }));
  }, [collections]);

  const dueCollection =
    collections.find((c) => c.cards.some((k) => k.mastery !== "known")) ??
    collections[0];
  const recentCollections = collections.slice(0, 6);

  return (
    <div className="dash">
      <header className="dash__head">
        <div>
          <span className="text-meta">Dashboard · {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</span>
          <h1 className="text-h1 dash__greeting">
            Hey {currentUser?.firstName ?? "there"} 👋{" "}
            <span className="dash__greeting-sub">Ready for a few cards?</span>
          </h1>
        </div>
        <div className="dash__head-cta">
          <Link to="/app/upload" className="btn-primary">
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
              <Zap size={11} strokeWidth={2} className="badge__icon" />
              Today's session
            </span>
            <h2 className="text-h1 dash__session-title">
              {cardsDue > 0
                ? `${cardsDue} cards are waiting for you.`
                : "You're all caught up."}
            </h2>
            <p className="text-body dash__session-sub">
              {dueCollection
                ? <>Start with <strong className="dash__strong">{dueCollection.name}</strong> — you last studied it {dueCollection.lastStudied}.</>
                : <>Create your first collection to get started.</>}
            </p>
            <div className="dash__session-ctas">
              {dueCollection && dueCollection.cards.length > 0 && (
                <Link to={`/app/c/${dueCollection.id}/study`} className="btn-primary">
                  Start studying
                  <ArrowRight size={14} strokeWidth={2} />
                </Link>
              )}
              {dueCollection ? (
                <Link to={`/app/c/${dueCollection.id}`} className="btn-ghost">
                  Open collection
                </Link>
              ) : (
                <Link to="/app/collections" className="btn-primary">
                  Create a collection
                  <ArrowRight size={14} strokeWidth={2} />
                </Link>
              )}
            </div>
          </div>

          <div className="dash__session-visual" aria-hidden>
            <div className="dash__session-card dash__session-card--back">
              <span className="text-meta">Question</span>
            </div>
            <div className="dash__session-card dash__session-card--mid">
              <span className="text-meta">Question</span>
              <p>{dueCollection?.cards[1]?.question ?? "Flip through your deck…"}</p>
            </div>
            <div className="dash__session-card dash__session-card--front">
              <span className="text-meta">
                Question · 1 / {dueCollection?.cards.length ?? 0}
              </span>
              <p>{dueCollection?.cards[0]?.question ?? "No cards yet — add some!"}</p>
              <span className="dash__session-hint">Press space to reveal</span>
            </div>
          </div>
        </article>

        <div className="dash__stats">
          <article className="dash__stat-card">
            <Flame size={18} strokeWidth={2} color="#ff9b4a" />
            <div>
              <div className="dash__stat-val">{cardsLearned}</div>
              <div className="dash__stat-lbl">Mastered</div>
            </div>
            <div className="dash__stat-trend">
              <TrendingUp size={12} strokeWidth={2} /> keep going
            </div>
          </article>

          <article className="dash__stat-card">
            <BookOpen size={18} strokeWidth={2} color="var(--color-accent-light)" />
            <div>
              <div className="dash__stat-val">{cardsDue}</div>
              <div className="dash__stat-lbl">Cards to review</div>
            </div>
            <div className="dash__stat-trend dash__stat-trend--up">
              <TrendingUp size={12} strokeWidth={2} /> ready now
            </div>
          </article>

          <article className="dash__stat-card">
            <Sparkles size={18} strokeWidth={2} color="var(--color-accent)" />
            <div>
              <div className="dash__stat-val">{totalCards}</div>
              <div className="dash__stat-lbl">Total cards</div>
            </div>
            <div className="dash__stat-trend">
              <Clock size={12} strokeWidth={2} /> across {collections.length} collections
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
          <Link to="/app/collections" className="dash__section-link">
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

      {/* ── Suggestions tailored to learner type ── */}
      {suggestions.length > 0 && (
        <section className="dash__section">
          <div className="dash__section-head">
            <div>
              <h2 className="text-h2">
                <Lightbulb size={16} strokeWidth={2} className="dash__section-icon" />
                Suggested for you
              </h2>
              <p className="text-body">
                Starter decks picked for{" "}
                {currentUser?.learnerTypes
                  .map((t) => t.replace("-", " "))
                  .join(" · ") || "your goals"}
                .
              </p>
            </div>
          </div>

          <div className="dash__suggest-grid">
            {suggestions.map((s) => (
              <article key={s.id} className="dash__suggest-card">
                <button
                  type="button"
                  className="dash__suggest-dismiss"
                  aria-label={`Dismiss ${s.title}`}
                  onClick={() => suggestionsApi.dismiss(s.id)}
                >
                  <X size={12} strokeWidth={2} />
                </button>
                <span className="dash__suggest-emoji" aria-hidden>
                  {s.emoji}
                </span>
                <div className="dash__suggest-body">
                  <h3 className="dash__suggest-title">{s.title}</h3>
                  <p className="dash__suggest-desc">{s.description}</p>
                  <span className="text-meta dash__suggest-folder">
                    {s.folder}
                  </span>
                </div>
                <button
                  type="button"
                  className="dash__suggest-cta"
                  onClick={() => handleAcceptSuggestion(s.id)}
                >
                  <Plus size={13} strokeWidth={2} />
                  Add to my collections
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* ── Bottom row: Upload CTA + Activity ── */}
      <section className="dash__bottom">
        <Link to="/app/upload" className="dash__upload-cta">
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
                    {a.collection} · <span className="text-meta dash__activity-time">{a.time}</span>
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
