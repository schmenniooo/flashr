import { useEffect, useState } from "react";
import { Tag, ArrowRight } from "lucide-react";
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
          localStorage.setItem(STORAGE_KEYS.LAST_SEEN_ANNOUNCEMENT, data[0].version);
          window.dispatchEvent(new Event("flashr:announcement-seen"));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="ann">
      <header className="ann__head">
        <div>
          <span className="text-meta">What's new</span>
          <h1 className="text-h1">Release notes</h1>
          <p className="text-body">Updates and improvements to flashr.</p>
        </div>
      </header>

      {loading ? (
        <p className="text-body">Loading…</p>
      ) : releases.length === 0 ? (
        <p className="text-body">No announcements yet.</p>
      ) : (
        <ol className="ann__list">
          {releases.map((r, i) => (
            <li key={r.version} className={`ann__card${i === 0 ? " ann__card--latest" : ""}`}>
              <div className="ann__card-meta">
                <span className="ann__version">
                  <Tag size={10} strokeWidth={2.5} />
                  v{r.version}
                </span>
                <time className="text-meta" dateTime={r.date}>
                  {new Date(r.date).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </time>
                {i === 0 && (
                  <span className="ann__latest-badge">
                    <ArrowRight size={10} strokeWidth={2.5} />
                    Latest
                  </span>
                )}
              </div>
              <h2 className="ann__card-title">{r.title}</h2>
              <p className="text-body">{r.description}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
