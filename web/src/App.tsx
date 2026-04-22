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
          <button className="btn-ghost">Log in</button>
        </nav>
      </header>

      <main className="app-main">
        <section className="hero fade-in">
          <span className="badge">
            <Sparkles size={12} strokeWidth={2} style={{ marginRight: 6 }} />
            AI-powered flashcards
          </span>
          <h1 className="text-display">
            Take notes like you always do.
            <br />
            <span style={{ color: "var(--color-accent)" }}>
              We'll build the flashcards.
            </span>
          </h1>
          <p className="text-body hero__sub">
            Upload your PDF, GoodNotes, or Notability file — flashr turns it
            into flashcards you can review and study.
          </p>
          <div className="hero__cta">
            <button className="btn-primary">
              Get started
              <ArrowRight size={16} strokeWidth={2} />
            </button>
            <button className="btn-ghost">Watch demo</button>
          </div>
        </section>

        <section id="features" className="features">
          <article className="card hover-lift">
            <Upload size={20} color="var(--color-accent)" strokeWidth={1.5} />
            <h3 className="text-h2" style={{ marginTop: 12 }}>
              PDF upload
            </h3>
            <p className="text-body">
              Drop in a note, we extract the text and generate cards for you.
            </p>
          </article>
          <article className="card hover-lift">
            <Sparkles size={20} color="var(--color-accent)" strokeWidth={1.5} />
            <h3 className="text-h2" style={{ marginTop: 12 }}>
              AI generation
            </h3>
            <p className="text-body">
              Self-hosted Ollama turns your text into question-and-answer pairs.
            </p>
          </article>
          <article className="card hover-lift">
            <BookOpen size={20} color="var(--color-accent)" strokeWidth={1.5} />
            <h3 className="text-h2" style={{ marginTop: 12 }}>
              Collections
            </h3>
            <p className="text-body">
              Organize cards into folders and study them in the built-in learn mode.
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
