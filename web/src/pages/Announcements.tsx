import { useEffect, useState } from "react";
import { Megaphone } from "lucide-react";
import { api } from "../lib/api";
import { STORAGE_KEYS } from "../lib/storageKeys";
import "./Announcements.css";

export interface Release {
  version: string;
  date: string;
  title: string;
  description: string;
}

export function Announcements() {
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<Release[]>("/announcements")
      .then((data) => {
        setReleases(data);
        if (data.length > 0) {
          localStorage.setItem(
            STORAGE_KEYS.LAST_SEEN_ANNOUNCEMENT,
            data[0].version,
          );
          window.dispatchEvent(new Event("flashr:announcement-seen"));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="ann">
      <div className="ann__header">
        <Megaphone size={20} strokeWidth={1.8} className="ann__header-icon" />
        <div>
          <h1 className="ann__title">What's new</h1>
          <p className="ann__subtitle">Release notes and updates for flashr.</p>
        </div>
      </div>

      {loading ? (
        <div className="ann__loading">Loading releases…</div>
      ) : releases.length === 0 ? (
        <div className="ann__empty">No announcements yet.</div>
      ) : (
        <ol className="ann__list">
          {releases.map((r, i) => (
            <li key={r.version} className="ann__item">
              <div className="ann__timeline">
                <div className={`ann__dot${i === 0 ? " ann__dot--latest" : ""}`} />
                {i < releases.length - 1 && <div className="ann__line" />}
              </div>
              <div className="ann__card">
                <div className="ann__card-head">
                  <span className="ann__version">v{r.version}</span>
                  <time className="ann__date" dateTime={r.date}>
                    {new Date(r.date).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </time>
                </div>
                <h2 className="ann__card-title">{r.title}</h2>
                <p className="ann__card-desc">{r.description}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
