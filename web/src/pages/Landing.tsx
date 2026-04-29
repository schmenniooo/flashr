import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { FileUp, Sparkles, GraduationCap, ArrowRight, Upload, Brain, BookOpen } from "lucide-react";
import { Wordmark } from "../lib/logo";
import "./Landing.css";

export function Landing() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="landing">
      <nav className={`landing-nav${scrolled ? " landing-nav--scrolled" : ""}`}>
        <div className="landing-nav-inner">
          <Link to="/" className="landing-nav-logo">
            <Wordmark size={22} />
          </Link>
          <div className="landing-nav-actions">
            <Link to="/login" className="landing-btn-ghost landing-nav-login">Log in</Link>
            <Link to="/login" className="landing-btn-primary">Get started</Link>
          </div>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="landing-hero-inner">
          <div className="landing-hero-text">
            <div className="landing-badge">AI-Powered Flashcards</div>
            <h1 className="landing-headline">
              <span className="landing-headline-line1">Your notes.</span>
              <span className="landing-headline-line2">
                Flashcards,{" "}
                <span className="landing-shimmer">automatically.</span>
              </span>
            </h1>
            <p className="landing-subheadline">
              Drop a PDF or connect your notes. flashr generates flashcards with AI — so you can focus on learning, not formatting.
            </p>
            <div className="landing-hero-ctas">
              <Link to="/login" className="landing-btn-primary landing-btn-large">
                Start for free <ArrowRight size={16} strokeWidth={2} />
              </Link>
              <a href="#how-it-works" className="landing-btn-ghost landing-btn-large">
                See how it works
              </a>
            </div>
          </div>

          <div className="landing-hero-card-wrap">
            <div className="landing-mock-glow" aria-hidden="true" />
            <div className="landing-mock-card">
              <div className="landing-mock-badge">
                <Sparkles size={10} strokeWidth={2} />
                AI generated
              </div>
              <div className="landing-mock-label">Question</div>
              <p className="landing-mock-question">
                What is spaced repetition and why does it improve long-term retention?
              </p>
              <div className="landing-mock-divider" />
              <div className="landing-mock-label">Answer</div>
              <p className="landing-mock-answer">
                A study technique that increases intervals between reviews as confidence grows — exploiting the spacing effect to move knowledge into long-term memory.
              </p>
              <div className="landing-mock-footer">
                <span className="landing-mock-tag">Cognitive Science</span>
                <span className="landing-mock-tag">Memory</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-features">
        <div className="landing-section-inner">
          <div className="landing-features-grid">
            <div className="landing-feature-card">
              <div className="landing-feature-icon">
                <FileUp size={22} strokeWidth={1.5} />
              </div>
              <h3 className="landing-feature-title">Upload & Parse</h3>
              <p className="landing-feature-desc">
                Upload PDFs, GoodNotes exports, or plain text. We handle the rest.
              </p>
            </div>
            <div className="landing-feature-card">
              <div className="landing-feature-icon landing-feature-icon--accent">
                <Sparkles size={22} strokeWidth={1.5} />
              </div>
              <h3 className="landing-feature-title">AI-Generated Cards</h3>
              <p className="landing-feature-desc">
                Our AI reads your notes and creates accurate, concise flashcards automatically.
              </p>
            </div>
            <div className="landing-feature-card">
              <div className="landing-feature-icon">
                <GraduationCap size={22} strokeWidth={1.5} />
              </div>
              <h3 className="landing-feature-title">Study Anywhere</h3>
              <p className="landing-feature-desc">
                Spaced repetition built in. Study on desktop or mobile — your cards sync everywhere.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-how" id="how-it-works">
        <div className="landing-section-inner">
          <p className="landing-section-label">How it works</p>
          <h2 className="landing-section-title">Three steps to smarter studying</h2>
          <div className="landing-steps">
            <div className="landing-step">
              <div className="landing-step-num">1</div>
              <div className="landing-step-icon">
                <Upload size={20} strokeWidth={1.5} />
              </div>
              <h4 className="landing-step-title">Upload your notes</h4>
              <p className="landing-step-desc">
                Drag in a PDF, export from GoodNotes, or paste raw text — any format works.
              </p>
            </div>
            <div className="landing-step">
              <div className="landing-step-num">2</div>
              <div className="landing-step-icon landing-step-icon--accent">
                <Brain size={20} strokeWidth={1.5} />
              </div>
              <h4 className="landing-step-title">AI generates cards</h4>
              <p className="landing-step-desc">
                flashr reads your content and creates a full deck of flashcards in seconds.
              </p>
            </div>
            <div className="landing-step">
              <div className="landing-step-num">3</div>
              <div className="landing-step-icon">
                <BookOpen size={20} strokeWidth={1.5} />
              </div>
              <h4 className="landing-step-title">Start studying</h4>
              <p className="landing-step-desc">
                Review your deck with spaced repetition — flashr keeps track of what you need most.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-cta">
        <div className="landing-cta-glow" aria-hidden="true" />
        <div className="landing-section-inner landing-section-inner--narrow">
          <h2 className="landing-cta-title">Ready to learn smarter?</h2>
          <Link to="/login" className="landing-btn-primary landing-btn-large">
            Get started free
          </Link>
          <p className="landing-cta-caption">No credit card required</p>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <Wordmark size={18} />
          <p className="landing-footer-copy">© 2026 flashr. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
