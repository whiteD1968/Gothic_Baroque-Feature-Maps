import { mapLabel } from "./constants";

export default function ResultCard({ result, title, apiBase, onSendToComposer }) {
  return (
    <article className="result-card">
      <header>
        <h4>{title}</h4>
        <p>{result?.tag || "Generated"}</p>
      </header>
      <div className="result-preview-grid">
        {Object.entries(result.maps || {}).slice(0, 7).map(([key, value]) => {
          const url = `${apiBase}/api/download/file?path=${encodeURIComponent(value)}`;
          return (
            <figure key={key}>
              <img src={url} alt={key} />
              <figcaption>{mapLabel(key)}</figcaption>
            </figure>
          );
        })}
      </div>
      <div className="card-actions">
        {result.maps && Object.entries(result.maps).length > 0 && (
          <a
            href={`${apiBase}/api/download/file?path=${encodeURIComponent(Object.entries(result.maps)[0][1])}`}
            target="_blank"
            rel="noreferrer"
          >
            Download
          </a>
        )}
        <button type="button" onClick={onSendToComposer}>Send to Composer</button>
      </div>
    </article>
  );
}
