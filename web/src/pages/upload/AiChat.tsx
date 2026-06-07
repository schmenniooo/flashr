import { useEffect, useRef, useState } from "react";
import { toast } from "../../lib/toast";
import {
  Sparkles,
  Loader2,
  RefreshCw,
  Layers,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { cardsApi, collectionsApi, useDb, selectCurrentUser, selectCollections } from "../../lib/store";
import { API_BASE, getToken } from "../../lib/api";
import { STORAGE_KEYS } from "../../lib/storageKeys";
import { UpgradePrompt } from "../../components/UpgradePrompt";
import { DraftCardItem } from "./DraftCardItem";
import type { DraftCard, Level } from "./types";
import type { LearnerType } from "../../types";

type ChatState = "idle" | "generating" | "results";

type ChatDraft = {
  userId: string;
  prompt: string;
  count: number;
  level: Level;
  drafts: DraftCard[];
  target: string;
};

function loadChatDraft(userId: string): Partial<ChatDraft> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.AI_CHAT_DRAFT);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ChatDraft;
    return parsed.userId === userId ? parsed : {};
  } catch {
    return {};
  }
}

function saveChatDraft(draft: ChatDraft) {
  try {
    localStorage.setItem(STORAGE_KEYS.AI_CHAT_DRAFT, JSON.stringify(draft));
  } catch {
    /* localStorage unavailable */
  }
}

function clearChatDraft() {
  localStorage.removeItem(STORAGE_KEYS.AI_CHAT_DRAFT);
}

const PROMPTS_BY_TYPE: Record<LearnerType, string[]> = {
  university: [
    "The French Revolution — causes, key events, and legacy",
    "Macroeconomics: GDP, inflation, and monetary vs fiscal policy",
    "Cell biology: organelles, mitosis, and protein synthesis",
    "Kant's Critique of Pure Reason — key concepts and arguments",
  ],
  certifications: [
    "AWS S3 and IAM for the Cloud Practitioner exam",
    "PMP exam: project phases, PMBOK knowledge areas, and ITTOs",
    "CFA Level 1: time value of money and portfolio theory",
    "IELTS Academic — task types, scoring criteria, and timing",
  ],
  school: [
    "The water cycle — evaporation, condensation, and precipitation",
    "World War II — causes, major battles, and turning points",
    "Algebra fundamentals: equations, inequalities, and functions",
    "Photosynthesis vs cellular respiration — inputs and outputs",
  ],
  professional: [
    "HTTP vs HTTPS, TCP/IP, and DNS fundamentals",
    "SQL joins: INNER, LEFT, RIGHT, FULL OUTER with examples",
    "Agile and Scrum: ceremonies, roles, and sprint workflow",
    "Negotiation tactics — BATNA, anchoring, and active listening",
  ],
  "self-study": [
    "React hooks: useState, useEffect, useCallback, useMemo",
    "Spanish A1 vocabulary: greetings, numbers, and common verbs",
    "Stoicism — core principles and how to apply them daily",
    "Investing basics: stocks, bonds, ETFs, and compound interest",
  ],
  other: [
    "AWS S3 and IAM for the Cloud Practitioner exam",
    "The French Revolution — causes, key events, and legacy",
    "React hooks: useState, useEffect, useCallback, useMemo",
    "Stoicism — core principles and how to apply them daily",
  ],
};

const DEFAULT_PROMPTS = [
  "AWS S3 and IAM for the Cloud Practitioner exam",
  "The French Revolution — causes, key events, and legacy",
  "HTTP vs HTTPS, TCP/IP, and DNS fundamentals",
  "React hooks: useState, useEffect, useCallback, useMemo",
];

function getExamplePrompts(learnerTypes: LearnerType[]): string[] {
  if (learnerTypes.length === 0) return DEFAULT_PROMPTS;
  if (learnerTypes.length === 1 && learnerTypes[0] === "other") return PROMPTS_BY_TYPE.other;
  const seen = new Set<string>();
  const result: string[] = [];
  let round = 0;
  while (result.length < 4) {
    for (const type of learnerTypes) {
      const pool = PROMPTS_BY_TYPE[type] ?? [];
      if (round < pool.length && !seen.has(pool[round])) {
        seen.add(pool[round]);
        result.push(pool[round]);
        if (result.length === 4) break;
      }
    }
    round++;
    if (round > 3) break;
  }
  return result;
}

export function AiChat({
  collections,
  navigate,
}: {
  collections: { id: string; emoji: string; name: string }[];
  navigate: (to: string) => void;
}) {
  const currentUser = useDb(selectCurrentUser);
  const allCollections = useDb(selectCollections);
  const userId = currentUser?.id ?? "";
  const saved = loadChatDraft(userId);
  const [prompt, setPrompt] = useState(saved.prompt ?? "");
  const [count, setCount] = useState<number>(saved.count ?? 10);
  const [level, setLevel] = useState<Level>(saved.level ?? "intermediate");
  const [drafts, setDrafts] = useState<DraftCard[]>(saved.drafts ?? []);
  const [chatState, setChatState] = useState<ChatState>(
    saved.drafts?.length ? "results" : "idle"
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [target, setTarget] = useState(saved.target ?? collections[0]?.id ?? "__new");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!userId) return;
    saveChatDraft({ userId, prompt, count, level, drafts, target });
  }, [userId, prompt, count, level, drafts, target]);

  const isLoading = chatState === "generating";
  const hasResults = drafts.length > 0;
  const keepCount = drafts.filter((d) => d.keep).length;
  const truncatedPrompt = prompt.length > 40 ? prompt.slice(0, 40) + "…" : prompt;

  async function handleGenerate() {
    if (!prompt.trim() || isLoading) return;
    setChatState("generating");
    setDrafts([]);
    setError(null);

    const abort = new AbortController();
    abortRef.current = abort;

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const existingCards = target !== "__new"
      ? (allCollections.find((c) => c.id === target)?.cards ?? []).map((c) => ({ question: c.question, answer: c.answer }))
      : [];

    let resp: Response;
    try {
      resp = await fetch(`${API_BASE}/ai/generate/stream`, {
        method: "POST",
        headers,
        credentials: "include",
        signal: abort.signal,
        body: JSON.stringify({ prompt: prompt.trim(), count, level, learnerTypes: currentUser?.learnerTypes ?? [], existingCards }),
      });
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError("Connection failed.");
      setChatState("idle");
      return;
    }

    if (!resp.ok) {
      if (resp.status === 403) setError("__pro__");
      else setError(`AI generation failed (${resp.status}).`);
      setChatState("idle");
      return;
    }

    const reader = resp.body!.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let cardIndex = 0;
    let eventType = "";
    let eventData = "";

    const flushEvent = () => {
      if (!eventData) return;
      try {
        const parsed = JSON.parse(eventData) as Record<string, string>;
        if (eventType === "card" && parsed.question && parsed.answer) {
          const idx = cardIndex++;
          setDrafts((prev) => [
            ...prev,
            { id: `d${idx}`, question: parsed.question, answer: parsed.answer, keep: true },
          ]);
        } else if (eventType === "error" && parsed.error) {
          setError(parsed.error);
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
    }

    setChatState(cardIndex > 0 ? "results" : "idle");
  }

  function handleDiscard() {
    abortRef.current?.abort();
    abortRef.current = null;
    setDrafts([]);
    setPrompt("");
    setChatState("idle");
    setError(null);
    clearChatDraft();
  }

  async function handleSave() {
    abortRef.current?.abort();
    abortRef.current = null;
    const kept = drafts.filter((d) => d.keep);
    if (kept.length === 0) return;
    try {
      let collectionId = target;
      if (collectionId === "__new" || !collections.find((c) => c.id === collectionId)) {
        const created = await collectionsApi.create({
          name: prompt.slice(0, 50) || "AI Generated Cards",
          folder: "Uncategorized",
          emoji: "✨",
          description: "Generated by AI from topic prompt.",
        });
        collectionId = created.id;
      }
      await Promise.all(kept.map((d) => cardsApi.add(collectionId, { question: d.question, answer: d.answer, aiGenerated: true })));
      toast.success(`${kept.length} card${kept.length === 1 ? "" : "s"} saved`);
      clearChatDraft();
      navigate(`/app/c/${collectionId}`);
    } catch {
      // toast already shown by store
    }
  }

  return (
    <div className="up__chat">
      <div className="up__composer">
        <textarea
          className="up__chat-input"
          placeholder={`Describe what you want to study — be specific.\n\ne.g. "AWS S3 and IAM concepts for the Cloud Practitioner exam"`}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleGenerate(); }}
          rows={3}
        />
        {prompt.length > 750 && (
          <div className={`up__char-count${prompt.length > 1000 ? " up__char-count--over" : " up__char-count--warn"}`}>
            {prompt.length} / 1000 {prompt.length > 1000 ? "— topic will be trimmed" : ""}
          </div>
        )}
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
              <><Loader2 size={14} className="up__spin" strokeWidth={2} />Generating…</>
            ) : drafts.length > 0 ? (
              <><RefreshCw size={14} strokeWidth={2} />Regenerate</>
            ) : (
              <><Sparkles size={14} strokeWidth={2} />Generate cards</>
            )}
          </button>
        </div>
      </div>

      {error && (error === "__pro__" ? (
        <UpgradePrompt reason="AI card generation is a Pro feature." />
      ) : (
        <div className="up__error">
          <AlertCircle size={14} strokeWidth={2} />
          {error}
        </div>
      ))}

      {chatState === "idle" && (
        <div className="up__chat-empty fade-in">
          <div className="up__chat-empty-icon">
            <Sparkles size={28} strokeWidth={1.5} />
          </div>
          <h2 className="text-h2">What do you want to study?</h2>
          <p className="text-body up__chat-subtitle">
            Describe your topic and flashr builds a tailored deck — no notes needed.
          </p>
          <div className="up__chips">
            {getExamplePrompts(currentUser?.learnerTypes ?? []).map((ex) => (
              <button key={ex} className="up__chip" onClick={() => setPrompt(ex)} type="button">
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}

      {isLoading && !hasResults && (
        <div className="up__chat-generating fade-in">
          <Loader2 size={28} className="up__spin" strokeWidth={1.5} color="var(--color-accent)" />
          <p className="text-body up__generating-label">Building your deck…</p>
          <button className="btn-ghost up__cancel-btn" onClick={handleDiscard} type="button">
            Cancel
          </button>
        </div>
      )}

      {hasResults && (
        <>
          <div className="up__regen-bar">
            <div className="up__regen-info">
              {isLoading
                ? <Loader2 size={12} className="up__spin" strokeWidth={2} color="var(--color-accent)" />
                : <Sparkles size={12} strokeWidth={2} color="var(--color-accent)" />}
              <span className="text-meta">{drafts.length} cards</span>
              {prompt && <span className="up__regen-topic">· {truncatedPrompt}</span>}
            </div>
          </div>

          <div className="up__cards-wrap">
            <div className="up__drafts fade-in">
              {drafts.map((d, i) => (
                <DraftCardItem
                  key={d.id}
                  draft={d}
                  index={i}
                  editingId={editingId}
                  onToggle={() => setDrafts((prev) => prev.map((c) => (c.id === d.id ? { ...c, keep: !c.keep } : c)))}
                  onEdit={(field, value) => setDrafts((prev) => prev.map((c) => (c.id === d.id ? { ...c, [field]: value } : c)))}
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
            <div className="up__save-target">
              <label className="text-meta">Save to</label>
              <select className="up__select" value={target} onChange={(e) => setTarget(e.target.value)}>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>{c.emoji} · {c.name}</option>
                ))}
                <option value="__new">+ Create new collection</option>
              </select>
            </div>
            <div className="up__save-actions">
              <button className="btn-ghost" onClick={handleDiscard}>
                Discard
              </button>
              <button className="btn-primary" disabled={keepCount === 0} onClick={handleSave}>
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
