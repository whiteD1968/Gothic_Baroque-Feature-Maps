import UploadZone from "./ui/UploadZone";
import ImageCard from "./ui/ImageCard";

export default function ArchiveTab({
  items,
  onSelectFiles,
  runExtraction,
  isLoading,
  backendOnline,
  updateTag,
  removeItem,
}) {
  return (
    <section className="tab-panel">
      <UploadZone onSelectFiles={onSelectFiles} />
      <div className="panel-head">
        <h2>Archive</h2>
        <button type="button" onClick={() => runExtraction(false)} disabled={!items.length || isLoading || !backendOnline}>
          {isLoading ? "Analyzing..." : "Analyze Archive"}
        </button>
      </div>
      <div className="gallery-grid">
        {items.map((item) => (
          <ImageCard
            key={item.id}
            item={item}
            onTagChange={updateTag}
            onRemove={removeItem}
            onAnalyze={() => runExtraction(false)}
            analyzeDisabled={!backendOnline || isLoading}
            onView={() => window.open(item.previewUrl, "_blank", "noopener,noreferrer")}
          />
        ))}
      </div>
    </section>
  );
}

