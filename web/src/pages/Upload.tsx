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
    question: "What is the Michaelis-Menten equation?",
    answer:
      "It describes the rate of enzyme-catalyzed reactions: v = (Vₘₐₓ · [S]) / (Kₘ + [S]).",
    keep: true,
  },
  {
    id: "d2",
    question: "How does competitive inhibition differ from non-competitive?",
    answer:
      "Competitive: inhibitor binds the active site, Kₘ increases, Vₘₐₓ unchanged. Non-competitive: inhibitor binds allosterically, Vₘₐₓ decreases, Kₘ unchanged.",
    keep: true,
  },
  {
    id: "d3",
    question: "What is the turnover number (kcat)?",
    answer: "The number of substrate molecules converted per enzyme per unit time (s⁻¹).",
    keep: true,
  },
  {
    id: "d4",
    question: "Why is the Lineweaver-Burk plot used?",
    answer:
      "To linearize the non-linear Michaelis-Menten curve. Vₘₐₓ and Kₘ can be read directly from the intercepts.",
    keep: true,
  },
  {
    id: "d5",
    question: "What happens at substrate saturation?",
    answer: "The enzyme is saturated, the reaction reaches Vₘₐₓ — adding more substrate no longer changes v.",
    keep: false,
  },
  {
    id: "d6",
    question: "Give an example of an irreversible inhibitor.",
    answer:
      "Acetylsalicylic acid (aspirin) irreversibly acetylates cyclooxygenase (COX). Another example is penicillin on transpeptidase.",
    keep: true,
  },
];

export function Upload() {
  const [step, setStep] = useState<Step>("drop");
  const [fileName, setFileName] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<DraftCard[]>(DRAFTS);
  const [target, setTarget] = useState<string>(collections[0].id);

  function startFake() {
    setFileName("Biochemistry_Lecture_07_EnzymeKinetics.pdf");
    setStep("processing");
    setTimeout(() => setStep("review"), 2600);
  }

  function toggleKeep(id: string) {
    setDrafts((d) => d.map((c) => (c.id === id ? { ...c, keep: !c.keep } : c)));
  }

  const keepCount = drafts.filter((d) => d.keep).length;

  return (
    <div className="up">
      <Link to="/app" className="up__back">
        <ArrowLeft size={14} strokeWidth={2} />
        Back to dashboard
      </Link>

      <header className="up__head">
        <span className="text-meta">Create with AI · ~30 sec</span>
        <h1 className="text-h1" style={{ marginTop: 8 }}>
          Your notes, turned into cards.
        </h1>
        <p className="text-body" style={{ marginTop: 4, maxWidth: 560 }}>
          Upload a PDF, GoodNotes, or Notability file. flashr reads it and suggests question-and-answer
          pairs — you decide what stays.
        </p>
      </header>

      <ol className="up__steps">
        <li className={`up__step ${step !== "drop" ? "up__step--done" : "up__step--active"}`}>
          <span className="up__step-n">1</span> Upload
        </li>
        <li className={`up__step ${step === "processing" ? "up__step--active" : ""} ${step === "review" ? "up__step--done" : ""}`}>
          <span className="up__step-n">2</span> AI processing
        </li>
        <li className={`up__step ${step === "review" ? "up__step--active" : ""}`}>
          <span className="up__step-n">3</span> Review & save
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
          <h2 className="text-h2">Drop a file here or click to upload</h2>
          <p className="text-body">PDF · DOCX · GoodNotes · Notability — up to 20 MB</p>
        </div>
        <div className="up__drop-badges">
          <span className="badge"><ShieldCheck size={10} strokeWidth={2} style={{ marginRight: 4 }} /> Private · deleted after processing</span>
          <span className="badge"><Wand2 size={10} strokeWidth={2} style={{ marginRight: 4 }} /> Self-hosted Ollama</span>
        </div>
      </button>

      <div className="up__hint">
        <p className="text-meta">Or try the sample</p>
        <button className="up__sample" onClick={onPick}>
          <FileText size={16} strokeWidth={1.8} />
          <div>
            <div className="up__sample-title">Biochemistry_Lecture_07.pdf</div>
            <div className="up__sample-meta">Demo · 12 pages · Enzyme kinetics</div>
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
          <div className="up__proc-meta">12 pages · 218 KB</div>
        </div>
        <span className="badge">
          <Loader2 size={10} className="up__spin" strokeWidth={2} style={{ marginRight: 4 }} />
          Processing
        </span>
      </div>

      <ul className="up__proc-list">
        <li className="up__proc-item up__proc-item--done">
          <CheckCircle2 size={14} strokeWidth={2} /> PDF uploaded
          <span className="text-meta">0.3s</span>
        </li>
        <li className="up__proc-item up__proc-item--done">
          <CheckCircle2 size={14} strokeWidth={2} /> Text extracted — 2,845 words
          <span className="text-meta">0.9s</span>
        </li>
        <li className="up__proc-item up__proc-item--active">
          <Loader2 size={14} className="up__spin" strokeWidth={2} /> Ollama generating cards…
          <span className="text-meta">~ 8s</span>
        </li>
        <li className="up__proc-item">
          <span className="up__proc-dot" /> Quality check
          <span className="text-meta">—</span>
        </li>
        <li className="up__proc-item">
          <span className="up__proc-dot" /> Duplicate detection
          <span className="text-meta">—</span>
        </li>
      </ul>

      <p className="up__proc-tip text-body">
        💡 Hang tight — large lectures can take up to a minute. You can leave this tab open, we'll ping you
        when it's ready.
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
            {drafts.length} cards generated
          </h2>
          <p className="text-body">
            Quick review — keep, skip, or edit each one. Only the cards you select get saved.
          </p>
        </div>

        <div className="up__review-target">
          <label className="text-meta">Save to</label>
          <select className="up__select" value={target} onChange={(e) => onTarget(e.target.value)}>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji} · {c.name}
              </option>
            ))}
            <option value="__new">+ Create new collection</option>
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
                AI
              </span>
            </div>
            <div className="up__draft-body">
              <div>
                <span className="text-meta">Question</span>
                <p>{d.question}</p>
              </div>
              <div>
                <span className="text-meta">Answer</span>
                <p className="up__draft-answer">{d.answer}</p>
              </div>
            </div>
            <div className="up__draft-side">
              <button className="up__draft-icon" title="Edit">
                <Pencil size={13} strokeWidth={1.8} />
              </button>
              <button
                className="up__draft-icon up__draft-icon--danger"
                title="Skip"
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
          <strong>{keepCount}</strong> of {drafts.length} cards will be saved
        </div>
        <div className="up__save-actions">
          <button className="btn-ghost" onClick={onBack}>
            Discard
          </button>
          <button className="btn-primary" disabled={keepCount === 0}>
            <CheckCircle2 size={14} strokeWidth={2} />
            Save to collection
          </button>
        </div>
      </div>
    </div>
  );
}
