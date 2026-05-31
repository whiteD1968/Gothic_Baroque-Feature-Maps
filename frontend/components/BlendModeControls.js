export default function BlendModeControls({ blendMode, setBlendMode, opacity, setOpacity, preset, applyPreset, abstractionMode, setAbstractionMode }) {
  const modes = [
    "opacity blend", "overlay", "multiply", "difference", "soft merge", "edge-transfer", "density-transfer", "contour fusion", "pattern crossbreed", "field merge", "palette transfer",
  ];
  const presets = ["Gothic Rib Logic", "Baroque Swell Logic", "Tectonic Patchwork", "Monochrome Ink", "Editorial Atlas", "Pastel Segmentation", "Lithic Texture", "MidJourney Board"];
  const abstractions = ["Hybrid Linework Plate", "Field Condition Map", "Pattern Mutation Sheet", "Contour / Hatch Drawing", "Palette Region Diagram", "MidJourney Reference Board", "Projection Texture", "Tile / UV Study"];

  return (
    <article className="inspector-card">
      <h4>Blend Modes & Presets</h4>
      <div className="field-row">
        <label>Blend Mode</label>
        <select value={blendMode} onChange={(e) => setBlendMode(e.target.value)}>{modes.map((m) => <option key={m}>{m}</option>)}</select>
      </div>
      <div className="field-row">
        <label>Opacity {opacity.toFixed(2)}</label>
        <input type="range" min="0" max="1" step="0.05" value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} />
      </div>
      <div className="field-row">
        <label>Abstraction Mode</label>
        <select value={abstractionMode} onChange={(e) => setAbstractionMode(e.target.value)}>{abstractions.map((m) => <option key={m}>{m}</option>)}</select>
      </div>
      <div className="field-row">
        <label>Preset</label>
        <select value={preset} onChange={(e) => applyPreset(e.target.value)}>{presets.map((p) => <option key={p}>{p}</option>)}</select>
      </div>
    </article>
  );
}
