import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  UploadCloud,
  FileText,
  Sparkles,
  CheckCircle2,
  Pencil,
  Trash2,
  Loader2,
  ShieldCheck,
  Wand2,
  Layers,
  ArrowLeft,
  AlertCircle,
  MessageSquare,
  RefreshCw,
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
type ActiveTab = "pdf" | "chat";
type ChatState = "idle" | "generating" | "results" | "regenerating";
type Level = "beginner" | "intermediate" | "advanced";

type DraftCard = {
  id: string;
  question: string;
  answer: string;
  keep: boolean;
};

const EXAMPLE_PROMPTS = [
  "AWS S3 and IAM for the Cloud Practitioner exam",
  "The French Revolution — causes, key events, and legacy",
  "HTTP vs HTTPS, TCP/IP, and DNS fundamentals",
  "React hooks: useState, useEffect, useCallback, useMemo",
];

export function Upload() {
  const navigate = useNavigate();
  const collections = useDb(selectCollections);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<ActiveTab>("pdf");
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
          Upload a PDF or describe a topic — flashr generates the cards.
        </p>
      </header>

      <div className="up__tabs">
        <button
          className={`up__tab${activeTab === "pdf" ? " up__tab--active" : ""}`}
          onClick={() => setActiveTab("pdf")}
        >
          <UploadCloud size={14} strokeWidth={2} />
          Upload PDF
        </button>
        <button
          className={`up__tab${activeTab === "chat" ? " up__tab--active" : ""}`}
          onClick={() => setActiveTab("chat")}
        >
          <MessageSquare size={14} strokeWidth={2} />
          Describe a topic
        </button>
      </div>

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

      {activeTab === "pdf" && (
        <>
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
              onToggle={(id) =>
                setDrafts((d) => d.map((c) => (c.id === id ? { ...c, keep: !c.keep } : c)))
              }
              onEdit={(id, field, value) =>
                setDrafts((d) => d.map((c) => (c.id === id ? { ...c, [field]: value } : c)))
              }
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
        </>
      )}

      {activeTab === "chat" && (
        <AiChat collections={collections} navigate={navigate} />
      )}
    </div>
  );
}

function AiChat({
  collections,
  navigate,
}: {
  collections: { id: string; emoji: string; name: string }[];
  navigate: (to: string) => void;
}) {
  const [chatState, setChatState] = useState<ChatState>("idle");
  const [prompt, setPrompt] = useState("");
  const [count, setCount] = useState(10);
  const [level, setLevel] = useState<Level>("intermediate");
  const [drafts, setDrafts] = useState<DraftCard[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [target, setTarget] = useState(collections[0]?.id ?? "__new");
  const [error, setError] = useState<string | null>(null);

  const isLoading = chatState === "generating" || chatState === "regenerating";
  const hasResults = chatState === "results" || chatState === "regenerating";
  const keepCount = drafts.filter((d) => d.keep).length;
  const truncatedPrompt = prompt.length > 40 ? prompt.slice(0, 40) + "…" : prompt;

  async function handleGenerate() {
    if (!prompt.trim() || isLoading) return;

    setChatState(drafts.length > 0 ? "regenerating" : "generating");
    setError(null);

    try {
      const result = await api<{ cards: { question: string; answer: string }[] }>(
        "/ai/generate",
        {
          method: "POST",
          body: JSON.stringify({ prompt: prompt.trim(), count, level }),
        }
      );
      const generated = result.cards.map((c, i) => ({
        id: `d${i}`,
        question: c.question,
        answer: c.answer,
        keep: true,
      }));
      setDrafts(generated);
      setChatState("results");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setError(msg);
      setChatState(drafts.length > 0 ? "results" : "idle");
    }
  }

  async function handleSave() {
    const kept = drafts.filter((d) => d.keep);
    if (kept.length === 0) return;

    let collectionId = target;
    if (collectionId === "__new" || !collections.find((c) => c.id === collectionId)) {
      const name = prompt.slice(0, 50) || "AI Generated Cards";
      const created = await collectionsApi.create({
        name,
        folder: "Uncategorized",
        emoji: "✨",
        description: "Generated by AI from topic prompt.",
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

  return (
    <div className="up__chat">
      <div className="up__composer">
        <textarea
          className="up__chat-input"
          placeholder={`Describe what you want to study — be specific.\n\ne.g. "AWS S3 and IAM concepts for the Cloud Practitioner exam"`}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleGenerate();
          }}
          rows={3}
        />
        <div className="up__composer-footer">
          <div className="up__composer-controls">
            <div className="up__count-pills">
              <span className="text-meta">Cards</span>
              {([5, 10, 15, 20] as const).map((n) => (
                <button
                  key={n}
                  className={`up__pill${count === n ? " up__pill--active" : ""}`}
                  onClick={() => setCount(n)}
                  type="button"
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="up__count-pills">
              <span className="text-meta">Level</span>
              {(["beginner", "intermediate", "advanced"] as const).map((l) => (
                <button
                  key={l}
                  className={`up__pill${level === l ? " up__pill--active" : ""}`}
                  onClick={() => setLevel(l)}
                  type="button"
                >
                  {l.charAt(0).toUpperCase() + l.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <button
            className="btn-primary up__generate-btn"
            disabled={!prompt.trim() || isLoading}
            onClick={handleGenerate}
            type="button"
          >
            {isLoading ? (
              <>
                <Loader2 size={14} className="up__spin" strokeWidth={2} />
                Generating…
              </>
            ) : hasResults ? (
              <>
                <RefreshCw size={14} strokeWidth={2} />
                Regenerate
              </>
            ) : (
              <>
                <Sparkles size={14} strokeWidth={2} />
                Generate cards
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="up__error">
          <AlertCircle size={14} strokeWidth={2} />
          {error}
        </div>
      )}

      {chatState === "idle" && (
        <div className="up__chat-empty fade-in">
          <div className="up__chat-empty-icon">
            <Sparkles size={28} strokeWidth={1.5} />
          </div>
          <h2 className="text-h2">What do you want to study?</h2>
          <p className="text-body" style={{ marginTop: 4, maxWidth: 460 }}>
            Describe your topic and flashr builds a tailored deck — no notes needed.
          </p>
          <div className="up__chips">
            {EXAMPLE_PROMPTS.map((ex) => (
              <button
                key={ex}
                className="up__chip"
                onClick={() => setPrompt(ex)}
                type="button"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}

      {chatState === "generating" && (
        <div className="up__chat-generating fade-in">
          <Loader2 size={28} className="up__spin" strokeWidth={1.5} color="var(--color-accent)" />
          <p className="text-body" style={{ marginTop: 12 }}>Building your deck…</p>
        </div>
      )}

      {hasResults && drafts.length > 0 && (
        <>
          <div className="up__regen-bar">
            <div className="up__regen-info">
              <Sparkles size={12} strokeWidth={2} color="var(--color-accent)" />
              <span className="text-meta">{drafts.length} cards</span>
              {prompt && <span className="up__regen-topic">· {truncatedPrompt}</span>}
            </div>
          </div>

          <div className={`up__cards-wrap${chatState === "regenerating" ? " up__cards-wrap--loading" : ""}`}>
            {chatState === "regenerating" && (
              <div className="up__regen-overlay">
                <Loader2 size={28} className="up__spin" strokeWidth={1.5} color="var(--color-accent)" />
              </div>
            )}
            <div className="up__drafts fade-in">
              {drafts.map((d, i) => (
                <DraftCardItem
                  key={d.id}
                  draft={d}
                  index={i}
                  editingId={editingId}
                  onToggle={() =>
                    setDrafts((prev) =>
                      prev.map((c) => (c.id === d.id ? { ...c, keep: !c.keep } : c))
                    )
                  }
                  onEdit={(field, value) =>
                    setDrafts((prev) =>
                      prev.map((c) => (c.id === d.id ? { ...c, [field]: value } : c))
                    )
                  }
                  onSetEditing={setEditingId}
                />
              ))}
            </div>
          </div>

          <div className="up__save-bar">
            <div className="up__save-summary">
              <Layers size={14} strokeWidth={2} />
              <strong>{keepCount}</strong> of {drafts.length} cards will be saved
            </div>
            <div className="up__save-actions">
              <select
                className="up__select"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              >
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.emoji} · {c.name}
                  </option>
                ))}
                <option value="__new">+ Create new collection</option>
              </select>
              <button
                className="btn-primary"
                disabled={keepCount === 0}
                onClick={handleSave}
              >
                <CheckCircle2 size={14} strokeWidth={2} />
                Save to collection
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function DraftCardItem({
  draft,
  index,
  editingId,
  onToggle,
  onEdit,
  onSetEditing,
}: {
  draft: DraftCard;
  index: number;
  editingId: string | null;
  onToggle: () => void;
  onEdit: (field: "question" | "answer", value: string) => void;
  onSetEditing: (id: string | null) => void;
}) {
  return (
    <article className={`up__draft ${draft.keep ? "up__draft--keep" : "up__draft--skip"}`}>
      <div className="up__draft-idx">
        <span className="text-meta">#{String(index + 1).padStart(2, "0")}</span>
        <span className="up__ai-pill">
          <Sparkles size={10} strokeWidth={2} />
          AI
        </span>
      </div>

      {editingId === draft.id ? (
        <div className="up__draft-edit">
          <label className="text-meta">Question</label>
          <textarea
            className="up__draft-textarea"
            value={draft.question}
            onChange={(e) => onEdit("question", e.target.value)}
            rows={2}
          />
          <label className="text-meta" style={{ marginTop: 8 }}>Answer</label>
          <textarea
            className="up__draft-textarea"
            value={draft.answer}
            onChange={(e) => onEdit("answer", e.target.value)}
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
            <p>{draft.question}</p>
          </div>
          <div>
            <span className="text-meta">Answer</span>
            <p className="up__draft-answer">{draft.answer}</p>
          </div>
        </div>
      )}

      <div className="up__draft-side">
        <button
          className="up__draft-icon"
          title="Edit"
          onClick={() => onSetEditing(editingId === draft.id ? null : draft.id)}
        >
          <Pencil size={13} strokeWidth={1.8} />
        </button>
        <button
          className="up__draft-icon up__draft-icon--danger"
          title="Skip"
          onClick={onToggle}
        >
          <Trash2 size={13} strokeWidth={1.8} />
        </button>
        <label className="up__switch">
          <input type="checkbox" checked={draft.keep} onChange={onToggle} />
          <span />
        </label>
      </div>
    </article>
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
          <DraftCardItem
            key={d.id}
            draft={d}
            index={i}
            editingId={editingId}
            onToggle={() => onToggle(d.id)}
            onEdit={(field, value) => onEdit(d.id, field, value)}
            onSetEditing={onSetEditing}
          />
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
