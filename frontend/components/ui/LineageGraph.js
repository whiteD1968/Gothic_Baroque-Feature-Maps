export default function LineageGraph({ slots, crossResult }) {
  return (
    <section className="lineage glass-panel">
      <h3>Lineage Graph</h3>
      <div className="lineage-row">
        {slots.map((slot, idx) => (
          <div key={idx} className="node">
            <strong>Source Image</strong>
            <span>{slot ? slot.result.original_name : `Source ${String.fromCharCode(65 + idx)}`}</span>
          </div>
        ))}
      </div>
      <div className="lineage-arrow">Feature Map -{">"}- Composite Map -{">"}- AI Reference</div>
      <div className="lineage-row">
        <div className="node"><strong>Feature Map</strong><span>Weighted map roles</span></div>
        <div className="node"><strong>Composite Map</strong><span>Cross-blend output</span></div>
        <div className="node"><strong>AI Reference</strong><span>{crossResult ? "Ready" : "Pending"}</span></div>
      </div>
    </section>
  );
}
