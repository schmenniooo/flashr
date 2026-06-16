import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import {
  X,
  Flame,
  Keyboard,
  CheckCircle2,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  CalendarClock,
} from "lucide-react";
import posthog from "posthog-js";
import { cardsApi, collectionsApi, selectCardsToday, selectCollection, selectCurrentUser, useDb } from "../lib/store";
import type { Card, Collection } from "../lib/store";
import { Wordmark } from "../lib/logo";
import "./Study.css";

type Rating = "again" | "hard" | "good" | "easy";

function isDue(card: Card): boolean {
  return !card.dueDate || new Date(card.dueDate) <= new Date();
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function Study() {
  const { id } = useParams();
  const collection = useDb(selectCollection(id ?? ""));
  const currentUser = useDb(selectCurrentUser);
  const cardsToday = useDb(selectCardsToday);

  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [ratings, setRatings] = useState<Record<string, Rating>>({});
  const [finished, setFinished] = useState(false);
  const [studyAll, setStudyAll] = useState(false);

  // Compute the shuffled deck once on mount (or when studyAll is toggled).
  const deck = useMemo<Card[]>(() => {
    if (!collection) return [];
    const pool = studyAll ? collection.cards : collection.cards.filter(isDue);
    return shuffle(pool);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collection?.id, studyAll]);

  const card = deck[index];
  const total = deck.length;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (finished) return;
      if (e.code === "Space") {
        e.preventDefault();
        setRevealed((v) => !v);
      }
      if (e.code === "ArrowRight") next();
      if (e.code === "ArrowLeft") prev();
      if (revealed && card) {
        if (e.key === "1") rate("again");
        if (e.key === "2") rate("hard");
        if (e.key === "3") rate("good");
        if (e.key === "4") rate("easy");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed, index, card, finished]);

  if (!collection) return <Navigate to="/app/collections" replace />;
  if (collection.cards.length === 0)
    return <Navigate to={`/app/c/${collection.id}`} replace />;

  // "All caught up" state — no cards due and not yet overridden.
  if (deck.length === 0 && !studyAll) {
    const nextDue = collection.cards
      .filter((k) => k.dueDate)
      .map((k) => new Date(k.dueDate!))
      .sort((a, b) => a.getTime() - b.getTime())[0];

    return (
      <div className="study">
        <StudyTopBar collection={collection} total={collection.cards.length} index={0} streak={currentUser?.streak ?? 0} />
        <div className="study__done fade-in">
          <div className="study__done-icon">
            <CalendarClock size={56} strokeWidth={1.5} />
          </div>
          <span className="text-meta">All caught up</span>
          <h1 className="text-display" style={{ maxWidth: 560 }}>
            No cards are due right now.{" "}
            {nextDue && `Next review: ${nextDue.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}.`}
          </h1>
          <div className="study__done-cta">
            <Link to={`/app/c/${collection.id}`} className="btn-ghost">
              Back to collection
            </Link>
            <button className="btn-primary" onClick={() => setStudyAll(true)}>
              Study all cards
            </button>
          </div>
        </div>
      </div>
    );
  }

  function next() {
    if (index < total - 1) {
      setIndex((i) => i + 1);
      setRevealed(false);
    } else {
      setFinished(true);
    }
  }

  function prev() {
    if (index > 0) {
      setIndex((i) => i - 1);
      setRevealed(false);
    }
  }

  function rate(r: Rating) {
    if (!card || !collection) return;
    posthog.capture("card_rated", { rating: r, collection_id: collection.id, card_id: card.id, ai_generated: card.aiGenerated });
    setRatings((old) => ({ ...old, [card.id]: r }));
    cardsApi.review(collection.id, card.id, r);
    collectionsApi.touch(collection.id);
    setTimeout(() => next(), 180);
  }

  if (finished) {
    const known = Object.values(ratings).filter((r) => r === "good" || r === "easy").length;
    posthog.capture("study_session_completed", { collection_id: collection.id, collection_name: collection.name, total_cards: total, cards_known: known, cards_missed: total - known });
    return (
      <div className="study">
        <StudyTopBar collection={collection} total={total} index={total} streak={currentUser?.streak ?? 0} />
        <div className="study__done fade-in">
          <div className="study__done-icon">
            <CheckCircle2 size={56} strokeWidth={1.5} />
          </div>
          <span className="text-meta">Session complete</span>
          <h1 className="text-display" style={{ maxWidth: 560 }}>
            Nice work, {currentUser?.firstName}. You made it through {total} cards.
          </h1>
          <div className="study__done-stats">
            <div><strong>{known}</strong><span>got it</span></div>
            <div><strong>{total - known}</strong><span>coming back</span></div>
            <div>
              <strong>{cardsToday} / {currentUser?.dailyGoal ?? 20}</strong>
              <span>cards today</span>
            </div>
            <div>
              <strong>{currentUser?.streak ?? 0}</strong>
              <span>{cardsToday >= (currentUser?.dailyGoal ?? 20) ? "day streak 🔥" : "day streak"}</span>
            </div>
          </div>
          <div className="study__done-cta">
            <Link to={`/app/c/${collection.id}`} className="btn-ghost">
              Back to collection
            </Link>
            <button
              className="btn-primary"
              onClick={() => {
                setIndex(0);
                setRevealed(false);
                setFinished(false);
                setRatings({});
              }}
            >
              <RotateCcw size={14} strokeWidth={2} />
              Run it again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!card) return null;

  return (
    <div className="study">
      <StudyTopBar collection={collection} total={total} index={index + 1} streak={currentUser?.streak ?? 0} />

      <div className="study__content">
        <div className="study__rail study__rail--left">
          <button className="study__nav-arrow" onClick={prev} disabled={index === 0} title="Previous">
            <ArrowLeft size={18} strokeWidth={1.8} />
          </button>
        </div>

        <div className="study__card-wrap">
          <div
            className={`study__card ${revealed ? "study__card--revealed" : ""}`}
            onClick={() => setRevealed((v) => !v)}
          >
            <div className="study__card-face study__card-face--front">
              <div className="study__card-top">
                <span className="text-meta">Question</span>
                {card.aiGenerated && (
                  <span className="badge">
                    <Sparkles size={10} strokeWidth={2} style={{ marginRight: 4 }} />
                    AI-generated
                  </span>
                )}
              </div>
              <p className="study__card-text">{card.question}</p>
              <div className="study__card-foot">
                <Keyboard size={12} strokeWidth={1.8} />
                <span>Press space to reveal</span>
              </div>
            </div>
            <div className="study__card-face study__card-face--back">
              <div className="study__card-top">
                <span className="text-meta">Answer</span>
              </div>
              <p className="study__card-text">{card.answer}</p>
              <div className="study__card-foot">
                <Keyboard size={12} strokeWidth={1.8} />
                <span>1 — Again · 2 — Hard · 3 — Good · 4 — Easy</span>
              </div>
            </div>
          </div>

          <div className={`study__ratings ${revealed ? "study__ratings--visible" : ""}`}>
            <button className="study__rate study__rate--again" onClick={() => rate("again")}>
              <span className="study__rate-kbd">1</span>
              <span className="study__rate-label">Again</span>
              <span className="study__rate-meta">&lt; 1m</span>
            </button>
            <button className="study__rate study__rate--hard" onClick={() => rate("hard")}>
              <span className="study__rate-kbd">2</span>
              <span className="study__rate-label">Hard</span>
              <span className="study__rate-meta">6m</span>
            </button>
            <button className="study__rate study__rate--good" onClick={() => rate("good")}>
              <span className="study__rate-kbd">3</span>
              <span className="study__rate-label">Good</span>
              <span className="study__rate-meta">1d</span>
            </button>
            <button className="study__rate study__rate--easy" onClick={() => rate("easy")}>
              <span className="study__rate-kbd">4</span>
              <span className="study__rate-label">Easy</span>
              <span className="study__rate-meta">4d</span>
            </button>
          </div>
        </div>

        <div className="study__rail study__rail--right">
          <button className="study__nav-arrow" onClick={next} title="Next">
            <ArrowRight size={18} strokeWidth={1.8} />
          </button>
        </div>
      </div>
    </div>
  );
}

function StudyTopBar({
  collection,
  total,
  index,
  streak,
}: {
  collection: Collection;
  total: number;
  index: number;
  streak: number;
}) {
  const pct = Math.round((index / total) * 100);
  return (
    <header className="study__top">
      <div className="study__top-left">
        <Wordmark size={18} />
        <span className="study__top-divider" />
        <span className="study__top-title">
          <span className="study__top-emoji">{collection.emoji}</span>
          {collection.name}
        </span>
      </div>
      <div className="study__top-center">
        <span className="study__counter">
          {String(index).padStart(2, "0")}
          <span className="study__counter-total"> / {String(total).padStart(2, "0")}</span>
        </span>
        <div className="study__progress-bar">
          <div className="study__progress-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="study__top-right">
        <span className="study__streak">
          <Flame size={14} strokeWidth={2} /> {streak}
        </span>
        <Link to={`/app/c/${collection.id}`} className="study__close" title="Exit">
          <X size={18} strokeWidth={1.8} />
        </Link>
      </div>
    </header>
  );
}
