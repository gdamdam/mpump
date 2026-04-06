/**
 * DiscoverModal — browse featured beats, weekly seed, and remix chains.
 * Data sourced from public/data/featured.json.
 */

import { useState, useEffect } from "react";

interface FeaturedBeat {
  id: string;
  title: string;
  bpm: number;
  genre: string;
  url: string;
  note?: string;
  parentId?: string;
}

interface FeaturedData {
  updated: string;
  seed: FeaturedBeat | null;
  featured: FeaturedBeat[];
  chains: { parentId: string; childId: string; label?: string }[];
}

interface Props {
  onClose: () => void;
}

function imgUrl(beatUrl: string): string {
  return beatUrl.replace("s.mpump.live/?", "s.mpump.live/img?");
}

export function DiscoverModal({ onClose }: Props) {
  const [data, setData] = useState<FeaturedData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("./data/featured.json")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setError(true));
  }, []);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  return (
    <div className="help-overlay" onClick={onClose}>
      <div className="help-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
        <div className="help-header">
          <span className="help-title">Discover</span>
          <button className="settings-close" title="Close" onClick={onClose}>✕</button>
        </div>

        {error && <div style={{ padding: 16, opacity: 0.5 }}>Could not load featured beats.</div>}

        {!data && !error && <div style={{ padding: 16, opacity: 0.5 }}>Loading...</div>}

        {data && (
          <div className="help-list" style={{ gap: 12 }}>
            {/* Weekly seed */}
            {data.seed && (
              <div className="discover-section">
                <div className="discover-section-label">Remix this</div>
                <a className="discover-card discover-card-seed" href={data.seed.url} target="_blank" rel="noopener noreferrer">
                  <img className="discover-card-img" src={imgUrl(data.seed.url)} alt={data.seed.title} loading="lazy" />
                  <div className="discover-card-info">
                    <span className="discover-card-title">{data.seed.title}</span>
                    <span className="discover-card-meta">{data.seed.bpm} bpm · {data.seed.genre}</span>
                    {data.seed.note && <span className="discover-card-note">{data.seed.note}</span>}
                  </div>
                </a>
              </div>
            )}

            {/* Featured beats */}
            {data.featured.length > 0 && (
              <div className="discover-section">
                <div className="discover-section-label">Featured</div>
                <div className="discover-grid">
                  {data.featured.map((b) => (
                    <a key={b.id} className="discover-card" href={b.url} target="_blank" rel="noopener noreferrer">
                      <img className="discover-card-img" src={imgUrl(b.url)} alt={b.title} loading="lazy" />
                      <div className="discover-card-info">
                        <span className="discover-card-title">{b.title}</span>
                        <span className="discover-card-meta">{b.bpm} bpm · {b.genre}</span>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Remix chains */}
            {data.chains.length > 0 && (
              <div className="discover-section">
                <div className="discover-section-label">Remix chains</div>
                {data.chains.map((c, i) => (
                  <div key={i} className="discover-chain">
                    <a href={`https://s.mpump.live/${c.parentId}`} target="_blank" rel="noopener noreferrer">{c.parentId}</a>
                    <span className="discover-chain-arrow">→</span>
                    <a href={`https://s.mpump.live/${c.childId}`} target="_blank" rel="noopener noreferrer">{c.childId}</a>
                    {c.label && <span className="discover-chain-label">{c.label}</span>}
                  </div>
                ))}
              </div>
            )}

            <div style={{ fontSize: 9, opacity: 0.3, textAlign: "center", padding: "4px 0" }}>
              Updated {data.updated}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
