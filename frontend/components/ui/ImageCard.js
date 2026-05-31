import { TAGS } from "./constants";

export default function ImageCard({
  item,
  onTagChange,
  onRemove,
  onAnalyze,
  onView,
  analyzeDisabled,
  onSendToTranslation,
  sendDisabled,
}) {
  return (
    <article className="image-card">
      <img src={item.previewUrl} alt={item.file.name} />
      <div className="image-meta">
        <h4 title={item.file.name}>{item.file.name}</h4>
        <div className="pill-row">
          {TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              className={item.tag === tag ? "pill active" : "pill"}
              onClick={() => onTagChange(item.id, tag)}
            >
              {tag}
            </button>
          ))}
        </div>
        <div className="card-actions">
          <button type="button" onClick={onAnalyze} disabled={analyzeDisabled}>Analyze</button>
          <button type="button" onClick={onSendToTranslation} disabled={sendDisabled}>Send to Translation</button>
          <button type="button" className="quiet" onClick={onView}>View</button>
          <button type="button" className="quiet" onClick={() => onRemove(item.id)}>Remove</button>
        </div>
      </div>
    </article>
  );
}
