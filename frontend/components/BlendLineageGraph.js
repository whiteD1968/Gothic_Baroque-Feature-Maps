export default function BlendLineageGraph({ lineage }) {
  if (!lineage) return <p className="muted">No lineage yet. Generate a hybrid output.</p>;
  const rows = [
    ["Source A", lineage.sourceA || "-"],
    ["Source B", lineage.sourceB || "-"],
    ["Selected Regions", lineage.selectionTool || "-"],
    ["Feature Channels", lineage.channels || "-"],
    ["Blend Mode", lineage.blendMode || "-"],
    ["Blend Weights", lineage.weights || "-"],
    ["Abstraction", lineage.abstractionMode || "-"],
    ["Mutation", lineage.mutation || "-"],
    ["Export", lineage.exportType || "-"],
  ];
  return (
    <section className="lineage">
      <h3>Blend Lineage</h3>
      <div className="lineage-row">
        {rows.map(([k, v]) => (
          <article key={k} className="node">
            <strong>{k}</strong>
            <span className="muted">{String(v)}</span>
          </article>
        ))}
      </div>
    </section>
  );
}
