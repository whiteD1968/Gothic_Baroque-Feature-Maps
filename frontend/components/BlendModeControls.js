export default function BlendModeControls({
  blendMode,
  setBlendMode,
  opacity,
  setOpacity,
  preset,
  applyPreset,
  abstractionMode,
  setAbstractionMode,
  regionFx,
  setRegionFx,
}) {
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
      <div className="field-row">
        <label>Blur {regionFx.blur.toFixed(1)}</label>
        <input type="range" min="0" max="24" step="0.5" value={regionFx.blur} onChange={(e) => setRegionFx((prev) => ({ ...prev, blur: Number(e.target.value) }))} />
      </div>
      <div className="field-row">
        <label>Pixelate {regionFx.pixelate}</label>
        <input type="range" min="1" max="30" step="1" value={regionFx.pixelate} onChange={(e) => setRegionFx((prev) => ({ ...prev, pixelate: Number(e.target.value) }))} />
      </div>
      <div className="field-row">
        <label>Glitch {regionFx.glitch.toFixed(2)}</label>
        <input type="range" min="0" max="1" step="0.05" value={regionFx.glitch} onChange={(e) => setRegionFx((prev) => ({ ...prev, glitch: Number(e.target.value) }))} />
      </div>
      <div className="field-row">
        <label>Smudge {regionFx.smudge.toFixed(2)}</label>
        <input type="range" min="0" max="1" step="0.05" value={regionFx.smudge} onChange={(e) => setRegionFx((prev) => ({ ...prev, smudge: Number(e.target.value) }))} />
      </div>
      <div className="field-row">
        <label>Gloom {regionFx.gloom.toFixed(2)}</label>
        <input type="range" min="0" max="1" step="0.05" value={regionFx.gloom} onChange={(e) => setRegionFx((prev) => ({ ...prev, gloom: Number(e.target.value) }))} />
      </div>
      <div className="field-row">
        <label>Fragment Jitter {regionFx.fragmentJitter.toFixed(2)}</label>
        <input type="range" min="0" max="1" step="0.05" value={regionFx.fragmentJitter} onChange={(e) => setRegionFx((prev) => ({ ...prev, fragmentJitter: Number(e.target.value) }))} />
      </div>
    </article>
  );
}
