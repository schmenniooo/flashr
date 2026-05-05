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

export const user: User = {
  firstName: "Ennio",
  lastName: "Smith",
  username: "ennio",
  email: "ennio.nick@gmail.com",
  oauthProvider: "google",
  plan: "pro",
  planExpiresAt: null,
  memberSince: "November 2025",
  avatarUrl: null,
  bio: "Med student, note-taker, quietly obsessed with flashcards.",
  timezone: "Europe/Berlin",
  language: "English",
  dailyGoal: 30,
  emailReminders: true,
  weeklyDigest: false,
  age: 24,
  learnerTypes: ["university"],
  onboardingCompleted: true,
  dismissedSuggestions: [],
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

export const folders: Folder[] = [
  { name: "Medicine", emoji: "🧬", count: 3 },
  { name: "Languages", emoji: "🗣️", count: 2 },
  { name: "Certifications", emoji: "📜", count: 1 },
  { name: "University", emoji: "🎓", count: 2 },
];

export const collections: Collection[] = [
  {
    id: "biochem-7",
    name: "Biochemistry — Enzyme Kinetics",
    folder: "Medicine",
    emoji: "🧬",
    description: "Lecture 7, Michaelis-Menten & inhibitors.",
    lastStudied: "2 hours ago",
    progress: 68,
    isPublic: false,
    createdAt: "2026-04-20T10:00:00Z",
    cards: [
      {
        id: "c1",
        question: "What does the Michaelis constant (Kₘ) describe?",
        answer:
          "The substrate concentration at which the reaction rate is half of the maximum velocity (½ Vₘₐₓ). It reflects the enzyme's affinity for the substrate — a low Kₘ means high affinity.",
        aiGenerated: true,
        mastery: "known",
      },
      {
        id: "c2",
        question: "How does a competitive inhibitor affect Kₘ and Vₘₐₓ?",
        answer:
          "Kₘ increases (apparent), Vₘₐₓ stays the same. The inhibitor competes with the substrate for the active site — higher substrate concentrations can outcompete it.",
        aiGenerated: true,
        mastery: "learning",
      },
      {
        id: "c3",
        question: "What is the Lineweaver-Burk linearization?",
        answer:
          "The double-reciprocal plot of 1/v against 1/[S]. It linearizes the Michaelis-Menten equation — the y-intercept is 1/Vₘₐₓ, the x-intercept is -1/Kₘ.",
        aiGenerated: false,
        mastery: "new",
      },
      {
        id: "c4",
        question: "Name three types of reversible enzyme inhibition.",
        answer:
          "Competitive (substrate-like, at the active site), non-competitive (at an allosteric site, regardless of whether S is bound), and uncompetitive (binds only to the ES complex).",
        aiGenerated: true,
        mastery: "learning",
      },
      {
        id: "c5",
        question: "What does the catalytic constant kcat represent?",
        answer:
          "The turnover number — the number of substrate molecules converted per enzyme molecule per unit time at saturation. Unit: s⁻¹.",
        aiGenerated: true,
        mastery: "new",
      },
    ],
  },
  {
    id: "spanish-a2",
    name: "Spanish Vocab · A2",
    folder: "Languages",
    emoji: "🇪🇸",
    description: "Everyday vocabulary, verbs & expressions.",
    lastStudied: "yesterday",
    progress: 42,
    isPublic: true,
    createdAt: "2026-04-15T09:00:00Z",
    cards: [
      {
        id: "s1",
        question: "la biblioteca",
        answer: "the library",
        aiGenerated: false,
        mastery: "known",
      },
      {
        id: "s2",
        question: "acostumbrarse a",
        answer: "to get used to",
        aiGenerated: false,
        mastery: "learning",
      },
      {
        id: "s3",
        question: "a menudo",
        answer: "often, frequently",
        aiGenerated: false,
        mastery: "new",
      },
      {
        id: "s4",
        question: "quedarse",
        answer: "to stay, to remain",
        aiGenerated: false,
        mastery: "known",
      },
    ],
  },
  {
    id: "aws-cp",
    name: "AWS Cloud Practitioner",
    folder: "Certifications",
    emoji: "☁️",
    description: "Exam prep CLF-C02.",
    lastStudied: "3 days ago",
    progress: 91,
    isPublic: false,
    createdAt: "2026-04-10T14:00:00Z",
    cards: [
      {
        id: "a1",
        question: "What does the AWS Shared Responsibility Model describe?",
        answer:
          "AWS is responsible for security *of* the cloud (hardware, network, facilities). The customer is responsible for security *in* the cloud (data, configs, IAM, patching).",
        aiGenerated: true,
        mastery: "known",
      },
      {
        id: "a2",
        question: "What's the difference between S3 Standard and S3 Glacier?",
        answer:
          "S3 Standard: frequent access, millisecond latency, more expensive. Glacier: archive storage, minutes-to-hours retrieval, very cheap. Ideal for compliance data.",
        aiGenerated: true,
        mastery: "known",
      },
    ],
  },
  {
    id: "history-weimar",
    name: "History · Weimar Republic",
    folder: "University",
    emoji: "📚",
    description: "From 1918 to the Nazi seizure of power in 1933.",
    lastStudied: "5 days ago",
    progress: 23,
    isPublic: false,
    createdAt: "2026-04-08T11:00:00Z",
    cards: [
      {
        id: "g1",
        question: "When was the Weimar Constitution adopted?",
        answer:
          "On August 11, 1919. It took effect the same day and established the first parliamentary democracy on German soil.",
        aiGenerated: true,
        mastery: "new",
      },
      {
        id: "g2",
        question: "What was the Dawes Plan (1924)?",
        answer:
          "A payment plan to restructure Germany's WWI reparations. US loans stabilized the German economy — leading to the “Golden Twenties”.",
        aiGenerated: true,
        mastery: "learning",
      },
      {
        id: "g3",
        question: "Name the three phases of the Weimar Republic.",
        answer:
          "1. Crisis years (1918–1923): revolution, hyperinflation, coup attempts. 2. Relative stability (1924–1929): Stresemann, Dawes Plan. 3. Dissolution (1929–1933): Great Depression, presidential cabinets.",
        aiGenerated: false,
        mastery: "new",
      },
    ],
  },
  {
    id: "anatomy-forearm",
    name: "Anatomy — Forearm Muscles",
    folder: "Medicine",
    emoji: "💪",
    description: "Origin, insertion, innervation.",
    lastStudied: "a week ago",
    progress: 15,
    isPublic: false,
    createdAt: "2026-04-05T08:00:00Z",
    cards: [
      {
        id: "m1",
        question: "Which nerve innervates the flexor carpi radialis?",
        answer: "The median nerve (C6–C7).",
        aiGenerated: true,
        mastery: "new",
      },
      {
        id: "m2",
        question: "Origin and insertion of the brachioradialis?",
        answer:
          "Origin: lateral supracondylar ridge of the humerus. Insertion: styloid process of the radius. Function: elbow flexion.",
        aiGenerated: true,
        mastery: "new",
      },
    ],
  },
  {
    id: "pharma-basics",
    name: "Pharmacology · Fundamentals",
    folder: "Medicine",
    emoji: "💊",
    description: "Receptors, pharmacokinetics, dose-response.",
    lastStudied: "4 days ago",
    progress: 55,
    isPublic: false,
    createdAt: "2026-04-12T16:00:00Z",
    cards: [
      {
        id: "p1",
        question: "What is bioavailability?",
        answer:
          "The fraction of an administered dose that reaches the systemic circulation unchanged. IV = 100%, oral is often lower (first-pass effect).",
        aiGenerated: true,
        mastery: "learning",
      },
    ],
  },
  {
    id: "french-b1",
    name: "French · Subjunctive",
    folder: "Languages",
    emoji: "🇫🇷",
    description: "Subjonctif présent — formation & triggers.",
    lastStudied: "2 weeks ago",
    progress: 8,
    isPublic: false,
    createdAt: "2026-04-01T12:00:00Z",
    cards: [
      {
        id: "f1",
        question: "How is the subjonctif présent formed for regular verbs?",
        answer:
          "Take the 3rd-person plural indicative stem + endings: -e, -es, -e, -ions, -iez, -ent. E.g. parler → ils parl‿ent → que je parle.",
        aiGenerated: false,
        mastery: "new",
      },
    ],
  },
  {
    id: "philo-kant",
    name: "Philosophy · Kant",
    folder: "University",
    emoji: "🧠",
    description: "Critique of Pure Reason, Categorical Imperative.",
    lastStudied: "today",
    progress: 77,
    isPublic: true,
    createdAt: "2026-04-17T20:00:00Z",
    cards: [
      {
        id: "ph1",
        question: "State the Categorical Imperative (universal formula).",
        answer:
          "“Act only according to that maxim whereby you can, at the same time, will that it should become a universal law.”",
        aiGenerated: false,
        mastery: "known",
      },
    ],
  },
];

export const stats = {
  streak: 12,
  cardsDueToday: 23,
  cardsLearnedThisWeek: 147,
  totalCards: collections.reduce((sum, c) => sum + c.cards.length, 0),
  totalCollections: collections.length,
};

export const recentActivity = [
  { label: "Studied 5 cards", collection: "Biochemistry — Enzyme Kinetics", time: "2 hours ago" },
  { label: "Generated 8 cards", collection: "Philosophy · Kant", time: "this morning" },
  { label: "PDF uploaded", collection: "Biochemistry — Enzyme Kinetics", time: "yesterday" },
  { label: "Collection created", collection: "French · Subjunctive", time: "2 weeks ago" },
];

// ─────────────────────────────────────────────────────────────
// Suggested collections — hand-curated catalog keyed by learner type.
// Replace with backend recommendations once the Go API lands.
// ─────────────────────────────────────────────────────────────

export type Suggestion = {
  id: string;
  learnerTypes: LearnerType[];
  emoji: string;
  title: string;
  description: string;
  folder: string;
  folderEmoji: string;
};

export const suggestions: Suggestion[] = [
  // ── Certifications ──────────────────────────────────────────
  {
    id: "cert-aws-cp",
    learnerTypes: ["certifications"],
    emoji: "☁️",
    title: "AWS Cloud Practitioner",
    description: "Foundational concepts for the CLF-C02 exam — services, pricing, security.",
    folder: "Certifications",
    folderEmoji: "📜",
  },
  {
    id: "cert-cfa-1-ethics",
    learnerTypes: ["certifications"],
    emoji: "📈",
    title: "CFA Level I — Ethics",
    description: "Code of Ethics and Standards of Professional Conduct.",
    folder: "Certifications",
    folderEmoji: "📜",
  },
  {
    id: "cert-pmp",
    learnerTypes: ["certifications"],
    emoji: "📋",
    title: "PMP Process Groups",
    description: "Initiating, planning, executing, monitoring, and closing.",
    folder: "Certifications",
    folderEmoji: "📜",
  },
  {
    id: "cert-ielts",
    learnerTypes: ["certifications"],
    emoji: "🗣️",
    title: "IELTS — Academic Vocabulary",
    description: "Band 7+ words for academic writing and speaking.",
    folder: "Certifications",
    folderEmoji: "📜",
  },

  // ── University ──────────────────────────────────────────────
  {
    id: "uni-linear-algebra",
    learnerTypes: ["university"],
    emoji: "🧮",
    title: "Linear Algebra Essentials",
    description: "Vectors, matrices, eigenvalues — the must-knows.",
    folder: "University",
    folderEmoji: "🎓",
  },
  {
    id: "uni-orgchem-mechanisms",
    learnerTypes: ["university"],
    emoji: "⚗️",
    title: "Organic Chemistry — Mechanisms",
    description: "SN1, SN2, E1, E2 with worked examples.",
    folder: "University",
    folderEmoji: "🎓",
  },
  {
    id: "uni-macroecon",
    learnerTypes: ["university"],
    emoji: "📊",
    title: "Macroeconomics 101",
    description: "GDP, inflation, monetary vs fiscal policy.",
    folder: "University",
    folderEmoji: "🎓",
  },
  {
    id: "uni-data-structures",
    learnerTypes: ["university"],
    emoji: "🌳",
    title: "Data Structures Crash Course",
    description: "Arrays, hashmaps, trees, graphs — interview-ready.",
    folder: "University",
    folderEmoji: "🎓",
  },

  // ── School ──────────────────────────────────────────────────
  {
    id: "school-us-history",
    learnerTypes: ["school"],
    emoji: "🇺🇸",
    title: "US History — Key Dates",
    description: "From 1776 to today, the dates teachers love to ask about.",
    folder: "School",
    folderEmoji: "🏫",
  },
  {
    id: "school-spanish-100",
    learnerTypes: ["school"],
    emoji: "🇪🇸",
    title: "Spanish — First 100 Words",
    description: "The vocabulary that unlocks half of everyday Spanish.",
    folder: "School",
    folderEmoji: "🏫",
  },
  {
    id: "school-biology-cell",
    learnerTypes: ["school"],
    emoji: "🔬",
    title: "Biology — The Cell",
    description: "Organelles, membranes, mitosis vs meiosis.",
    folder: "School",
    folderEmoji: "🏫",
  },

  // ── Professional ────────────────────────────────────────────
  {
    id: "pro-design-patterns",
    learnerTypes: ["professional"],
    emoji: "🧩",
    title: "Software Design Patterns",
    description: "Singleton to Observer — when and why to reach for each.",
    folder: "Professional",
    folderEmoji: "💼",
  },
  {
    id: "pro-negotiation",
    learnerTypes: ["professional"],
    emoji: "🤝",
    title: "Negotiation Tactics",
    description: "BATNA, anchoring, and how to ask for the raise.",
    folder: "Professional",
    folderEmoji: "💼",
  },
  {
    id: "pro-sql-recipes",
    learnerTypes: ["professional"],
    emoji: "🗄️",
    title: "SQL Recipes",
    description: "Joins, window functions, CTEs that actually show up at work.",
    folder: "Professional",
    folderEmoji: "💼",
  },

  // ── Self-study ──────────────────────────────────────────────
  {
    id: "self-stoicism",
    learnerTypes: ["self-study"],
    emoji: "🏛️",
    title: "Stoic Philosophy",
    description: "Marcus Aurelius, Seneca, and the dichotomy of control.",
    folder: "Self-study",
    folderEmoji: "🌱",
  },
  {
    id: "self-japanese-hiragana",
    learnerTypes: ["self-study"],
    emoji: "🇯🇵",
    title: "Japanese — Hiragana",
    description: "All 46 characters in two weeks.",
    folder: "Self-study",
    folderEmoji: "🌱",
  },
  {
    id: "self-pottery-glaze",
    learnerTypes: ["self-study"],
    emoji: "🏺",
    title: "Pottery Glaze Chemistry",
    description: "Cone temperatures, oxide colorants, food-safe finishes.",
    folder: "Self-study",
    folderEmoji: "🌱",
  },

  // ── Other ───────────────────────────────────────────────────
  {
    id: "other-memory-palace",
    learnerTypes: ["other"],
    emoji: "🧠",
    title: "Memory Palace Method",
    description: "Build your first method-of-loci system.",
    folder: "Uncategorized",
    folderEmoji: "📁",
  },
];
