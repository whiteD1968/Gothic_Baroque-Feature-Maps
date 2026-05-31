import { mapLabel } from "./constants";

export default function ResultCard({ result, title, apiBase, onSendToComposer }) {
  const mapEntries = Object.entries(result.maps || {});
  const previewEntries = mapEntries.slice(0, 6);
  const firstMap = mapEntries[0]?.[1];

  return (
    <article className="result-card">
      <header className="editorial-head">
        <p className="micro-label">Atlas Plate</p>
        <h4 title={title}>{title}</h4>
        <div className="status-row">
          <span className="status-pill plate">{result?.tag || "Generated"}</span>
          <span className="status-pill plate">v{result?.variant?.index || 1}</span>
          <span className="status-pill plate">{result?.variant?.fitness_score ?? "-"}</span>
        </div>
      </header>
      {firstMap ? (
        <div className="result-featured">
          <img src={`${apiBase}/api/download/file?path=${encodeURIComponent(firstMap)}`} alt="Featured map" />
        </div>
      ) : null}
      <div className="result-preview-grid">
        {previewEntries.map(([key, value]) => {
          const url = `${apiBase}/api/download/file?path=${encodeURIComponent(value)}`;
          return (
            <figure key={key}>
              <img src={url} alt={key} />
              <figcaption className="micro-label">{mapLabel(key)}</figcaption>
            </figure>
          );
        })}
      </div>
      <div className="meta-divider" />
      <div className="card-actions">
        {firstMap && (
          <a
            href={`${apiBase}/api/download/file?path=${encodeURIComponent(firstMap)}`}
            target="_blank"
            rel="noreferrer"
            className="action-link"
          >
            Download
          </a>
        )}
        <button type="button" className="action-primary" onClick={onSendToComposer}>Send to Composer</button>
      </div>
    </article>
  );
}
