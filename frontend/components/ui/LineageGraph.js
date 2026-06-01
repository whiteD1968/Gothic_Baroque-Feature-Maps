import { useMemo, useState } from "react";

export default function LineageGraph({ slots, crossResult, lineage, compareLineage = null }) {
  const [filter, setFilter] = useState("all");
  const [notes, setNotes] = useState("");
  const flow = lineage || {
    source_image: slots.find((slot) => slot)?.result?.original_name || "Source Image",
    feature_extraction: "Feature Extraction",
    graphic_translation: "Graphic Translation",
    ai_reference: crossResult ? "AI Reference Ready" : "AI Reference Pending",
    architectural_projection: "Architectural Projection",
  };
  const nodes = useMemo(() => [
    ["source_image", "Source Image"],
    ["feature_extraction", "Feature Extraction"],
    ["graphic_translation", "Graphic Translation"],
    ["ai_reference", "AI Reference"],
    ["architectural_projection", "Architectural Projection"],
  ], []);
  const filtered = nodes.filter(([key]) => filter === "all" || key.includes(filter));
  return (
    <section className="lineage glass-panel">
      <h3>Lineage Graph</h3>
      <div className="card-actions">
        <label>Filter</label>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All</option>
          <option value="source">Source</option>
          <option value="feature">Feature</option>
          <option value="graphic">Graphic</option>
          <option value="ai">AI</option>
          <option value="projection">Projection</option>
        </select>
      </div>
      <div className="lineage-row">
        {filtered.map(([key, label]) => {
          const value = flow[key] || "-";
          const compareValue = compareLineage?.[key];
          const changed = compareLineage && compareValue !== value;
          return (
            <div className="node" key={key}>
              <strong>{label}</strong>
              <span>{value}</span>
              {changed ? <small className="muted">vs compare: {compareValue || "-"}</small> : null}
            </div>
          );
        })}
      </div>
      <div className="field-row">
        <label>Lineage Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Attach interpretation notes to this lineage view." />
      </div>
    </section>
  );
}
