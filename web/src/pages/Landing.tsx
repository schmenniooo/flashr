import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FileUp, Sparkles, GraduationCap, ArrowRight, Check, X } from "lucide-react";
import { Wordmark } from "../lib/logo";
import "./Landing.css";

export function Landing() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const els = document.querySelectorAll("[data-animate]");
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.12 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="landing">
      <nav className={`landing-nav${scrolled ? " landing-nav--scrolled" : ""}`}>
        <div className="landing-nav-inner">
          <Link to="/" className="landing-nav-logo">
            <Wordmark size={22} />
          </Link>
          <div className="landing-nav-links">
            <a href="#features" className="landing-nav-link">Features</a>
            <a href="#how-it-works" className="landing-nav-link">How it works</a>
            <a href="#pricing" className="landing-nav-link">Pricing</a>
          </div>
          <div className="landing-nav-actions">
            <Link to="/login" className="landing-nav-login-btn">Log in</Link>
            <Link to="/signup" className="landing-btn-primary landing-nav-cta">Get started</Link>
          </div>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="landing-hero-inner">
          <div className="landing-hero-text">
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
              <Link to="/signup" className="landing-btn-primary landing-btn-large">
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

      <section className="landing-features" id="features">
        <div className="landing-section-inner">
          <div className="landing-features-header" data-animate>
            <p className="landing-section-label">Features</p>
            <h2 className="landing-section-title">From notes to cards in seconds</h2>
          </div>
          <div className="landing-features-grid">
            <div className="landing-feature-card" data-animate>
              <div className="landing-feature-icon">
                <FileUp size={22} strokeWidth={1.5} />
              </div>
              <h3 className="landing-feature-title">Upload & Parse</h3>
              <p className="landing-feature-desc">
                Upload PDFs, GoodNotes exports, or plain text. We handle the rest.
              </p>
            </div>
            <div className="landing-feature-card" data-animate>
              <div className="landing-feature-icon landing-feature-icon--accent">
                <Sparkles size={22} strokeWidth={1.5} />
              </div>
              <h3 className="landing-feature-title">AI-Generated Cards</h3>
              <p className="landing-feature-desc">
                Our AI reads your notes and creates accurate, concise flashcards automatically.
              </p>
            </div>
            <div className="landing-feature-card" data-animate>
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
          <p className="landing-section-label" data-animate>How it works</p>
          <h2 className="landing-section-title" data-animate>Up and running in under a minute</h2>
          <div className="landing-steps">
            <div className="landing-step" data-animate>
              <span className="landing-step-num">01</span>
              <h4 className="landing-step-title">Upload your notes</h4>
              <p className="landing-step-desc">
                Drag in a PDF, export from GoodNotes, or paste raw text — any format works.
              </p>
            </div>
            <div className="landing-step" data-animate>
              <span className="landing-step-num">02</span>
              <h4 className="landing-step-title">AI generates cards</h4>
              <p className="landing-step-desc">
                flashr reads your content and creates a full deck of flashcards in seconds.
              </p>
            </div>
            <div className="landing-step" data-animate>
              <span className="landing-step-num">03</span>
              <h4 className="landing-step-title">Start studying</h4>
              <p className="landing-step-desc">
                Review your deck with spaced repetition — flashr keeps track of what you need most.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-pricing" id="pricing">
        <div className="landing-section-inner">
          <p className="landing-section-label" data-animate>Pricing</p>
          <h2 className="landing-section-title landing-pricing-title" data-animate>Simple, honest pricing</h2>
          <div className="landing-pricing-grid">

            <div className="landing-plan" data-animate>
              <div className="landing-plan-header">
                <h3 className="landing-plan-name">Free</h3>
                <div className="landing-plan-price">
                  <span className="landing-plan-amount">€0</span>
                  <span className="landing-plan-period">forever</span>
                </div>
                <p className="landing-plan-desc">Get started and build your first decks manually.</p>
              </div>
              <Link to="/signup" className="landing-btn-ghost landing-plan-cta">Get started free</Link>
              <ul className="landing-plan-features">
                <li><Check size={14} strokeWidth={2} className="landing-feat-yes" /> 3 collections</li>
                <li><Check size={14} strokeWidth={2} className="landing-feat-yes" /> 50 cards per collection</li>
                <li><Check size={14} strokeWidth={2} className="landing-feat-yes" /> Cloud sync</li>
                <li><X size={14} strokeWidth={2} className="landing-feat-no" /> AI card generation</li>
                <li><X size={14} strokeWidth={2} className="landing-feat-no" /> PDF upload</li>
                <li><X size={14} strokeWidth={2} className="landing-feat-no" /> App integrations</li>
              </ul>
            </div>

            <div className="landing-plan landing-plan--pro" data-animate>
              <div className="landing-plan-badge">Includes AI</div>
              <div className="landing-plan-header">
                <h3 className="landing-plan-name">Pro</h3>
                <div className="landing-plan-price">
                  <span className="landing-plan-amount">€7.99</span>
                  <span className="landing-plan-period">/ month</span>
                </div>
                <p className="landing-plan-desc">Everything you need to study smarter with AI.</p>
              </div>
              <button
                className="landing-btn-primary landing-plan-cta"
                onClick={() => {
                  sessionStorage.setItem("checkout_intent", "pro");
                  navigate("/signup");
                }}
              >
                Get Pro →
              </button>
              <ul className="landing-plan-features">
                <li><Check size={14} strokeWidth={2} className="landing-feat-yes" /> Unlimited collections</li>
                <li><Check size={14} strokeWidth={2} className="landing-feat-yes" /> Unlimited cards</li>
                <li><Check size={14} strokeWidth={2} className="landing-feat-yes" /> Cloud sync</li>
                <li><Check size={14} strokeWidth={2} className="landing-feat-yes" /> AI card generation</li>
                <li><Check size={14} strokeWidth={2} className="landing-feat-yes" /> PDF upload</li>
                <li><Check size={14} strokeWidth={2} className="landing-feat-yes" /> App integrations</li>
              </ul>
            </div>

          </div>
        </div>
      </section>

      <section className="landing-faq" id="faq">
        <div className="landing-section-inner landing-section-inner--narrow">
          <p className="landing-section-label" data-animate>FAQ</p>
          <h2 className="landing-section-title" data-animate>Common questions</h2>
          <div className="landing-faq-list" data-animate>

            <details className="landing-faq-item">
              <summary className="landing-faq-q">Is flashr really free?</summary>
              <p className="landing-faq-a">Yes. The Free plan is free forever — no trial, no expiry. You get 3 collections and 50 cards each. Upgrade to Pro for €7.99/month when you need AI generation and unlimited cards.</p>
            </details>

            <details className="landing-faq-item">
              <summary className="landing-faq-q">Can I cancel my Pro subscription at any time?</summary>
              <p className="landing-faq-a">Yes, cancel anytime from your profile with one click. You keep Pro access until the end of the billing period — no questions asked, no lock-in.</p>
            </details>

            <details className="landing-faq-item">
              <summary className="landing-faq-q">What file formats are supported?</summary>
              <p className="landing-faq-a">Currently PDF, GoodNotes exports, and plain text. Support for Notability, Word (.docx), and image-based notes (via OCR) is on the roadmap.</p>
            </details>

            <details className="landing-faq-item">
              <summary className="landing-faq-q">How good are the AI-generated cards?</summary>
              <p className="landing-faq-a">Good enough to save you real time — but you always review before saving. You can edit, rewrite, or discard any card before it hits your deck. The AI handles the first draft; you stay in control.</p>
            </details>

            <details className="landing-faq-item">
              <summary className="landing-faq-q">Do you store my uploaded notes and PDFs?</summary>
              <p className="landing-faq-a">No. Uploaded files are processed in memory and deleted immediately after your flashcards are generated. Only the cards you choose to save are stored — your original notes never sit on our servers.</p>
            </details>

            <details className="landing-faq-item">
              <summary className="landing-faq-q">Does flashr share or sell my data?</summary>
              <p className="landing-faq-a">Never. flashr earns money through subscriptions only. Your notes and cards are never shared with third parties, advertisers, or used to train AI models.</p>
            </details>

          </div>
        </div>
      </section>

      <section className="landing-cta">
        <div className="landing-cta-glow" aria-hidden="true" />
        <div className="landing-section-inner landing-section-inner--narrow" data-animate>
          <h2 className="landing-cta-title">Stop copying notes.<br />Start retaining them.</h2>
          <Link to="/signup" className="landing-btn-primary landing-btn-large">
            Get started free
          </Link>
          <p className="landing-cta-caption">Free plan available — no card required</p>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <Wordmark size={18} />
          <nav className="landing-footer-nav">
            <a href="#features" className="landing-footer-link">Features</a>
            <a href="#how-it-works" className="landing-footer-link">How it works</a>
            <a href="#pricing" className="landing-footer-link">Pricing</a>
            <a href="#faq" className="landing-footer-link">FAQ</a>
            <Link to="/login" className="landing-footer-link">Log in</Link>
          </nav>
          <div className="landing-footer-social">
            <a
              href="https://www.linkedin.com/company/115812262"
              target="_blank"
              rel="noopener noreferrer"
              className="landing-footer-social-link"
              aria-label="flashr on LinkedIn"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true">
                <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
                <rect x="2" y="9" width="4" height="12"/>
                <circle cx="4" cy="4" r="2"/>
              </svg>
            </a>
            <a
              href="https://www.instagram.com/flashr.io/"
              target="_blank"
              rel="noopener noreferrer"
              className="landing-footer-social-link"
              aria-label="flashr on Instagram"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" aria-hidden="true">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
              </svg>
            </a>
          </div>
        </div>
        <div className="landing-footer-sub">
          <p className="landing-footer-copy">© {new Date().getFullYear()} flashr</p>
          <nav className="landing-footer-legal">
            <Link to="/imprint" className="landing-footer-link">Imprint</Link>
            <Link to="/privacy" className="landing-footer-link">Privacy Policy</Link>
            <Link to="/terms" className="landing-footer-link">Terms</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
