export default function LineageGraph({ slots, crossResult, lineage }) {
  const flow = lineage || {
    source_image: slots.find((slot) => slot)?.result?.original_name || "Source Image",
    feature_extraction: "Feature Extraction",
    graphic_translation: "Graphic Translation",
    ai_reference: crossResult ? "AI Reference Ready" : "AI Reference Pending",
    architectural_projection: "Architectural Projection",
  };
  return (
    <section className="lineage glass-panel">
      <h3>Lineage Graph</h3>
      <div className="lineage-row">
        <div className="node"><strong>Source Image</strong><span>{flow.source_image}</span></div>
        <div className="node"><strong>Feature Extraction</strong><span>{flow.feature_extraction}</span></div>
        <div className="node"><strong>Graphic Translation</strong><span>{flow.graphic_translation}</span></div>
        <div className="node"><strong>AI Reference</strong><span>{flow.ai_reference}</span></div>
        <div className="node"><strong>Architectural Projection</strong><span>{flow.architectural_projection}</span></div>
      </div>
    </section>
  );
}
