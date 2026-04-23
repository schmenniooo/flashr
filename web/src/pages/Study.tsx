import { useEffect, useState } from "react";
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
} from "lucide-react";
import { collections } from "../data/mock";
import { Wordmark } from "../lib/logo";
import "./Study.css";

type Rating = "again" | "hard" | "good" | "easy";

export function Study() {
  const { id } = useParams();
  const collection = collections.find((c) => c.id === id);

  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [ratings, setRatings] = useState<Record<string, Rating>>({});
  const [finished, setFinished] = useState(false);

  const card = collection?.cards[index];
  const total = collection?.cards.length ?? 0;

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

  if (!collection) return <Navigate to="/collections" replace />;

  function next() {
    if (!collection) return;
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
    if (!card) return;
    setRatings((old) => ({ ...old, [card.id]: r }));
    setTimeout(() => next(), 180);
  }

  if (finished) {
    const known = Object.values(ratings).filter((r) => r === "good" || r === "easy").length;
    return (
      <div className="study">
        <StudyTopBar collection={collection} total={total} index={total} />
        <div className="study__done fade-in">
          <div className="study__done-icon">
            <CheckCircle2 size={56} strokeWidth={1.5} />
          </div>
          <span className="text-meta">Session abgeschlossen</span>
          <h1 className="text-display" style={{ maxWidth: 560 }}>
            Stark, Ennio. Du hast {total} Karten durchgearbeitet.
          </h1>
          <div className="study__done-stats">
            <div><strong>{known}</strong><span>sicher gekonnt</span></div>
            <div><strong>{total - known}</strong><span>kommen wieder</span></div>
            <div><strong>+1</strong><span>Streak-Tag</span></div>
          </div>
          <div className="study__done-cta">
            <Link to={`/c/${collection.id}`} className="btn-ghost">
              Zurück zur Collection
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
              Nochmal durchgehen
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!card) return null;

  return (
    <div className="study">
      <StudyTopBar collection={collection} total={total} index={index + 1} />

      <div className="study__content">
        <div className="study__rail study__rail--left">
          <button className="study__nav-arrow" onClick={prev} disabled={index === 0} title="Zurück">
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
                <span className="text-meta">Frage</span>
                {card.aiGenerated && (
                  <span className="badge">
                    <Sparkles size={10} strokeWidth={2} style={{ marginRight: 4 }} />
                    KI-generiert
                  </span>
                )}
              </div>
              <p className="study__card-text">{card.question}</p>
              <div className="study__card-foot">
                <Keyboard size={12} strokeWidth={1.8} />
                <span>Leertaste zum Aufdecken</span>
              </div>
            </div>
            <div className="study__card-face study__card-face--back">
              <div className="study__card-top">
                <span className="text-meta">Antwort</span>
              </div>
              <p className="study__card-text">{card.answer}</p>
              <div className="study__card-foot">
                <Keyboard size={12} strokeWidth={1.8} />
                <span>1 — Wieder · 2 — Schwer · 3 — Gut · 4 — Einfach</span>
              </div>
            </div>
          </div>

          <div className={`study__ratings ${revealed ? "study__ratings--visible" : ""}`}>
            <button className="study__rate study__rate--again" onClick={() => rate("again")}>
              <span className="study__rate-kbd">1</span>
              <span className="study__rate-label">Wieder</span>
              <span className="study__rate-meta">&lt; 1m</span>
            </button>
            <button className="study__rate study__rate--hard" onClick={() => rate("hard")}>
              <span className="study__rate-kbd">2</span>
              <span className="study__rate-label">Schwer</span>
              <span className="study__rate-meta">6m</span>
            </button>
            <button className="study__rate study__rate--good" onClick={() => rate("good")}>
              <span className="study__rate-kbd">3</span>
              <span className="study__rate-label">Gut</span>
              <span className="study__rate-meta">1d</span>
            </button>
            <button className="study__rate study__rate--easy" onClick={() => rate("easy")}>
              <span className="study__rate-kbd">4</span>
              <span className="study__rate-label">Einfach</span>
              <span className="study__rate-meta">4d</span>
            </button>
          </div>
        </div>

        <div className="study__rail study__rail--right">
          <button className="study__nav-arrow" onClick={next} title="Weiter">
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
}: {
  collection: (typeof collections)[number];
  total: number;
  index: number;
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
          <Flame size={14} strokeWidth={2} /> 12
        </span>
        <Link to={`/c/${collection.id}`} className="study__close" title="Beenden">
          <X size={18} strokeWidth={1.8} />
        </Link>
      </div>
    </header>
  );
}
