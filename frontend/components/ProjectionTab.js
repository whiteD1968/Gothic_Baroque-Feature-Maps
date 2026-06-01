import ProjectionLab from "./ui/ProjectionLab";
import LineageGraph from "./ui/LineageGraph";

export default function ProjectionTab({
  projectionSurfaces,
  apiBase,
  results,
  crossResult,
  exportFormat,
  registerGeneratedOutput,
  slotNodes,
  generatedOutputs = [],
}) {
  const projectionOutputs = generatedOutputs.filter((item) => item.kind === "projection").slice(0, 12);
  return (
    <section className="tab-panel">
      <section className="glass-panel mode-panel">
        <h3>Projection Targets</h3>
        <div className="pill-row">{projectionSurfaces.map((label) => <span key={label} className="pill">{label}</span>)}</div>
        <p className="muted">Use this stage to map translated reference outputs onto architectural placeholder geometry for design studies.</p>
      </section>
      <ProjectionLab
        apiBase={apiBase}
        results={results}
        crossResult={crossResult}
        exportFormat={exportFormat}
        onRegisterOutput={registerGeneratedOutput}
      />
      <section className="preview-panel glass-panel">
        <h3>Projected Preview</h3>
        {crossResult?.maps ? (
          <img src={`${apiBase}/api/download/file?path=${encodeURIComponent(crossResult.maps.cross_blend_map || Object.values(crossResult.maps)[0])}`} alt="Composite preview" />
        ) : (
          <p className="muted">Generate cross-reference maps to preview composite output.</p>
        )}
      </section>
      <LineageGraph slots={slotNodes} crossResult={crossResult} />
      <section className="preview-panel glass-panel">
        <h3>Projection Snapshots</h3>
        {projectionOutputs.length ? (
          <div className="mutation-grid">
            {projectionOutputs.map((item) => (
              <a key={item.id} href={item.previewUrl} download={`${item.title}.${exportFormat}`}>
                <img src={item.previewUrl} alt={item.title} />
              </a>
            ))}
          </div>
        ) : (
          <p className="muted">Render projection outputs to populate snapshot history.</p>
        )}
      </section>
    </section>
  );
}
