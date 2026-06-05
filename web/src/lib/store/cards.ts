import { api } from "../api";
import { state, setState, recalcProgress } from "./db";
import { mapCard } from "./collections";
import { toast } from "../toast";
import type { Card } from "../../types";

export const cardsApi = {
  async add(collectionId: string, input: { question: string; answer: string; aiGenerated?: boolean }): Promise<Card> {
    try {
      const bc = await api<{ id: string; question: string; answer: string; ai_generated: boolean; created_at: string }>(
        `/collections/${collectionId}/cards`,
        { method: "POST", body: JSON.stringify({ question: input.question, answer: input.answer, ai_generated: input.aiGenerated ?? false }) },
      );
      const card = mapCard(bc, state.masteryMap);
      setState((db) => ({
        ...db,
        collections: db.collections.map((c) =>
          c.id === collectionId
            ? recalcProgress({ ...c, cards: [...c.cards, card] })
            : c,
        ),
      }));
      if (!input.aiGenerated) toast.success("Card added");
      return card;
    } catch (err) {
      toast.error("Failed to save card");
      throw err;
    }
  },

  async update(collectionId: string, cardId: string, patch: { question?: string; answer?: string }): Promise<void> {
    try {
      const bc = await api<{ id: string; question: string; answer: string; ai_generated: boolean; created_at: string }>(
        `/cards/${cardId}`,
        { method: "PATCH", body: JSON.stringify({ question: patch.question, answer: patch.answer }) },
      );
      setState((db) => ({
        ...db,
        collections: db.collections.map((c) =>
          c.id === collectionId
            ? recalcProgress({
                ...c,
                cards: c.cards.map((k) =>
                  k.id === cardId ? { ...k, question: bc.question, answer: bc.answer } : k,
                ),
              })
            : c,
        ),
      }));
      toast.success("Card updated");
    } catch (err) {
      toast.error("Failed to update card");
      throw err;
    }
  },

  async remove(collectionId: string, cardId: string): Promise<void> {
    try {
      await api(`/cards/${cardId}`, { method: "DELETE" });
      setState((db) => ({
        ...db,
        collections: db.collections.map((c) =>
          c.id === collectionId
            ? recalcProgress({ ...c, cards: c.cards.filter((k) => k.id !== cardId) })
            : c,
        ),
      }));
      toast.success("Card deleted");
    } catch (err) {
      toast.error("Failed to delete card");
      throw err;
    }
  },

  async move(fromCollectionId: string, cardId: string, toCollectionId: string): Promise<void> {
    const card = state.collections
      .find(c => c.id === fromCollectionId)
      ?.cards.find(k => k.id === cardId);
    if (!card) return;
    try {
      await api(`/cards/${cardId}`, {
        method: "PATCH",
        body: JSON.stringify({ collection_id: toCollectionId }),
      });
      setState((db) => ({
        ...db,
        collections: db.collections.map((c) => {
          if (c.id === fromCollectionId) return recalcProgress({ ...c, cards: c.cards.filter(k => k.id !== cardId) });
          if (c.id === toCollectionId) return recalcProgress({ ...c, cards: [...c.cards, card] });
          return c;
        }),
      }));
      const toName = state.collections.find((c) => c.id === toCollectionId)?.name;
      toast.success(toName ? `Card moved to "${toName}"` : "Card moved");
    } catch (err) {
      toast.error("Failed to move card");
      throw err;
    }
  },

  setMastery(collectionId: string, cardId: string, mastery: Card["mastery"]) {
    setState((db) => ({
      ...db,
      masteryMap: { ...db.masteryMap, [cardId]: mastery },
      collections: db.collections.map((c) =>
        c.id === collectionId
          ? recalcProgress({ ...c, cards: c.cards.map((k) => k.id === cardId ? { ...k, mastery } : k) })
          : c,
      ),
    }));
  },

  async review(collectionId: string, cardId: string, rating: "again" | "hard" | "good" | "easy"): Promise<void> {
    // Optimistic update: apply a local mastery estimate immediately so the UI
    // reflects the rating without waiting for the network round-trip.
    const optimisticMastery: Card["mastery"] = rating === "again" ? "new" : "learning";
    setState((db) => ({
      ...db,
      masteryMap: { ...db.masteryMap, [cardId]: optimisticMastery },
      collections: db.collections.map((c) =>
        c.id === collectionId
          ? recalcProgress({ ...c, cards: c.cards.map((k) => k.id === cardId ? { ...k, mastery: optimisticMastery } : k) })
          : c,
      ),
    }));

    // Client's local calendar date (ISO YYYY-MM-DD) — avoids UTC-midnight edge cases.
    const localDate = new Date().toLocaleDateString("sv");

    try {
      const bc = await api<{
        id: string; question: string; answer: string; ai_generated: boolean; created_at: string;
        mastery: Card["mastery"]; interval: number; ease_factor: number; repetitions: number; due_date: string | null;
        cards_today?: number; daily_goal?: number; streak?: number; goal_met?: boolean;
      }>(`/cards/${cardId}/review`, { method: "POST", body: JSON.stringify({ rating, date: localDate }) });

      // Overwrite with server-computed SM-2 values + streak/goal progress.
      setState((db) => ({
        ...db,
        cardsToday: bc.cards_today ?? db.cardsToday,
        users: db.users.map((u) =>
          u.id === db.session?.userId
            ? {
                ...u,
                streak: bc.streak ?? u.streak,
                dailyGoal: bc.daily_goal ?? u.dailyGoal,
              }
            : u,
        ),
        collections: db.collections.map((c) =>
          c.id === collectionId
            ? recalcProgress({
                ...c,
                cards: c.cards.map((k) =>
                  k.id === cardId
                    ? { ...k, mastery: bc.mastery, interval: bc.interval, easeFactor: bc.ease_factor, repetitions: bc.repetitions, dueDate: bc.due_date }
                    : k
                ),
              })
            : c,
        ),
      }));
    } catch {
      // Review failures are silent — the session continues; the next load will re-sync.
    }
  },
};
