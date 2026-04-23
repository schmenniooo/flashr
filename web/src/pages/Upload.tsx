import { useState } from "react";
import { Link } from "react-router-dom";
import {
  UploadCloud,
  FileText,
  Sparkles,
  CheckCircle2,
  Pencil,
  Trash2,
  ArrowRight,
  Loader2,
  ShieldCheck,
  Wand2,
  Layers,
  ArrowLeft,
} from "lucide-react";
import { collections } from "../data/mock";
import "./Upload.css";

type Step = "drop" | "processing" | "review";

type DraftCard = {
  id: string;
  question: string;
  answer: string;
  keep: boolean;
};

const DRAFTS: DraftCard[] = [
  {
    id: "d1",
    question: "Was versteht man unter der Michaelis-Menten-Gleichung?",
    answer:
      "Sie beschreibt die Reaktionsgeschwindigkeit enzymkatalysierter Reaktionen: v = (Vₘₐₓ · [S]) / (Kₘ + [S]).",
    keep: true,
  },
  {
    id: "d2",
    question: "Wie unterscheidet sich kompetitive von nicht-kompetitiver Inhibition?",
    answer:
      "Kompetitiv: Inhibitor bindet am aktiven Zentrum, Kₘ steigt, Vₘₐₓ bleibt. Nicht-kompetitiv: Inhibitor bindet allosterisch, Vₘₐₓ sinkt, Kₘ bleibt.",
    keep: true,
  },
  {
    id: "d3",
    question: "Was ist eine Wechselzahl (kcat)?",
    answer: "Die Anzahl umgesetzter Substratmoleküle pro Enzym pro Zeiteinheit (s⁻¹).",
    keep: true,
  },
  {
    id: "d4",
    question: "Warum wird die Lineweaver-Burk-Darstellung verwendet?",
    answer:
      "Um die nichtlineare Michaelis-Menten-Kurve zu linearisieren. Aus dem Achsenabschnitt lassen sich Vₘₐₓ und Kₘ direkt ablesen.",
    keep: true,
  },
  {
    id: "d5",
    question: "Was passiert bei Substratüberschuss?",
    answer: "Das Enzym ist gesättigt, die Reaktion erreicht Vₘₐₓ — weitere Substratzugabe ändert v nicht mehr.",
    keep: false,
  },
  {
    id: "d6",
    question: "Nenne ein Beispiel für einen irreversiblen Inhibitor.",
    answer:
      "Acetylsalicylsäure (Aspirin) acetyliert irreversibel die Cyclooxygenase (COX). Ein weiteres Beispiel ist Penicillin auf die Transpeptidase.",
    keep: true,
  },
];

export function Upload() {
  const [step, setStep] = useState<Step>("drop");
  const [fileName, setFileName] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<DraftCard[]>(DRAFTS);
  const [target, setTarget] = useState<string>(collections[0].id);

  function startFake() {
    setFileName("Biochemie_Vorlesung_07_Enzymkinetik.pdf");
    setStep("processing");
    setTimeout(() => setStep("review"), 2600);
  }

  function toggleKeep(id: string) {
    setDrafts((d) => d.map((c) => (c.id === id ? { ...c, keep: !c.keep } : c)));
  }

  const keepCount = drafts.filter((d) => d.keep).length;

  return (
    <div className="up">
      <Link to="/" className="up__back">
        <ArrowLeft size={14} strokeWidth={2} />
        Zurück zum Dashboard
      </Link>

      <header className="up__head">
        <span className="text-meta">Mit KI erstellen · ~30 Sek</span>
        <h1 className="text-h1" style={{ marginTop: 8 }}>
          Aus deiner Notiz werden Karten.
        </h1>
        <p className="text-body" style={{ marginTop: 4, maxWidth: 560 }}>
          Lade ein PDF, eine GoodNotes- oder Notability-Datei hoch. flashr liest den Inhalt und schlägt dir
          Frage-Antwort-Paare vor — du entscheidest, was bleibt.
        </p>
      </header>

      <ol className="up__steps">
        <li className={`up__step ${step !== "drop" ? "up__step--done" : "up__step--active"}`}>
          <span className="up__step-n">1</span> Upload
        </li>
        <li className={`up__step ${step === "processing" ? "up__step--active" : ""} ${step === "review" ? "up__step--done" : ""}`}>
          <span className="up__step-n">2</span> KI-Verarbeitung
        </li>
        <li className={`up__step ${step === "review" ? "up__step--active" : ""}`}>
          <span className="up__step-n">3</span> Review & Speichern
        </li>
      </ol>

      {step === "drop" && <DropStep onPick={startFake} />}
      {step === "processing" && <ProcessingStep fileName={fileName!} />}
      {step === "review" && (
        <ReviewStep
          drafts={drafts}
          onToggle={toggleKeep}
          target={target}
          onTarget={setTarget}
          keepCount={keepCount}
          onBack={() => setStep("drop")}
        />
      )}
    </div>
  );
}

function DropStep({ onPick }: { onPick: () => void }) {
  return (
    <>
      <button className="up__drop fade-in" onClick={onPick}>
        <div className="up__drop-glow" aria-hidden />
        <div className="up__drop-icon">
          <UploadCloud size={28} strokeWidth={1.5} />
        </div>
        <div className="up__drop-text">
          <h2 className="text-h2">Datei hierher ziehen oder klicken</h2>
          <p className="text-body">PDF · DOCX · GoodNotes · Notability — bis zu 20 MB</p>
        </div>
        <div className="up__drop-badges">
          <span className="badge"><ShieldCheck size={10} strokeWidth={2} style={{ marginRight: 4 }} /> Privat · wird nach Verarbeitung gelöscht</span>
          <span className="badge"><Wand2 size={10} strokeWidth={2} style={{ marginRight: 4 }} /> Self-hosted Ollama</span>
        </div>
      </button>

      <div className="up__hint">
        <p className="text-meta">Oder Beispiel-Datei</p>
        <button className="up__sample" onClick={onPick}>
          <FileText size={16} strokeWidth={1.8} />
          <div>
            <div className="up__sample-title">Biochemie_Vorlesung_07.pdf</div>
            <div className="up__sample-meta">Demo · 12 Seiten · Enzymkinetik</div>
          </div>
          <ArrowRight size={14} strokeWidth={2} />
        </button>
      </div>
    </>
  );
}

function ProcessingStep({ fileName }: { fileName: string }) {
  return (
    <div className="up__proc fade-in">
      <div className="up__proc-file">
        <FileText size={18} strokeWidth={1.8} />
        <div>
          <div className="up__proc-filename">{fileName}</div>
          <div className="up__proc-meta">12 Seiten · 218 KB</div>
        </div>
        <span className="badge">
          <Loader2 size={10} className="up__spin" strokeWidth={2} style={{ marginRight: 4 }} />
          Wird verarbeitet
        </span>
      </div>

      <ul className="up__proc-list">
        <li className="up__proc-item up__proc-item--done">
          <CheckCircle2 size={14} strokeWidth={2} /> PDF hochgeladen
          <span className="text-meta">0,3s</span>
        </li>
        <li className="up__proc-item up__proc-item--done">
          <CheckCircle2 size={14} strokeWidth={2} /> Text extrahiert — 2 845 Wörter
          <span className="text-meta">0,9s</span>
        </li>
        <li className="up__proc-item up__proc-item--active">
          <Loader2 size={14} className="up__spin" strokeWidth={2} /> Ollama generiert Karten …
          <span className="text-meta">~ 8s</span>
        </li>
        <li className="up__proc-item">
          <span className="up__proc-dot" /> Qualitätscheck
          <span className="text-meta">—</span>
        </li>
        <li className="up__proc-item">
          <span className="up__proc-dot" /> Duplikat-Erkennung
          <span className="text-meta">—</span>
        </li>
      </ul>

      <p className="up__proc-tip text-body">
        💡 Gib uns einen Moment — bei großen Vorlesungen kann das bis zu einer Minute dauern. Du kannst die
        Seite offen lassen, wir benachrichtigen dich.
      </p>
    </div>
  );
}

function ReviewStep({
  drafts,
  onToggle,
  target,
  onTarget,
  keepCount,
  onBack,
}: {
  drafts: DraftCard[];
  onToggle: (id: string) => void;
  target: string;
  onTarget: (id: string) => void;
  keepCount: number;
  onBack: () => void;
}) {
  return (
    <div className="up__review fade-in">
      <div className="up__review-bar">
        <div>
          <h2 className="text-h2">
            <Sparkles size={16} strokeWidth={2} color="var(--color-accent)" style={{ verticalAlign: -2, marginRight: 6 }} />
            {drafts.length} Karten generiert
          </h2>
          <p className="text-body">
            Check kurz durch — du kannst jede Karte behalten, verwerfen oder bearbeiten. Nur ausgewählte
            werden gespeichert.
          </p>
        </div>

        <div className="up__review-target">
          <label className="text-meta">Speichern in</label>
          <select className="up__select" value={target} onChange={(e) => onTarget(e.target.value)}>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji} · {c.name}
              </option>
            ))}
            <option value="__new">+ Neue Collection erstellen</option>
          </select>
        </div>
      </div>

      <div className="up__drafts">
        {drafts.map((d, i) => (
          <article key={d.id} className={`up__draft ${d.keep ? "up__draft--keep" : "up__draft--skip"}`}>
            <div className="up__draft-idx">
              <span className="text-meta">#{String(i + 1).padStart(2, "0")}</span>
              <span className="up__ai-pill">
                <Sparkles size={10} strokeWidth={2} />
                KI
              </span>
            </div>
            <div className="up__draft-body">
              <div>
                <span className="text-meta">Frage</span>
                <p>{d.question}</p>
              </div>
              <div>
                <span className="text-meta">Antwort</span>
                <p className="up__draft-answer">{d.answer}</p>
              </div>
            </div>
            <div className="up__draft-side">
              <button className="up__draft-icon" title="Bearbeiten">
                <Pencil size={13} strokeWidth={1.8} />
              </button>
              <button
                className="up__draft-icon up__draft-icon--danger"
                title="Verwerfen"
                onClick={() => onToggle(d.id)}
              >
                <Trash2 size={13} strokeWidth={1.8} />
              </button>
              <label className="up__switch">
                <input
                  type="checkbox"
                  checked={d.keep}
                  onChange={() => onToggle(d.id)}
                />
                <span />
              </label>
            </div>
          </article>
        ))}
      </div>

      <div className="up__save-bar">
        <div className="up__save-summary">
          <Layers size={14} strokeWidth={2} />
          <strong>{keepCount}</strong> von {drafts.length} Karten werden gespeichert
        </div>
        <div className="up__save-actions">
          <button className="btn-ghost" onClick={onBack}>
            Verwerfen
          </button>
          <button className="btn-primary" disabled={keepCount === 0}>
            <CheckCircle2 size={14} strokeWidth={2} />
            In Collection speichern
          </button>
        </div>
      </div>
    </div>
  );
}
