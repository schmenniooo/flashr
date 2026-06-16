import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import "./Legal.css";

export function PrivacyPolicy() {
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
        <h1 className="legal-title">Privacy Policy</h1>
        <p className="legal-meta">Last updated: June 16, 2026</p>

        <section className="legal-section">
          <h2>1. Controller</h2>
          <p>
            The controller responsible for processing personal data on this website within the
            meaning of the GDPR is:
          </p>
          <p>
            Ennio Schmidt<br />
            Welserstraße 3<br />
            87463 Dietmannsried<br />
            Germany<br />
            Email: <a href="mailto:support@flashr.io">support@flashr.io</a>
          </p>
        </section>

        <hr className="legal-divider" />

        <section className="legal-section">
          <h2>2. Data Collected and Purposes</h2>

          <h3>2.1 Account Data</h3>
          <p>When you register, we collect the following data:</p>
          <ul>
            <li>Email address</li>
            <li>Name (when registering via Google or GitHub OAuth)</li>
            <li>Profile picture (optional, from OAuth registration)</li>
            <li>Encrypted password (when registering with email)</li>
          </ul>
          <p>
            Legal basis: Art. 6(1)(b) GDPR (performance of a contract). This data is required
            to provide the service and authenticate you.
          </p>

          <h3>2.2 Usage Data and AI Processing</h3>
          <p>
            As part of using flashr, we store the content you create: flashcards, collections,
            folders, and documents you upload for AI-powered card generation.
          </p>
          <p>
            Uploaded documents are processed exclusively by an <strong>AI model hosted on our
            own infrastructure</strong> (Ollama, llama3.2). Your content is never sent to
            third-party AI services such as OpenAI or Anthropic. During processing, uploaded
            files are temporarily stored in a <strong>Railway Bucket</strong> (object storage
            provided by Railway Corp., San Francisco, USA) and are automatically deleted as
            soon as card generation is complete. Only the flashcards you explicitly save are
            retained in our database.
          </p>
          <p>
            Legal basis: Art. 6(1)(b) GDPR (performance of a contract).
          </p>

          <h3>2.3 Payment Data</h3>
          <p>
            Payments are processed by <strong>Stripe, Inc.</strong> flashr does not store full
            payment details (card numbers, etc.). Stripe processes payment data as an independent
            controller. For information on Stripe's privacy practices, see{" "}
            <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer">
              stripe.com/privacy
            </a>.
          </p>
          <p>
            We store the Stripe customer ID and subscription status to grant you access to paid
            features.
          </p>
          <p>
            Legal basis: Art. 6(1)(b) GDPR (performance of a contract).
          </p>

          <h3>2.4 Sign-in via Google OAuth</h3>
          <p>
            When you sign in with your Google account, we receive the following data from Google:
            email address, name, and profile picture. flashr uses this data solely for account
            creation and management.
          </p>
          <p>
            Google is an independent controller for OAuth data processing. See the{" "}
            <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
              Google Privacy Policy
            </a>{" "}
            for details.
          </p>
          <p>
            Legal basis: Art. 6(1)(b) GDPR (performance of a contract) in conjunction with your
            consent given to Google.
          </p>

          <h3>2.5 Sign-in via GitHub OAuth</h3>
          <p>
            When you sign in with your GitHub account, we receive the following data from GitHub:
            email address and name. flashr uses this data solely for account creation and
            management. We do not request access to your repositories or any other GitHub content.
          </p>
          <p>
            GitHub is an independent controller for OAuth data processing. See the{" "}
            <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement" target="_blank" rel="noopener noreferrer">
              GitHub Privacy Statement
            </a>{" "}
            for details.
          </p>
          <p>
            Legal basis: Art. 6(1)(b) GDPR (performance of a contract) in conjunction with your
            consent given to GitHub.
          </p>

          <h3>2.6 Product Analytics (PostHog)</h3>
          <p>
            We use <strong>PostHog</strong> to understand how users interact with flashr —
            for example, which features are used, how study sessions go, and where users drop
            off during onboarding. PostHog collects behavioural events (page views, clicks,
            feature usage) along with your account ID, email address, and subscription plan
            so that events can be linked to your account.
          </p>
          <p>
            PostHog is operated by PostHog Inc. and the data is stored on PostHog's{" "}
            <strong>EU-hosted infrastructure</strong> (eu.i.posthog.com). No data is
            transferred to the USA in connection with PostHog. For details, see the{" "}
            <a href="https://posthog.com/privacy" target="_blank" rel="noopener noreferrer">
              PostHog Privacy Policy
            </a>.
          </p>
          <p>
            Legal basis: Art. 6(1)(f) GDPR (legitimate interest in improving the service and
            understanding user behaviour). You may object to this processing at any time by
            contacting <a href="mailto:support@flashr.io">support@flashr.io</a>.
          </p>

          <h3>2.7 Server Logs</h3>
          <p>
            Every access to our servers automatically generates connection data (IP address,
            date/time, URL requested, HTTP status code, data transferred). This data is used
            solely to ensure operational stability and for error analysis, and is deleted after
            7 days.
          </p>
          <p>
            Legal basis: Art. 6(1)(f) GDPR (legitimate interest in the security and stability
            of the service).
          </p>
        </section>

        <hr className="legal-divider" />

        <section className="legal-section">
          <h2>3. Hosting and Infrastructure</h2>
          <p>
            flashr is hosted on <strong>Railway</strong> (Railway Corp., San Francisco, USA).
            This includes our application servers, database, and object storage (Railway Buckets),
            where uploaded files are held temporarily during AI processing. Data transfers to the
            USA are covered by the European Commission's Standard Contractual Clauses. For more
            information, see the{" "}
            <a href="https://railway.com/legal/privacy" target="_blank" rel="noopener noreferrer">
              Railway Privacy Policy
            </a>.
          </p>
        </section>

        <hr className="legal-divider" />

        <section className="legal-section">
          <h2>4. Retention Periods</h2>
          <p>
            Personal data is deleted once the purpose of processing no longer applies and no
            statutory retention obligations apply:
          </p>
          <ul>
            <li>Account data: until account deletion or upon request</li>
            <li>User content (cards, collections): until account deletion</li>
            <li>Uploaded files (PDFs): deleted immediately after AI card generation</li>
            <li>Payment data (Stripe reference): up to 10 years per statutory commercial and tax requirements</li>
            <li>Analytics data (PostHog): 1 year from last activity, then anonymised</li>
            <li>Server logs: 7 days</li>
          </ul>
        </section>

        <hr className="legal-divider" />

        <section className="legal-section">
          <h2>5. Cookies and Local Storage</h2>
          <p>
            flashr uses cookies and local browser storage (localStorage) for the following purposes:
          </p>
          <ul>
            <li>
              <strong>Authentication:</strong> A session token and refresh cookie are used for
              login state. These are technically necessary for the service to function.
              Legal basis: Art. 6(1)(b) GDPR.
            </li>
            <li>
              <strong>Analytics (PostHog):</strong> PostHog sets a cookie (<code>ph_*</code>) to
              identify your browser session across page views and attribute analytics events to
              your account. Legal basis: Art. 6(1)(f) GDPR (legitimate interest). You may object
              by contacting <a href="mailto:support@flashr.io">support@flashr.io</a>.
            </li>
          </ul>
          <p>No advertising or third-party tracking cookies are used.</p>
        </section>

        <hr className="legal-divider" />

        <section className="legal-section">
          <h2>6. Your Rights</h2>
          <p>Under the GDPR, you have the following rights:</p>
          <ul>
            <li><strong>Access</strong> (Art. 15 GDPR): right to information about your stored data.</li>
            <li><strong>Rectification</strong> (Art. 16 GDPR): right to correction of inaccurate data.</li>
            <li><strong>Erasure</strong> (Art. 17 GDPR): right to deletion of your data.</li>
            <li><strong>Restriction</strong> (Art. 18 GDPR): right to restrict processing.</li>
            <li><strong>Data portability</strong> (Art. 20 GDPR): right to receive your data in a machine-readable format.</li>
            <li><strong>Objection</strong> (Art. 21 GDPR): right to object to processing.</li>
          </ul>
          <p>
            To exercise your rights, contact us at:{" "}
            <a href="mailto:support@flashr.io">support@flashr.io</a>
          </p>
          <p>
            You can also exercise your <strong>right to erasure</strong> (Art. 17 GDPR) directly
            in the app: Profile → Delete Account. This will permanently and irreversibly delete
            your account and all associated data.
          </p>
          <p>
            You also have the right to lodge a complaint with a data protection supervisory
            authority. The competent authority is the state-level data protection authority
            (Landesdatenschutzbehörde) at flashr's registered location in Germany. A list of
            all German supervisory authorities is available at the{" "}
            <a href="https://www.datenschutzkonferenz-online.de" target="_blank" rel="noopener noreferrer">
              Datenschutzkonferenz (DSK)
            </a>.
          </p>
        </section>

        <hr className="legal-divider" />

        <section className="legal-section">
          <h2>7. Changes to this Privacy Policy</h2>
          <p>
            We reserve the right to update this Privacy Policy to reflect changes in law or in
            the service. The current version is always available at{" "}
            <a href="https://flashr.io/privacy">flashr.io/privacy</a>.
          </p>
        </section>
      </main>

      <footer className="legal-footer">
        <p>© {new Date().getFullYear()} flashr</p>
      </footer>
    </div>
  );
}
