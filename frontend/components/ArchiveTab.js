import { useMemo, useState } from "react";
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
  onSendArchiveItemToTranslation,
  hasResults,
}) {
  const [archiveView, setArchiveView] = useState("Board");
  const [tagFilter, setTagFilter] = useState("All");
  const tags = ["All", "Gothic", "Baroque", "Mixed", "Custom"];
  const visibleItems = useMemo(
    () => items.filter((item) => tagFilter === "All" || item.tag === tagFilter),
    [items, tagFilter],
  );

  return (
    <section className="tab-panel">
      <UploadZone onSelectFiles={onSelectFiles} />
      <div className="panel-head">
        <h2>Archive</h2>
        <button type="button" onClick={() => runExtraction(false)} disabled={!items.length || isLoading || !backendOnline}>
          {isLoading ? "Analyzing..." : "Analyze Archive"}
        </button>
      </div>
      <div className="card-actions">
        <label>Archive View</label>
        <select value={archiveView} onChange={(e) => setArchiveView(e.target.value)}>
          <option>Board</option>
          <option>Stack</option>
        </select>
        <label>Tag Filter</label>
        <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
          {tags.map((tag) => <option key={tag}>{tag}</option>)}
        </select>
      </div>
      <div className={archiveView === "Stack" ? "gallery-grid archive-stack" : "gallery-grid archive-board"}>
        {visibleItems.map((item) => (
          <ImageCard
            key={item.id}
            item={item}
            onTagChange={updateTag}
            onRemove={removeItem}
            onAnalyze={() => runExtraction(false)}
            analyzeDisabled={!backendOnline || isLoading}
            onSendToTranslation={() => onSendArchiveItemToTranslation?.(item)}
            sendDisabled={!hasResults}
            onView={() => window.open(item.previewUrl, "_blank", "noopener,noreferrer")}
          />
        ))}
      </div>
    </section>
  );
}
