import { api } from "../api";
import { state, setState, recalcProgress } from "./db";
import { mapCard } from "./collections";
import type { Card } from "../../types";

export const cardsApi = {
  async add(collectionId: string, input: { question: string; answer: string; aiGenerated?: boolean }): Promise<Card> {
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
    return card;
  },

  async update(collectionId: string, cardId: string, patch: { question?: string; answer?: string }): Promise<void> {
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
  },

  async remove(collectionId: string, cardId: string): Promise<void> {
    await api(`/cards/${cardId}`, { method: "DELETE" });
    setState((db) => ({
      ...db,
      collections: db.collections.map((c) =>
        c.id === collectionId
          ? recalcProgress({ ...c, cards: c.cards.filter((k) => k.id !== cardId) })
          : c,
      ),
    }));
  },

  async move(fromCollectionId: string, cardId: string, toCollectionId: string): Promise<void> {
    const card = state.collections
      .find(c => c.id === fromCollectionId)
      ?.cards.find(k => k.id === cardId);
    if (!card) return;
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
};
