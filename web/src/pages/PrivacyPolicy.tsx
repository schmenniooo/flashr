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
        <h1 className="legal-title">Datenschutzerklärung</h1>
        <p className="legal-meta">Stand: {new Date().toLocaleDateString("de-DE", { month: "long", year: "numeric" })}</p>

        <section className="legal-section">
          <h2>1. Verantwortlicher</h2>
          <p>
            Verantwortlicher im Sinne der DSGVO für die Verarbeitung personenbezogener Daten auf
            dieser Website ist:
          </p>
          <p>
            Ennio Schmidt<br />
            [Straße Hausnummer]<br />
            [PLZ Ort]<br />
            Deutschland<br />
            E-Mail: <a href="mailto:ennio.nick@gmail.com">ennio.nick@gmail.com</a>
          </p>
        </section>

        <hr className="legal-divider" />

        <section className="legal-section">
          <h2>2. Erhobene Daten und Verarbeitungszwecke</h2>

          <h3>2.1 Kontodaten</h3>
          <p>
            Bei der Registrierung erheben wir folgende Daten:
          </p>
          <ul>
            <li>E-Mail-Adresse</li>
            <li>Name (bei Registrierung über Google OAuth)</li>
            <li>Profilbild (optional, bei OAuth-Registrierung)</li>
            <li>Verschlüsseltes Passwort (bei E-Mail-Registrierung)</li>
          </ul>
          <p>
            Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung). Die Daten werden
            für die Bereitstellung des Dienstes und zur Authentifizierung benötigt.
          </p>

          <h3>2.2 Nutzungsdaten</h3>
          <p>
            Im Rahmen der Nutzung von flashr speichern wir die von Ihnen erstellten Inhalte:
            Karteikarten, Sammlungen, Ordner sowie hochgeladene Dokumente zur KI-gestützten
            Kartenerstellung.
          </p>
          <p>
            Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung).
          </p>

          <h3>2.3 Zahlungsdaten</h3>
          <p>
            Zahlungen werden über <strong>Stripe, Inc.</strong> abgewickelt. flashr speichert
            keine vollständigen Zahlungsdaten (Kartennummern etc.). Stripe verarbeitet die
            Zahlungsdaten als eigenständiger Verantwortlicher. Informationen zu Stripes
            Datenschutzpraktiken finden Sie unter{" "}
            <a href="https://stripe.com/de/privacy" target="_blank" rel="noopener noreferrer">
              stripe.com/de/privacy
            </a>.
          </p>
          <p>
            Wir speichern die Stripe-Kunden-ID sowie den Abonnementstatus, um Ihnen Zugang
            zu gebührenpflichtigen Funktionen zu gewähren.
          </p>
          <p>
            Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung).
          </p>

          <h3>2.4 Anmeldung über Google OAuth</h3>
          <p>
            Wenn Sie sich mit Ihrem Google-Konto anmelden, erhalten wir von Google folgende
            Daten: E-Mail-Adresse, Name und Profilbild. flashr verwendet diese Daten
            ausschließlich zur Kontoerstellung und -verwaltung.
          </p>
          <p>
            Google ist selbst Verantwortlicher für die Datenverarbeitung bei OAuth. Informationen
            finden Sie in der{" "}
            <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
              Google-Datenschutzerklärung
            </a>.
          </p>
          <p>
            Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung) i. V. m. Ihrer
            Einwilligung gegenüber Google.
          </p>

          <h3>2.5 Serverprotokolle</h3>
          <p>
            Bei jedem Zugriff auf unsere Server werden automatisch Verbindungsdaten erfasst
            (IP-Adresse, Datum/Uhrzeit, aufgerufene URL, HTTP-Statuscode, übertragene Datenmenge).
            Diese Daten werden ausschließlich zur Sicherstellung des Betriebs und zur
            Fehleranalyse verwendet und nach 7 Tagen gelöscht.
          </p>
          <p>
            Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an
            Sicherheit und Stabilität des Dienstes).
          </p>
        </section>

        <hr className="legal-divider" />

        <section className="legal-section">
          <h2>3. Hosting und Infrastruktur</h2>
          <p>
            flashr wird auf der Plattform <strong>Railway</strong> (Railway Corp., San Francisco,
            USA) gehostet. Die Datenübertragung in die USA ist durch die Standardvertragsklauseln
            der EU-Kommission abgesichert. Weitere Informationen finden Sie in der{" "}
            <a href="https://railway.com/legal/privacy" target="_blank" rel="noopener noreferrer">
              Railway-Datenschutzerklärung
            </a>.
          </p>
        </section>

        <hr className="legal-divider" />

        <section className="legal-section">
          <h2>4. Speicherdauer</h2>
          <p>
            Personenbezogene Daten werden gelöscht, sobald der Zweck der Verarbeitung entfällt
            und keine gesetzlichen Aufbewahrungspflichten entgegenstehen:
          </p>
          <ul>
            <li>Kontodaten: bis zur Löschung des Kontos oder auf Anfrage</li>
            <li>Nutzungsinhalte (Karten, Sammlungen): bis zur Löschung des Kontos</li>
            <li>Zahlungsdaten (Stripe-Referenz): bis zu 10 Jahre nach gesetzlichen Handels- und Steuervorschriften</li>
            <li>Serverprotokolle: 7 Tage</li>
          </ul>
        </section>

        <hr className="legal-divider" />

        <section className="legal-section">
          <h2>5. Cookies</h2>
          <p>
            flashr verwendet ausschließlich technisch notwendige Cookies und
            lokale Browserspeicherung (localStorage) zur Sitzungsverwaltung und
            Authentifizierung. Es werden keine Tracking- oder Werbe-Cookies eingesetzt.
          </p>
          <p>
            Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an
            der technischen Bereitstellung des Dienstes).
          </p>
        </section>

        <hr className="legal-divider" />

        <section className="legal-section">
          <h2>6. Ihre Rechte</h2>
          <p>Sie haben nach der DSGVO folgende Rechte gegenüber uns:</p>
          <ul>
            <li><strong>Auskunft</strong> (Art. 15 DSGVO): Recht auf Auskunft über Ihre gespeicherten Daten.</li>
            <li><strong>Berichtigung</strong> (Art. 16 DSGVO): Recht auf Korrektur unrichtiger Daten.</li>
            <li><strong>Löschung</strong> (Art. 17 DSGVO): Recht auf Löschung Ihrer Daten.</li>
            <li><strong>Einschränkung</strong> (Art. 18 DSGVO): Recht auf Einschränkung der Verarbeitung.</li>
            <li><strong>Datenübertragbarkeit</strong> (Art. 20 DSGVO): Recht auf Herausgabe Ihrer Daten in maschinenlesbarem Format.</li>
            <li><strong>Widerspruch</strong> (Art. 21 DSGVO): Recht auf Widerspruch gegen die Verarbeitung.</li>
          </ul>
          <p>
            Zur Ausübung Ihrer Rechte wenden Sie sich bitte an:{" "}
            <a href="mailto:ennio.nick@gmail.com">ennio.nick@gmail.com</a>
          </p>
          <p>
            Sie haben außerdem das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren.
            Die zuständige Aufsichtsbehörde richtet sich nach Ihrem Wohnort oder unserem Sitz.
          </p>
        </section>

        <hr className="legal-divider" />

        <section className="legal-section">
          <h2>7. Änderungen dieser Datenschutzerklärung</h2>
          <p>
            Wir behalten uns vor, diese Datenschutzerklärung anzupassen, um sie an geänderte
            Rechtslage oder bei Änderungen des Dienstes anzupassen. Die jeweils aktuelle Version
            ist unter <a href="https://flashr.io/datenschutz">flashr.io/datenschutz</a> abrufbar.
          </p>
        </section>
      </main>

      <footer className="legal-footer">
        <p>© {new Date().getFullYear()} flashr</p>
      </footer>
    </div>
  );
}
