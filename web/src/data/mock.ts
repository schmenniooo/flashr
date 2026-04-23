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
  { name: "Medizin", emoji: "🧬", count: 3 },
  { name: "Sprachen", emoji: "🗣️", count: 2 },
  { name: "Zertifikate", emoji: "📜", count: 1 },
  { name: "Uni", emoji: "🎓", count: 2 },
];

export const collections: Collection[] = [
  {
    id: "biochem-7",
    name: "Biochemie — Enzymkinetik",
    folder: "Medizin",
    emoji: "🧬",
    description: "Vorlesung 7, Michaelis-Menten & Inhibitoren.",
    lastStudied: "vor 2 Stunden",
    progress: 68,
    isPublic: false,
    cards: [
      {
        id: "c1",
        question: "Was beschreibt die Michaelis-Konstante (Kₘ)?",
        answer:
          "Die Substratkonzentration, bei der die Reaktionsgeschwindigkeit die Hälfte der Maximalgeschwindigkeit (½ Vₘₐₓ) erreicht. Sie ist ein Maß für die Affinität des Enzyms zum Substrat — kleines Kₘ bedeutet hohe Affinität.",
        aiGenerated: true,
        mastery: "known",
      },
      {
        id: "c2",
        question: "Wie wirkt ein kompetitiver Inhibitor auf Kₘ und Vₘₐₓ?",
        answer:
          "Kₘ steigt (scheinbar), Vₘₐₓ bleibt gleich. Der Inhibitor konkurriert mit dem Substrat um das aktive Zentrum — durch höhere Substratkonzentration kann er verdrängt werden.",
        aiGenerated: true,
        mastery: "learning",
      },
      {
        id: "c3",
        question: "Was ist die Lineweaver-Burk-Linearisierung?",
        answer:
          "Die doppelt-reziproke Auftragung 1/v gegen 1/[S]. Sie linearisiert die Michaelis-Menten-Gleichung — der Schnittpunkt mit der y-Achse ist 1/Vₘₐₓ, mit der x-Achse -1/Kₘ.",
        aiGenerated: false,
        mastery: "new",
      },
      {
        id: "c4",
        question: "Nenne drei Typen reversibler Enzyminhibition.",
        answer:
          "Kompetitiv (Substratähnlich, am aktiven Zentrum), nicht-kompetitiv (an allosterischer Stelle, egal ob S gebunden ist) und unkompetitiv (bindet nur an den ES-Komplex).",
        aiGenerated: true,
        mastery: "learning",
      },
      {
        id: "c5",
        question: "Wofür steht der katalytische Koeffizient kcat?",
        answer:
          "Die Wechselzahl — Anzahl der Substratmoleküle, die ein einzelnes Enzymmolekül pro Zeiteinheit umsetzt, wenn es voll gesättigt ist. Einheit: s⁻¹.",
        aiGenerated: true,
        mastery: "new",
      },
    ],
  },
  {
    id: "spanisch-a2",
    name: "Spanisch Vokabeln · A2",
    folder: "Sprachen",
    emoji: "🇪🇸",
    description: "Alltags-Vokabeln, Verben & Redewendungen.",
    lastStudied: "gestern",
    progress: 42,
    isPublic: true,
    cards: [
      {
        id: "s1",
        question: "la biblioteca",
        answer: "die Bibliothek",
        aiGenerated: false,
        mastery: "known",
      },
      {
        id: "s2",
        question: "acostumbrarse a",
        answer: "sich gewöhnen an",
        aiGenerated: false,
        mastery: "learning",
      },
      {
        id: "s3",
        question: "a menudo",
        answer: "oft, häufig",
        aiGenerated: false,
        mastery: "new",
      },
      {
        id: "s4",
        question: "quedarse",
        answer: "bleiben, übrig bleiben",
        aiGenerated: false,
        mastery: "known",
      },
    ],
  },
  {
    id: "aws-cp",
    name: "AWS Cloud Practitioner",
    folder: "Zertifikate",
    emoji: "☁️",
    description: "Prüfungsvorbereitung CLF-C02.",
    lastStudied: "vor 3 Tagen",
    progress: 91,
    isPublic: false,
    cards: [
      {
        id: "a1",
        question: "Welches AWS-Modell beschreibt die Shared Responsibility?",
        answer:
          "AWS ist für die Sicherheit *der* Cloud verantwortlich (Hardware, Netzwerk, Facility). Der Kunde ist für die Sicherheit *in* der Cloud verantwortlich (Daten, Configs, IAM, Patching).",
        aiGenerated: true,
        mastery: "known",
      },
      {
        id: "a2",
        question: "Was ist der Unterschied zwischen S3 Standard und S3 Glacier?",
        answer:
          "S3 Standard: häufiger Zugriff, Millisekunden-Latenz, teurer. Glacier: Archiv-Storage, Minuten bis Stunden Zugriffszeit, sehr günstig. Ideal für Compliance-Daten.",
        aiGenerated: true,
        mastery: "known",
      },
    ],
  },
  {
    id: "geschichte-abi",
    name: "Geschichte · Weimarer Republik",
    folder: "Uni",
    emoji: "📚",
    description: "Von 1918 bis zur Machtergreifung 1933.",
    lastStudied: "vor 5 Tagen",
    progress: 23,
    isPublic: false,
    cards: [
      {
        id: "g1",
        question: "Wann wurde die Weimarer Verfassung verabschiedet?",
        answer:
          "Am 11. August 1919. Sie trat am selben Tag in Kraft und etablierte die erste parlamentarische Demokratie auf deutschem Boden.",
        aiGenerated: true,
        mastery: "new",
      },
      {
        id: "g2",
        question: "Was war der Dawes-Plan (1924)?",
        answer:
          "Ein Zahlungsplan zur Regelung der deutschen Reparationen nach WWI. US-Kredite stabilisierten die deutsche Wirtschaft — führte zu den „Goldenen Zwanzigern“.",
        aiGenerated: true,
        mastery: "learning",
      },
      {
        id: "g3",
        question: "Nenne die drei Phasen der Weimarer Republik.",
        answer:
          "1. Krisenjahre (1918–1923): Revolution, Hyperinflation, Putschversuche. 2. Relative Stabilität (1924–1929): Stresemann, Dawes-Plan. 3. Auflösungsphase (1929–1933): Weltwirtschaftskrise, Präsidialkabinette.",
        aiGenerated: false,
        mastery: "new",
      },
    ],
  },
  {
    id: "anatomie-muskeln",
    name: "Anatomie — Muskeln des Unterarms",
    folder: "Medizin",
    emoji: "💪",
    description: "Ursprung, Ansatz, Innervation.",
    lastStudied: "vor einer Woche",
    progress: 15,
    isPublic: false,
    cards: [
      {
        id: "m1",
        question: "Welcher Nerv innerviert den M. flexor carpi radialis?",
        answer: "Der N. medianus (C6–C7).",
        aiGenerated: true,
        mastery: "new",
      },
      {
        id: "m2",
        question: "Ursprung und Ansatz des M. brachioradialis?",
        answer:
          "Ursprung: Crista supracondylaris lateralis humeri. Ansatz: Processus styloideus radii. Funktion: Flexion im Ellenbogen.",
        aiGenerated: true,
        mastery: "new",
      },
    ],
  },
  {
    id: "pharma-basics",
    name: "Pharmakologie · Grundlagen",
    folder: "Medizin",
    emoji: "💊",
    description: "Rezeptoren, Pharmakokinetik, Dosis-Wirkung.",
    lastStudied: "vor 4 Tagen",
    progress: 55,
    isPublic: false,
    cards: [
      {
        id: "p1",
        question: "Was ist die Bioverfügbarkeit?",
        answer:
          "Der Anteil einer verabreichten Dosis, der unverändert den systemischen Kreislauf erreicht. Intravenös = 100 %, oral oft niedriger (First-Pass-Effekt).",
        aiGenerated: true,
        mastery: "learning",
      },
    ],
  },
  {
    id: "franz-b1",
    name: "Französisch · Konjunktiv",
    folder: "Sprachen",
    emoji: "🇫🇷",
    description: "Subjonctif présent — Bildung & Auslöser.",
    lastStudied: "vor 2 Wochen",
    progress: 8,
    isPublic: false,
    cards: [
      {
        id: "f1",
        question: "Bildung des subjonctif présent für regelmäßige Verben?",
        answer:
          "Stamm der 3. Person Plural Indikativ + Endungen: -e, -es, -e, -ions, -iez, -ent. Bsp: parler → ils parl‿ent → que je parle.",
        aiGenerated: false,
        mastery: "new",
      },
    ],
  },
  {
    id: "philo",
    name: "Philosophie · Kant",
    folder: "Uni",
    emoji: "🧠",
    description: "Kritik der reinen Vernunft, Kategorischer Imperativ.",
    lastStudied: "heute",
    progress: 77,
    isPublic: true,
    cards: [
      {
        id: "ph1",
        question: "Formuliere den Kategorischen Imperativ (Grundformel).",
        answer:
          "„Handle nur nach derjenigen Maxime, durch die du zugleich wollen kannst, dass sie ein allgemeines Gesetz werde.“",
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
  { label: "5 Karten gelernt", collection: "Biochemie — Enzymkinetik", time: "vor 2 Stunden" },
  { label: "8 Karten generiert", collection: "Philosophie · Kant", time: "heute früh" },
  { label: "PDF hochgeladen", collection: "Biochemie — Enzymkinetik", time: "gestern" },
  { label: "Collection erstellt", collection: "Französisch · Konjunktiv", time: "vor 2 Wochen" },
];
