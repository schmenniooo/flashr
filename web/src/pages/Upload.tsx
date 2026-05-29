import { useRef, useState } from "react";
import { toast } from "../lib/toast";
import { Link, useNavigate } from "react-router-dom";
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Wand2,
  ArrowLeft,
  AlertCircle,
  MessageSquare,
} from "lucide-react";
import {
  cardsApi,
  collectionsApi,
  selectCollections,
  selectCurrentUser,
  useDb,
} from "../lib/store";
import { api, ApiError } from "../lib/api";
import { UpgradePrompt } from "../components/UpgradePrompt";
import { AiChat } from "./upload/AiChat";
import { ReviewStep } from "./upload/ReviewStep";
import type { DraftCard } from "./upload/types";
import "./Upload.css";

type Step = "drop" | "processing" | "review";
type ActiveTab = "pdf" | "chat";

export function Upload() {
  const navigate = useNavigate();
  const collections = useDb(selectCollections);
  const currentUser = useDb(selectCurrentUser);
  const isPro = currentUser?.plan === "pro";
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<ActiveTab>("pdf");
  const [step, setStep] = useState<Step>("drop");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number>(0);
  const [drafts, setDrafts] = useState<DraftCard[]>([]);
  const [target, setTarget] = useState<string>(collections[0]?.id ?? "__new");
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);

  async function handleFile(file: File) {
    const name = file.name.toLowerCase();
    if (!name.endsWith(".pdf") && !name.endsWith(".md") && !name.endsWith(".docx") && !name.endsWith(".apkg")) {
      setError("Only PDF, Markdown (.md), Word (.docx) and Anki (.apkg) files are supported right now.");
      return;
    }
    if (file.size > 500 * 1024 * 1024) {
      setError("File too large — max 500 MB.");
      return;
    }
    setError(null);
    setFileName(file.name);
    setFileSize(file.size);
    setStep("processing");
    const form = new FormData();
    form.append("file", file);
    try {
      const result = await api<{ cards: { question: string; answer: string }[]; truncated?: boolean }>(
        "/ai/upload",
        { method: "POST", body: form }
      );
      setDrafts(result.cards.map((c, i) => ({ id: `d${i}`, question: c.question, answer: c.answer, keep: true })));
      setTruncated(result.truncated ?? false);
      setStep("review");
    } catch (err: unknown) {
      setError(err instanceof ApiError && err.status === 403 ? "__pro__" : (err instanceof Error ? err.message : "Something went wrong."));
      setStep("drop");
    }
  }

  async function handleSave() {
    const kept = drafts.filter((d) => d.keep);
    if (kept.length === 0) return;
    try {
      let collectionId = target;
      if (collectionId === "__new" || !collections.find((c) => c.id === collectionId)) {
        const name = newCollectionName;
        const created = await collectionsApi.create({ name, folder: "Uncategorized", emoji: "✨", description: "Generated from your uploaded notes." });
        collectionId = created.id;
      }
      await Promise.all(kept.map((d) => cardsApi.add(collectionId, { question: d.question, answer: d.answer, aiGenerated: true })));
      toast.success(`${kept.length} card${kept.length === 1 ? "" : "s"} saved`);
      navigate(`/app/c/${collectionId}`);
    } catch {
      // toast already shown by store
    }
  }

  const keepCount = drafts.filter((d) => d.keep).length;
  const newCollectionName = fileName
    ? fileName.replace(/\.(pdf|md|docx|apkg)$/i, "").replace(/[_-]/g, " ")
    : "AI Generated Cards";

  return (
    <div className="up">
      <Link to="/app" className="up__back">
        <ArrowLeft size={14} strokeWidth={2} />
        Back to dashboard
      </Link>

      <header className="up__head">
        <span className="text-meta">Create with AI · ~30 sec</span>
        <h1 className="text-h1 up__title">Your notes, turned into cards.</h1>
        <p className="text-body up__subtitle">
          Upload a PDF or describe a topic — flashr generates the cards.
        </p>
      </header>

      {!isPro && (
        <div className="up__gate">
          <UpgradePrompt reason="AI generation is a Pro feature. Upgrade to unlock file uploads and topic-based card generation." />
        </div>
      )}

      <div className={`up__content${!isPro ? " up__content--locked" : ""}`}>
        <div className="up__tabs">
          <button
            className={`up__tab${activeTab === "pdf" ? " up__tab--active" : ""}`}
            onClick={() => setActiveTab("pdf")}
          >
            <UploadCloud size={14} strokeWidth={2} />
            Upload file
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
          accept=".pdf,.md,.docx,.apkg"
          className="up__file-input"
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
              <li className={`up__step ${step === "processing" ? "up__step--active" : ""} ${step === "review" ? "up__step--done" : ""}`}>
                <span className="up__step-n">2</span> AI processing
              </li>
              <li className={`up__step ${step === "review" ? "up__step--active" : ""}`}>
                <span className="up__step-n">3</span> Review & save
              </li>
            </ol>

            {error && (error === "__pro__" ? (
              <UpgradePrompt reason="AI generation from files is a Pro feature." />
            ) : (
              <div className="up__error">
                <AlertCircle size={14} strokeWidth={2} />
                {error}
              </div>
            ))}

            {step === "drop" && (
              <DropStep onPick={() => fileInputRef.current?.click()} onDrop={handleFile} />
            )}
            {step === "processing" && (
              <ProcessingStep fileName={fileName!} fileSize={fileSize} />
            )}
            {step === "review" && truncated && (
              <div className="up__warning">
                <AlertCircle size={14} strokeWidth={2} />
                Your file was too large to process in full — only the first 20 KB of text was used. Consider splitting the file for better coverage.
              </div>
            )}
            {step === "review" && (
              <ReviewStep
                drafts={drafts}
                onToggle={(id) => setDrafts((d) => d.map((c) => (c.id === id ? { ...c, keep: !c.keep } : c)))}
                onEdit={(id, field, value) => setDrafts((d) => d.map((c) => (c.id === id ? { ...c, [field]: value } : c)))}
                editingId={editingId}
                onSetEditing={setEditingId}
                target={target}
                onTarget={setTarget}
                keepCount={keepCount}
                onBack={() => setStep("drop")}
                onSave={handleSave}
                collections={collections}
                newCollectionName={newCollectionName}
              />
            )}
          </>
        )}

        {activeTab === "chat" && (
          <AiChat collections={collections} navigate={navigate} />
        )}
      </div>
    </div>
  );
}

function DropStep({ onPick, onDrop }: { onPick: () => void; onDrop: (file: File) => void }) {
  const [dragging, setDragging] = useState(false);

  return (
    <>
      <button
        className={`up__drop fade-in${dragging ? " up__drop--drag" : ""}`}
        onClick={onPick}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) onDrop(f); }}
      >
        <div className="up__drop-glow" aria-hidden />
        <div className="up__drop-icon">
          <UploadCloud size={28} strokeWidth={1.5} />
        </div>
        <div className="up__drop-text">
          <h2 className="text-h2">Drop a file here or click to upload</h2>
          <p className="text-body">PDF, Markdown, Word or Anki — up to 500 MB</p>
        </div>
        <div className="up__drop-badges">
          <span className="badge">
            <ShieldCheck size={10} strokeWidth={2} className="up__badge-icon" /> Private · deleted after processing
          </span>
          <span className="badge">
            <Wand2 size={10} strokeWidth={2} className="up__badge-icon" /> Self-hosted Ollama
          </span>
        </div>
      </button>

      <div className="up__hint">
        <p className="text-meta">Supported formats</p>
        <div className="up__formats">
          <span className="badge">
            <FileText size={10} strokeWidth={2} className="up__badge-icon" /> PDF
          </span>
          <span className="badge">
            <FileText size={10} strokeWidth={2} className="up__badge-icon" /> Markdown
          </span>
          <span className="badge">
            <FileText size={10} strokeWidth={2} className="up__badge-icon" /> Word
          </span>
          <span className="badge">
            <FileText size={10} strokeWidth={2} className="up__badge-icon" /> Anki
          </span>
          <span className="badge up__badge--muted">GoodNotes · Notability — coming soon</span>
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
          <Loader2 size={10} className="up__spin up__badge-icon" strokeWidth={2} />
          Processing
        </span>
      </div>

      <ul className="up__proc-list">
        <li className="up__proc-item up__proc-item--done">
          <CheckCircle2 size={14} strokeWidth={2} /> File uploaded
        </li>
        <li className="up__proc-item up__proc-item--active">
          <Loader2 size={14} className="up__spin" strokeWidth={2} /> Extracting text &amp; generating cards…
          <span className="text-meta">~ 30 s – a few min for large decks</span>
        </li>
        <li className="up__proc-item">
          <span className="up__proc-dot" /> Review &amp; save
          <span className="text-meta">—</span>
        </li>
      </ul>

      <p className="up__proc-tip text-body">
        Large files can take a few minutes to process. Hang tight — we'll show you the cards when they're ready.
      </p>
    </div>
  );
}
