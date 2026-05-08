import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import "./Legal.css";

export function Imprint() {
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
        <h1 className="legal-title">Imprint</h1>
        <p className="legal-meta">Information pursuant to § 5 TMG (German Telemedia Act)</p>

        <section className="legal-section">
          <h2>Service Provider</h2>
          <p>
            Ennio Schmidt<br />
            [Street Address]<br />
            [Postal Code, City]<br />
            Germany
          </p>
        </section>

        <hr className="legal-divider" />

        <section className="legal-section">
          <h2>Contact</h2>
          <p>
            Email: <a href="mailto:ennio.nick@gmail.com">ennio.nick@gmail.com</a>
          </p>
        </section>

        <hr className="legal-divider" />

        <section className="legal-section">
          <h2>Responsible for Content pursuant to § 55(2) RStV</h2>
          <p>
            Ennio Schmidt<br />
            [Street Address]<br />
            [Postal Code, City]
          </p>
        </section>

        <hr className="legal-divider" />

        <section className="legal-section">
          <h2>Dispute Resolution</h2>
          <p>
            The European Commission provides a platform for online dispute resolution (ODR):{" "}
            <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer">
              ec.europa.eu/consumers/odr
            </a>
            . We are not obligated to participate in alternative dispute resolution proceedings
            before a consumer arbitration board, but we make every effort to resolve disputes
            directly with our users.
          </p>
        </section>

        <hr className="legal-divider" />

        <section className="legal-section">
          <h2>Liability for Content</h2>
          <p>
            As a service provider, we are responsible for our own content on these pages in
            accordance with general law (§ 7(1) TMG). However, pursuant to §§ 8–10 TMG, we are
            not obligated to monitor transmitted or stored third-party information or to
            investigate circumstances indicating unlawful activity.
          </p>
          <p>
            Obligations to remove or block the use of information under general law remain
            unaffected. Liability in this regard is only possible from the point in time at which
            a specific infringement becomes known. Upon becoming aware of any such violations, we
            will remove the relevant content immediately.
          </p>

          <h2>Liability for Links</h2>
          <p>
            Our website contains links to external third-party websites over whose content we
            have no control. We therefore accept no liability for such external content. The
            respective provider or operator of linked pages is always responsible for their
            content.
          </p>

          <h2>Copyright</h2>
          <p>
            The content and works created by the site operator on these pages are subject to
            German copyright law. Reproduction, editing, distribution, or any form of
            exploitation beyond the limits of copyright law requires the written consent of
            the respective author or creator.
          </p>
        </section>
      </main>

      <footer className="legal-footer">
        <p>© {new Date().getFullYear()} flashr</p>
      </footer>
    </div>
  );
}
