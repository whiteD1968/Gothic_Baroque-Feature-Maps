export default function GrasshopperExportPanel({ onExport, contourSimplify, setContourSimplify }) {
  const formats = [
    "PNG", "JPG", "SVG contour lines", "SVG region boundaries", "grayscale heightmap", "node coordinate CSV", "JSON metadata", "color palette JSON", "density grid CSV",
  ];
  return (
    <article className="inspector-card">
      <h4>Grasshopper-Friendly Export</h4>
      <div className="field-row">
        <label>Contour Simplify {contourSimplify}</label>
        <input type="range" min="1" max="12" step="1" value={contourSimplify} onChange={(e) => setContourSimplify(Number(e.target.value))} />
      </div>
      <div className="card-actions">
        {formats.map((f) => <button key={f} type="button" onClick={() => onExport(f)}>{f}</button>)}
      </div>
    </article>
  );
}
