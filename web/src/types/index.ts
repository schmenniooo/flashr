export type LearnerType =
  | "university"
  | "certifications"
  | "school"
  | "self-study"
  | "professional"
  | "other";

export type User = {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  oauthProvider: "google" | "apple" | "github";
  plan: "free" | "pro" | "teams";
  planExpiresAt: string | null;
  memberSince: string;
  avatarUrl: string | null;
  bio: string;
  timezone: string;
  language: string;
  dailyGoal: number;
  emailReminders: boolean;
  weeklyDigest: boolean;
  age: number | null;
  learnerTypes: LearnerType[];
  onboardingCompleted: boolean;
  dismissedSuggestions: string[];
};

export type Card = {
  id: string;
  question: string;
  answer: string;
  aiGenerated: boolean;
  mastery: "new" | "learning" | "known";
};

export type Collection = {
  id: string;
  name: string;
  folder: string;
  emoji: string;
  description: string;
  cards: Card[];
  lastStudied: string;
  progress: number;
  isPublic: boolean;
  createdAt: string;
};

export type Folder = {
  name: string;
  emoji: string;
  count: number;
};

export type Suggestion = {
  id: string;
  learnerTypes: LearnerType[];
  emoji: string;
  title: string;
  description: string;
  folder: string;
  folderEmoji: string;
};
