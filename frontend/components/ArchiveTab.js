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
  const [collection, setCollection] = useState("All Images");
  const tags = ["All", "Gothic", "Baroque", "Mixed", "Custom"];
  const collections = ["All Images", "Gothic Cluster", "Baroque Cluster", "Mixed Cluster", "Duplicates"];
  const duplicateKeys = useMemo(() => {
    const counts = new Map();
    items.forEach((item) => {
      const key = `${item.file?.name || ""}-${item.file?.size || 0}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return counts;
  }, [items]);
  const visibleItems = useMemo(
    () => items.filter((item) => {
      if (tagFilter !== "All" && item.tag !== tagFilter) return false;
      if (collection === "All Images") return true;
      if (collection === "Gothic Cluster") return item.tag === "Gothic";
      if (collection === "Baroque Cluster") return item.tag === "Baroque";
      if (collection === "Mixed Cluster") return item.tag === "Mixed";
      if (collection === "Duplicates") {
        const key = `${item.file?.name || ""}-${item.file?.size || 0}`;
        return (duplicateKeys.get(key) || 0) > 1;
      }
      return true;
    }),
    [items, tagFilter, collection, duplicateKeys],
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
        <label>Collection</label>
        <select value={collection} onChange={(e) => setCollection(e.target.value)}>
          {collections.map((name) => <option key={name}>{name}</option>)}
        </select>
        <button
          type="button"
          onClick={() => visibleItems.forEach((item) => onSendArchiveItemToTranslation?.(item))}
          disabled={!visibleItems.length || !hasResults}
        >
          Send Visible to Translation
        </button>
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
