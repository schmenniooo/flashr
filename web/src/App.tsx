import { Sparkles, Upload, BookOpen, ArrowRight } from "lucide-react";
import { Wordmark } from "./lib/logo";
import "./App.css";

function App() {
  return (
    <div className="app-shell">
      <header className="app-nav">
        <Wordmark size={22} />
        <nav className="app-nav__links">
          <a href="#features">Features</a>
          <a href="#roadmap">Roadmap</a>
          <button className="btn-ghost">Login</button>
        </nav>
      </header>

      <main className="app-main">
        <section className="hero fade-in">
          <span className="badge">
            <Sparkles size={12} strokeWidth={2} style={{ marginRight: 6 }} />
            AI-powered flashcards
          </span>
          <h1 className="text-display">
            Mach deine Notizen wie immer.
            <br />
            <span style={{ color: "var(--color-accent)" }}>
              Wir bauen die Karteikarten.
            </span>
          </h1>
          <p className="text-body hero__sub">
            Lad dein PDF, deine GoodNotes- oder Notability-Datei hoch —
            flashr generiert daraus automatisch Karteikarten, die du
            überprüfen und lernen kannst.
          </p>
          <div className="hero__cta">
            <button className="btn-primary">
              Jetzt starten
              <ArrowRight size={16} strokeWidth={2} />
            </button>
            <button className="btn-ghost">Demo ansehen</button>
          </div>
        </section>

        <section id="features" className="features">
          <article className="card hover-lift">
            <Upload size={20} color="var(--color-accent)" strokeWidth={1.5} />
            <h3 className="text-h2" style={{ marginTop: 12 }}>
              PDF-Upload
            </h3>
            <p className="text-body">
              Notiz hochladen, Text wird extrahiert, Karten werden generiert.
            </p>
          </article>
          <article className="card hover-lift">
            <Sparkles size={20} color="var(--color-accent)" strokeWidth={1.5} />
            <h3 className="text-h2" style={{ marginTop: 12 }}>
              KI-Generierung
            </h3>
            <p className="text-body">
              Self-hosted Ollama erstellt Frage-Antwort-Paare aus deinen Texten.
            </p>
          </article>
          <article className="card hover-lift">
            <BookOpen size={20} color="var(--color-accent)" strokeWidth={1.5} />
            <h3 className="text-h2" style={{ marginTop: 12 }}>
              Collections
            </h3>
            <p className="text-body">
              Organisiere Karteikarten in Ordnern und lerne im Basis-Lernmodus.
            </p>
          </article>
        </section>
      </main>

      <footer className="app-footer">
        <span className="text-meta">flashr · SmithLabs · v0.0.1</span>
      </footer>
    </div>
  );
}

export default App;
