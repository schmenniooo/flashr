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
import { API_BASE, getToken } from "../lib/api";
import { UpgradePrompt } from "../components/UpgradePrompt";
import { AiChat } from "./upload/AiChat";
import { ReviewStep } from "./upload/ReviewStep";
import type { DraftCard } from "./upload/types";
import { usePostHog } from "@posthog/react";
import "./Upload.css";

type Step = "drop" | "processing" | "review";
type ActiveTab = "pdf" | "chat";

export function Upload() {
  const navigate = useNavigate();
  const posthog = usePostHog();
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
  const [skipped, setSkipped] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

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
    setDrafts([]);
    setTruncated(false);
    setSkipped(0);
    setIsGenerating(true);
    setStep("processing");
    posthog.capture("ai_generation_started", {
      method: "file",
      file_type: file.name.split(".").pop()?.toLowerCase(),
      file_size_kb: Math.round(file.size / 1024),
    });

    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;

    const headers: Record<string, string> = {};
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;

    let resp: Response;
    try {
      const form = new FormData();
      form.append("file", file);
      resp = await fetch(`${API_BASE}/ai/upload/stream`, {
        method: "POST",
        headers,
        credentials: "include",
        signal: abort.signal,
        body: form,
      });
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError("Upload failed — check your connection.");
      setStep("drop");
      setIsGenerating(false);
      return;
    }

    if (!resp.ok) {
      const body = await resp.json().catch(() => ({})) as { error?: string };
      if (resp.status === 403) {
        setError("__pro__");
      } else {
        setError(body.error ?? "Something went wrong.");
      }
      setStep("drop");
      setIsGenerating(false);
      return;
    }

    const reader = resp.body!.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let cardIndex = 0;
    let eventType = "";
    let eventData = "";
    let movedToReview = false;

    const flushEvent = () => {
      if (!eventData) return;
      try {
        const parsed = JSON.parse(eventData) as Record<string, unknown>;
        if (eventType === "card") {
          const q = parsed.question as string;
          const a = parsed.answer as string;
          if (q && a) {
            const idx = cardIndex++;
            setDrafts((prev) => [...prev, { id: `d${idx}`, question: q, answer: a, keep: true }]);
            if (!movedToReview) {
              movedToReview = true;
              setStep("review");
            }
          }
        } else if (eventType === "meta") {
          if (parsed.truncated) setTruncated(true);
          if (typeof parsed.skipped === "number" && parsed.skipped > 0) setSkipped(parsed.skipped);
        } else if (eventType === "error") {
          setError((parsed.error as string) ?? "AI generation failed.");
          setStep("drop");
        }
      } catch { /* malformed SSE data */ }
      eventType = "";
      eventData = "";
    };

    const processLine = (line: string) => {
      if (line.startsWith("event:")) {
        eventType = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        eventData += line.slice(5).trimStart();
      } else if (line === "") {
        flushEvent();
      }
    };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop()!;
        for (const line of lines) processLine(line);
      }
      if (buf) processLine(buf);
      flushEvent();
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
    } finally {
      setIsGenerating(false);
    }

    if (cardIndex === 0 && step !== "drop") {
      setError("No cards could be generated from this file.");
      setStep("drop");
    }
  }

  async function handleSave() {
    const kept = drafts.filter((d) => d.keep);
    if (kept.length === 0) return;
    try {
      let collectionId = target;
      const isNew = collectionId === "__new" || !collections.find((c) => c.id === collectionId);
      if (isNew) {
        const name = newCollectionName;
        const created = await collectionsApi.create({ name, folder: "Uncategorized", emoji: "✨", description: "Generated from your uploaded notes." });
        collectionId = created.id;
      }
      await Promise.all(kept.map((d) => cardsApi.add(collectionId, { question: d.question, answer: d.answer, aiGenerated: true })));
      posthog.capture("ai_cards_saved", {
        method: "file",
        cards_saved: kept.length,
        cards_discarded: drafts.length - kept.length,
        collection_id: collectionId,
        new_collection: isNew,
      });
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
                Your file was too large to process in full — only part of the text was used to generate cards. Consider splitting the file for better coverage.
              </div>
            )}
            {step === "review" && skipped > 0 && (
              <div className="up__warning">
                <AlertCircle size={14} strokeWidth={2} />
                {skipped} note{skipped === 1 ? "" : "s"} were skipped — they may be image-only or have empty fields.
              </div>
            )}
            {step === "review" && (
              <ReviewStep
                drafts={drafts}
                isGenerating={isGenerating}
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
