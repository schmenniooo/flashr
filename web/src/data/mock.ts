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
