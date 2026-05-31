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
}) {
  const tools = ["rectangular", "lasso", "polygon", "brush mask", "erase mask"];
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
      <div className="field-row">
        <label>Move X (active region)</label><input type="range" min="-300" max="300" value={transform.x} onChange={(e) => setTransform((p) => ({ ...p, x: Number(e.target.value) }))} />
        <label>Move Y (active region)</label><input type="range" min="-300" max="300" value={transform.y} onChange={(e) => setTransform((p) => ({ ...p, y: Number(e.target.value) }))} />
        <label>Rotate (active region)</label><input type="range" min="-180" max="180" value={transform.rotation} onChange={(e) => setTransform((p) => ({ ...p, rotation: Number(e.target.value) }))} />
        <label>Scale (active region)</label><input type="range" min="0.2" max="2" step="0.05" value={transform.scale} onChange={(e) => setTransform((p) => ({ ...p, scale: Number(e.target.value) }))} />
      </div>
      <div className="card-actions">
        <button type="button" onClick={onUndoEdit}>Undo Edit (Ctrl+Z)</button>
        <button type="button" onClick={onRedoEdit}>Redo (Ctrl+Shift+Z)</button>
        <button type="button" onClick={onResetTools}>Reset Blend Tools</button>
        <button type="button" onClick={onApplyRegion}>Apply Region</button>
        <button type="button" onClick={onDeselectRegion}>Deselect</button>
        <button type="button" onClick={onDeleteRegion}>
          {selectionTarget === "A" ? "Delete A -> Fill from B" : "Delete B -> Fill from A"}
        </button>
        <button type="button" onClick={onUndoPolygonNode}>Undo Node</button>
        <button type="button" onClick={onClosePolygon}>Close Polygon</button>
        <button type="button" onClick={onInvertSelection}>Invert Selection</button>
        <button type="button" onClick={onClearSelection}>Clear Selection</button>
      </div>
    </article>
  );
}
