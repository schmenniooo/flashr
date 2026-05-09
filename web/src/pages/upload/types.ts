export type Level = "beginner" | "intermediate" | "advanced";

export type DraftCard = {
  id: string;
  question: string;
  answer: string;
  keep: boolean;
};
