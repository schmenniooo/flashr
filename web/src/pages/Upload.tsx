import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
  AlertCircle,
} from "lucide-react";
import {
  cardsApi,
  collectionsApi,
  selectCollections,
  useDb,
} from "../lib/store";
import { api } from "../lib/api";
import "./Upload.css";

type Step = "drop" | "processing" | "review";

type DraftCard = {
  id: string;
  question: string;
  answer: string;
  keep: boolean;
};

export function Upload() {
  const navigate = useNavigate();
  const collections = useDb(selectCollections);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("drop");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number>(0);
  const [drafts, setDrafts] = useState<DraftCard[]>([]);
  const [target, setTarget] = useState<string>(collections[0]?.id ?? "__new");
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Only PDF files are supported right now.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError("File too large — max 20 MB.");
      return;
    }

    setError(null);
    setFileName(file.name);
    setFileSize(file.size);
    setStep("processing");

    const form = new FormData();
    form.append("file", file);

    try {
      const result = await api<{ cards: { question: string; answer: string }[] }>(
        "/ai/upload",
        { method: "POST", body: form }
      );
      const generated = result.cards.map((c, i) => ({
        id: `d${i}`,
        question: c.question,
        answer: c.answer,
        keep: true,
      }));
      setDrafts(generated);
      setStep("review");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setError(msg);
      setStep("drop");
    }
  }

  function toggleKeep(id: string) {
    setDrafts((d) => d.map((c) => (c.id === id ? { ...c, keep: !c.keep } : c)));
  }

  function updateDraft(id: string, field: "question" | "answer", value: string) {
    setDrafts((d) => d.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
  }

  async function handleSave() {
    const kept = drafts.filter((d) => d.keep);
    if (kept.length === 0) return;

    let collectionId = target;
    if (collectionId === "__new" || !collections.find((c) => c.id === collectionId)) {
      const name = fileName
        ? fileName.replace(/\.pdf$/i, "").replace(/[_-]/g, " ")
        : "AI Generated Cards";
      const created = await collectionsApi.create({
        name,
        folder: "Uncategorized",
        emoji: "✨",
        description: "Generated from your uploaded notes.",
      });
      collectionId = created.id;
    }
    await Promise.all(
      kept.map((d) =>
        cardsApi.add(collectionId, { question: d.question, answer: d.answer })
      )
    );
    navigate(`/app/c/${collectionId}`);
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
          Upload a PDF and flashr reads it and suggests question-and-answer
          pairs — you decide what stays.
        </p>
      </header>

      <ol className="up__steps">
        <li className={`up__step ${step !== "drop" ? "up__step--done" : "up__step--active"}`}>
          <span className="up__step-n">1</span> Upload
        </li>
        <li
          className={`up__step ${step === "processing" ? "up__step--active" : ""} ${
            step === "review" ? "up__step--done" : ""
          }`}
        >
          <span className="up__step-n">2</span> AI processing
        </li>
        <li className={`up__step ${step === "review" ? "up__step--active" : ""}`}>
          <span className="up__step-n">3</span> Review & save
        </li>
      </ol>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />

      {error && (
        <div className="up__error">
          <AlertCircle size={14} strokeWidth={2} />
          {error}
        </div>
      )}

      {step === "drop" && (
        <DropStep
          onPick={() => fileInputRef.current?.click()}
          onDrop={handleFile}
        />
      )}
      {step === "processing" && (
        <ProcessingStep fileName={fileName!} fileSize={fileSize} />
      )}
      {step === "review" && (
        <ReviewStep
          drafts={drafts}
          onToggle={toggleKeep}
          onEdit={updateDraft}
          editingId={editingId}
          onSetEditing={setEditingId}
          target={target}
          onTarget={setTarget}
          keepCount={keepCount}
          onBack={() => setStep("drop")}
          onSave={handleSave}
          collections={collections}
        />
      )}
    </div>
  );
}

function DropStep({
  onPick,
  onDrop,
}: {
  onPick: () => void;
  onDrop: (file: File) => void;
}) {
  const [dragging, setDragging] = useState(false);

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragging(true);
  }
  function handleDragLeave() {
    setDragging(false);
  }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onDrop(file);
  }

  return (
    <>
      <button
        className={`up__drop fade-in${dragging ? " up__drop--drag" : ""}`}
        onClick={onPick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="up__drop-glow" aria-hidden />
        <div className="up__drop-icon">
          <UploadCloud size={28} strokeWidth={1.5} />
        </div>
        <div className="up__drop-text">
          <h2 className="text-h2">Drop a file here or click to upload</h2>
          <p className="text-body">PDF — up to 20 MB</p>
        </div>
        <div className="up__drop-badges">
          <span className="badge">
            <ShieldCheck size={10} strokeWidth={2} style={{ marginRight: 4 }} /> Private · deleted after
            processing
          </span>
          <span className="badge">
            <Wand2 size={10} strokeWidth={2} style={{ marginRight: 4 }} /> Self-hosted Ollama
          </span>
        </div>
      </button>

      <div className="up__hint">
        <p className="text-meta">Supported formats</p>
        <div className="up__formats">
          <span className="badge">
            <FileText size={10} strokeWidth={2} style={{ marginRight: 4 }} /> PDF
          </span>
          <span className="badge up__badge--muted">DOCX · GoodNotes · Notability — coming soon</span>
        </div>
      </div>
    </>
  );
}

function ProcessingStep({ fileName, fileSize }: { fileName: string; fileSize: number }) {
  const kb = Math.round(fileSize / 1024);
  return (
    <div className="up__proc fade-in">
      <div className="up__proc-file">
        <FileText size={18} strokeWidth={1.8} />
        <div>
          <div className="up__proc-filename">{fileName}</div>
          <div className="up__proc-meta">{kb > 0 ? `${kb} KB` : "—"}</div>
        </div>
        <span className="badge">
          <Loader2 size={10} className="up__spin" strokeWidth={2} style={{ marginRight: 4 }} />
          Processing
        </span>
      </div>

      <ul className="up__proc-list">
        <li className="up__proc-item up__proc-item--done">
          <CheckCircle2 size={14} strokeWidth={2} /> PDF uploaded
        </li>
        <li className="up__proc-item up__proc-item--active">
          <Loader2 size={14} className="up__spin" strokeWidth={2} /> Extracting text &amp; generating
          cards…
          <span className="text-meta">~ 30 s</span>
        </li>
        <li className="up__proc-item">
          <span className="up__proc-dot" /> Review &amp; save
          <span className="text-meta">—</span>
        </li>
      </ul>

      <p className="up__proc-tip text-body">
        Large PDFs can take up to a minute. Hang tight — we'll show you the cards when they're ready.
      </p>
    </div>
  );
}

function ReviewStep({
  drafts,
  onToggle,
  onEdit,
  editingId,
  onSetEditing,
  target,
  onTarget,
  keepCount,
  onBack,
  onSave,
  collections,
}: {
  drafts: DraftCard[];
  onToggle: (id: string) => void;
  onEdit: (id: string, field: "question" | "answer", value: string) => void;
  editingId: string | null;
  onSetEditing: (id: string | null) => void;
  target: string;
  onTarget: (id: string) => void;
  keepCount: number;
  onBack: () => void;
  onSave: () => void;
  collections: { id: string; emoji: string; name: string }[];
}) {
  return (
    <div className="up__review fade-in">
      <div className="up__review-bar">
        <div>
          <h2 className="text-h2">
            <Sparkles
              size={16}
              strokeWidth={2}
              color="var(--color-accent)"
              style={{ verticalAlign: -2, marginRight: 6 }}
            />
            {drafts.length} cards generated
          </h2>
          <p className="text-body">
            Keep, skip, or edit each one. Only selected cards get saved.
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

            {editingId === d.id ? (
              <div className="up__draft-edit">
                <label className="text-meta">Question</label>
                <textarea
                  className="up__draft-textarea"
                  value={d.question}
                  onChange={(e) => onEdit(d.id, "question", e.target.value)}
                  rows={2}
                />
                <label className="text-meta" style={{ marginTop: 8 }}>Answer</label>
                <textarea
                  className="up__draft-textarea"
                  value={d.answer}
                  onChange={(e) => onEdit(d.id, "answer", e.target.value)}
                  rows={3}
                />
                <button
                  className="btn-ghost"
                  style={{ marginTop: 8, alignSelf: "flex-end" }}
                  onClick={() => onSetEditing(null)}
                >
                  Done
                </button>
              </div>
            ) : (
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
            )}

            <div className="up__draft-side">
              <button
                className="up__draft-icon"
                title="Edit"
                onClick={() => onSetEditing(editingId === d.id ? null : d.id)}
              >
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
                <input type="checkbox" checked={d.keep} onChange={() => onToggle(d.id)} />
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
          <button className="btn-primary" disabled={keepCount === 0} onClick={onSave}>
            <CheckCircle2 size={14} strokeWidth={2} />
            Save to collection
          </button>
        </div>
      </div>
    </div>
  );
}
