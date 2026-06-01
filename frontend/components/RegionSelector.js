export default function RegionSelector({
  selectionTool,
  setSelectionTool,
  selectionTarget,
  setSelectionTarget,
  feather,
  setFeather,
  brushSize,
  setBrushSize,
  eraseTransparency,
  setEraseTransparency,
  onClearSelection,
  onInvertSelection,
  onUndoPolygonNode,
  onClosePolygon,
  onApplyRegion,
  onDeselectRegion,
  onDeleteRegion,
  onUndoEdit,
  onRedoEdit,
  onResetTools,
  transform,
  setTransform,
  isAdvanced = false,
}) {
  const tools = isAdvanced
    ? [
      "rectangular",
      "polygon",
      "brush mask",
      "erase mask",
      "clone stamp",
      "healing patch",
      "content-aware fill",
      "liquify warp",
      "displacement warp",
      "smudge direction",
      "dodge",
      "burn",
      "selective blur",
      "selective sharpen",
      "noise grain",
      "channel mixer",
      "threshold posterize",
      "mosaic morph",
    ]
    : ["rectangular", "brush mask", "erase mask"];
  return (
    <article className="inspector-card">
      <h4>Region Selection</h4>
      <div className="field-row">
        <label>Editing Region</label>
        <select value={selectionTarget} onChange={(e) => setSelectionTarget(e.target.value)}>
          <option value="A">Source A Region</option>
          <option value="B">Source B Region</option>
        </select>
      </div>
      <div className="field-row">
        <small className="muted">
          Active target: {selectionTarget === "A" ? "Editing Source A mask/region" : "Editing Source B mask/region"}
        </small>
      </div>
      <div className="pill-row">
        {tools.map((tool) => (
          <button key={tool} type="button" className={selectionTool === tool ? "pill active" : "pill"} onClick={() => setSelectionTool(tool)}>{tool}</button>
        ))}
      </div>
      {isAdvanced && selectionTool === "clone stamp" ? (
        <div className="field-row">
          <small className="muted">Clone stamp: Shift+Click to set sample point, then paint to clone.</small>
        </div>
      ) : null}
      <div className="field-row">
        <label>Feather {feather.toFixed(2)}</label>
        <input type="range" min="0" max="1" step="0.05" value={feather} onChange={(e) => setFeather(Number(e.target.value))} />
      </div>
      <div className="field-row">
        <label>Brush Diameter {brushSize}px</label>
        <input type="range" min="2" max="120" step="1" value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} />
      </div>
      {selectionTool === "erase mask" ? (
        <div className="field-row">
          <label>Erase Transparency {eraseTransparency}%</label>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={eraseTransparency}
            onChange={(e) => setEraseTransparency(Number(e.target.value))}
          />
        </div>
      ) : null}
      {isAdvanced ? (
        <div className="field-row">
          <label>Move X (active region)</label><input type="range" min="-300" max="300" value={transform.x} onChange={(e) => setTransform((p) => ({ ...p, x: Number(e.target.value) }))} />
          <label>Move Y (active region)</label><input type="range" min="-300" max="300" value={transform.y} onChange={(e) => setTransform((p) => ({ ...p, y: Number(e.target.value) }))} />
          <label>Rotate (active region)</label><input type="range" min="-180" max="180" value={transform.rotation} onChange={(e) => setTransform((p) => ({ ...p, rotation: Number(e.target.value) }))} />
          <label>Scale (active region)</label><input type="range" min="0.2" max="2" step="0.05" value={transform.scale} onChange={(e) => setTransform((p) => ({ ...p, scale: Number(e.target.value) }))} />
        </div>
      ) : null}
      <div className="card-actions">
        <button type="button" onClick={onUndoEdit}>Undo Edit (Ctrl+Z)</button>
        <button type="button" onClick={onRedoEdit}>Redo (Ctrl+Shift+Z)</button>
        <button type="button" onClick={onResetTools}>Reset Blend Tools</button>
        <button type="button" onClick={onApplyRegion}>Apply Region</button>
        <button type="button" onClick={onDeselectRegion}>Deselect</button>
        <button type="button" onClick={onDeleteRegion}>
          {selectionTarget === "A" ? "Delete A -> Fill from B" : "Delete B -> Fill from A"}
        </button>
        {isAdvanced ? <button type="button" onClick={onUndoPolygonNode}>Undo Node</button> : null}
        {isAdvanced ? <button type="button" onClick={onClosePolygon}>Close Polygon</button> : null}
        {isAdvanced ? <button type="button" onClick={onInvertSelection}>Invert Selection</button> : null}
        {isAdvanced ? <button type="button" onClick={onClearSelection}>Clear Selection</button> : null}
      </div>
    </article>
  );
}
