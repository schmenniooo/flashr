import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import "./Legal.css";

export function TermsOfService() {
  return (
    <div className="legal">
      <nav className="legal-nav">
        <div className="legal-nav-inner">
          <Link to="/" className="legal-nav-back">
            <ArrowLeft size={16} />
            Back to flashr
          </Link>
        </div>
      </nav>

      <main className="legal-content">
        <h1 className="legal-title">Terms of Service</h1>
        <p className="legal-meta">Effective date: May 8, 2026</p>

        <section className="legal-section">
          <h2>1. Acceptance of Terms</h2>
          <p>
            By creating an account or using flashr ("the Service"), you agree to these Terms of
            Service ("Terms"). If you do not agree, do not use the Service. These Terms form a
            binding agreement between you and Ennio Schmidt, the operator of flashr ("we", "us",
            or "flashr").
          </p>
          <p>
            We may update these Terms from time to time. Continued use of the Service after changes
            are posted constitutes acceptance of the updated Terms. We will notify you of material
            changes by email or an in-app notice.
          </p>
        </section>

        <hr className="legal-divider" />

        <section className="legal-section">
          <h2>2. Description of the Service</h2>
          <p>
            flashr is an AI-powered flashcard application that allows you to create, organize, and
            study flashcards. You can generate flashcards automatically from uploaded documents
            (PDFs, notes) using our locally-hosted AI model. The Service is available as a free
            tier and a paid Pro subscription.
          </p>
        </section>

        <hr className="legal-divider" />

        <section className="legal-section">
          <h2>3. Accounts</h2>
          <p>
            You must provide accurate and complete information when creating your account. You are
            responsible for maintaining the security of your account credentials and for all
            activity that occurs under your account. Notify us immediately at{" "}
            <a href="mailto:ennio.nick@gmail.com">ennio.nick@gmail.com</a> if you suspect
            unauthorized access.
          </p>
          <p>
            You must be at least 16 years old to use the Service. By using flashr, you represent
            that you meet this requirement.
          </p>
        </section>

        <hr className="legal-divider" />

        <section className="legal-section">
          <h2>4. Subscriptions and Billing</h2>

          <h3>4.1 Free and Pro Plans</h3>
          <p>
            flashr offers a free tier with limited features and a Pro subscription at
            €7.99/month. The features included in each plan are described on our pricing page.
            We will give you at least 30 days' notice by email before any price increase takes
            effect, giving you the opportunity to cancel before the new price applies.
          </p>

          <h3>4.2 Recurring Billing</h3>
          <p>
            By subscribing to Pro, you authorize us to charge your payment method €7.99 per
            month, automatically renewing until you cancel. Payments are processed by{" "}
            <strong>Stripe, Inc.</strong> — we never store your card details.
          </p>

          <h3>4.3 Cancellation</h3>
          <p>
            You may cancel your subscription at any time from your profile. Your Pro access
            remains active until the end of the current billing period. No further charges
            will be made after cancellation.
          </p>

          <h3>4.4 Refund Policy</h3>
          <p>
            If you are an EU consumer, you have a statutory 14-day right of withdrawal for
            digital services from the date of purchase, unless the service has already been
            fully performed with your prior express consent. After 14 days, subscription
            payments are non-refundable but you may cancel to prevent future charges.
          </p>
          <p>
            To request a refund within the withdrawal period, contact us at{" "}
            <a href="mailto:ennio.nick@gmail.com">ennio.nick@gmail.com</a>.
          </p>

          <h3>4.5 Taxes</h3>
          <p>
            Prices are listed exclusive of applicable taxes. Depending on your location,
            VAT or other taxes may be added at checkout.
          </p>
        </section>

        <hr className="legal-divider" />

        <section className="legal-section">
          <h2>5. Your Content</h2>
          <p>
            You retain full ownership of the content you upload or create in flashr — your
            notes, flashcards, and collections belong to you. By using the Service, you grant
            us a limited, non-exclusive license to store and process your content solely to
            provide the Service to you.
          </p>
          <p>
            You are responsible for ensuring you have the rights to any content you upload.
            Do not upload content that infringes third-party copyrights or violates applicable law.
          </p>
        </section>

        <hr className="legal-divider" />

        <section className="legal-section">
          <h2>6. AI-Generated Content</h2>
          <p>
            flashr uses a locally-hosted AI model to generate flashcard drafts from your uploaded
            documents. AI-generated content may be inaccurate, incomplete, or contain errors.
          </p>
          <ul>
            <li>
              You are responsible for reviewing and verifying all AI-generated flashcards before
              relying on them for study or other purposes.
            </li>
            <li>
              flashr is not liable for the accuracy of AI-generated content. Use at your own risk.
            </li>
            <li>
              For educational or professional use, always verify generated content against
              authoritative sources.
            </li>
            <li>
              Your uploaded documents are processed in memory to generate flashcards and are not
              permanently stored or used to train AI models.
            </li>
          </ul>
        </section>

        <hr className="legal-divider" />

        <section className="legal-section">
          <h2>7. Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Use the Service for any unlawful purpose or in violation of applicable law</li>
            <li>Upload content that is defamatory, obscene, or infringes third-party rights</li>
            <li>Attempt to gain unauthorized access to the Service or other users' accounts</li>
            <li>Reverse engineer, scrape, or copy the Service or its underlying technology</li>
            <li>Use the Service to generate spam, misinformation, or harmful content</li>
          </ul>
          <p>
            We reserve the right to suspend or terminate accounts that violate these rules, with
            or without prior notice depending on the severity of the violation.
          </p>
        </section>

        <hr className="legal-divider" />

        <section className="legal-section">
          <h2>8. Limitation of Liability</h2>
          <p>
            To the fullest extent permitted by applicable law, flashr and its operator are not
            liable for indirect, incidental, special, or consequential damages arising from your
            use of the Service, including but not limited to loss of data, loss of revenue, or
            reliance on AI-generated content.
          </p>
          <p>
            Our total liability to you for any claim arising out of or related to these Terms or
            the Service shall not exceed the fees you paid to us in the three months preceding
            the claim.
          </p>
          <p>
            Nothing in these Terms limits liability for fraud, gross negligence, or any other
            liability that cannot be excluded under applicable law (including mandatory EU consumer
            protection rights).
          </p>
        </section>

        <hr className="legal-divider" />

        <section className="legal-section">
          <h2>9. Disclaimer of Warranties</h2>
          <p>
            The Service is provided "as is" and "as available" without warranties of any kind,
            express or implied, including but not limited to fitness for a particular purpose,
            accuracy, or uninterrupted availability. We do not guarantee that the Service will
            be error-free or that defects will be corrected.
          </p>
        </section>

        <hr className="legal-divider" />

        <section className="legal-section">
          <h2>10. Termination</h2>
          <p>
            You may delete your account at any time from your profile page. We may suspend or
            terminate your access if you violate these Terms or for operational reasons, with
            reasonable notice where possible.
          </p>
          <p>
            Upon termination, your data will be deleted in accordance with our{" "}
            <Link to="/privacy">Privacy Policy</Link>.
          </p>
        </section>

        <hr className="legal-divider" />

        <section className="legal-section">
          <h2>11. Governing Law and Dispute Resolution</h2>
          <p>
            These Terms are governed by the laws of Germany. For consumers in the EU, mandatory
            consumer protection laws of your country of residence also apply and cannot be
            overridden by this clause.
          </p>
          <p>
            We encourage you to contact us first at{" "}
            <a href="mailto:ennio.nick@gmail.com">ennio.nick@gmail.com</a> for any dispute.
            The European Commission's Online Dispute Resolution platform is available at{" "}
            <a
              href="https://ec.europa.eu/consumers/odr"
              target="_blank"
              rel="noopener noreferrer"
            >
              ec.europa.eu/consumers/odr
            </a>
            . We are not obligated to participate in alternative dispute resolution procedures but
            will make good-faith efforts to resolve issues directly.
          </p>
        </section>

        <hr className="legal-divider" />

        <section className="legal-section">
          <h2>12. Intellectual Property</h2>
          <p>
            The flashr name, logo, brand, and software are owned by Ennio Schmidt and are
            protected by applicable intellectual property laws. Nothing in these Terms grants
            you any right to use our trademarks, brand, or proprietary technology beyond what
            is necessary to use the Service as intended.
          </p>
        </section>

        <hr className="legal-divider" />

        <section className="legal-section">
          <h2>13. Severability</h2>
          <p>
            If any provision of these Terms is found to be unenforceable or invalid under
            applicable law, that provision will be limited or removed to the minimum extent
            necessary, and the remaining provisions will continue in full force and effect.
          </p>
        </section>

        <hr className="legal-divider" />

        <section className="legal-section">
          <h2>14. Language</h2>
          <p>
            These Terms are provided in English. Where required by applicable law, a German
            translation may be made available. In case of conflict between language versions,
            the German version shall prevail for users located in Germany or Austria.
          </p>
        </section>

        <hr className="legal-divider" />

        <section className="legal-section">
          <h2>15. Contact</h2>
          <p>
            Questions about these Terms? Reach us at{" "}
            <a href="mailto:ennio.nick@gmail.com">ennio.nick@gmail.com</a>.
          </p>
          <p>
            Operator: Ennio Schmidt, Deutschland. Full contact details in the{" "}
            <Link to="/imprint">Imprint</Link>.
          </p>
        </section>
      </main>

      <footer className="legal-footer">
        <p>© {new Date().getFullYear()} flashr</p>
      </footer>
    </div>
  );
}
