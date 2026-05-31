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
    "opacity blend", "region overlay", "overlay", "multiply", "difference", "soft merge", "edge-transfer", "density-transfer", "contour fusion", "pattern crossbreed", "field merge", "palette transfer", "mj blend",
  ];
  const presets = ["Gothic Rib Logic", "Baroque Swell Logic", "Tectonic Patchwork", "Monochrome Ink", "Editorial Atlas", "Pastel Segmentation", "Lithic Texture", "MidJourney Board"];
  const abstractions = ["Hybrid Linework Plate", "Field Condition Map", "Pattern Mutation Sheet", "Contour / Hatch Drawing", "Palette Region Diagram", "MidJourney Reference Board", "Projection Texture", "Tile / UV Study"];
  const gradientStops = regionFx.gradientStops || ["#ff8a00", "#ffd400", "#7ed321", "#35c759", "#0a84ff"];
  const gradientLower = Number.isFinite(regionFx.gradientLower) ? regionFx.gradientLower : 0.1;
  const gradientUpper = Number.isFinite(regionFx.gradientUpper) ? regionFx.gradientUpper : 0.9;

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
      <div className="field-row checkbox-row">
        <label>
          <input
            type="checkbox"
            checked={Boolean(regionFx.enableAbstractionPreview)}
            onChange={(e) => setRegionFx((prev) => ({ ...prev, enableAbstractionPreview: e.target.checked }))}
          />
          Abstract Preview
        </label>
      </div>
      <div className="field-row">
        <label>Preset</label>
        <select value={preset} onChange={(e) => applyPreset(e.target.value)}>{presets.map((p) => <option key={p}>{p}</option>)}</select>
      </div>
      <div className="field-row">
        <label>Source B Influence {regionFx.sourceBInfluence.toFixed(2)}</label>
        <input type="range" min="0" max="1" step="0.05" value={regionFx.sourceBInfluence} onChange={(e) => setRegionFx((prev) => ({ ...prev, sourceBInfluence: Number(e.target.value) }))} />
      </div>
      <div className="field-row checkbox-row">
        <label>
          <input
            type="checkbox"
            checked={Boolean(regionFx.useSourceBPatch)}
            onChange={(e) => setRegionFx((prev) => ({ ...prev, useSourceBPatch: e.target.checked }))}
          />
          Use Source B As Patch
        </label>
      </div>
      <div className="field-row">
        <label>Color Mode</label>
        <select value={regionFx.colorMode} onChange={(e) => setRegionFx((prev) => ({ ...prev, colorMode: e.target.value }))}>
          <option value="preserve">Preserve Tone</option>
          <option value="shift">Color Shift</option>
          <option value="gradient">Gradient Pixel Shift</option>
        </select>
      </div>
      <div className="field-row">
        <label>Color Shift {regionFx.colorShift.toFixed(2)}</label>
        <input type="range" min="0" max="1" step="0.05" value={regionFx.colorShift} onChange={(e) => setRegionFx((prev) => ({ ...prev, colorShift: Number(e.target.value) }))} />
      </div>
      {regionFx.colorMode === "gradient" ? (
        <>
          <div className="field-row">
            <label>Gradient Ramp</label>
            <div
              style={{
                width: "100%",
                height: "26px",
                borderRadius: "8px",
                border: "1px solid rgba(0,0,0,0.12)",
                background: `linear-gradient(90deg, ${gradientStops.join(", ")})`,
              }}
            />
          </div>
          <div className="field-row">
            <label>Lower Limit {gradientLower.toFixed(2)}</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={gradientLower}
              onChange={(e) => {
                const next = Number(e.target.value);
                setRegionFx((prev) => ({ ...prev, gradientLower: Math.min(next, (prev.gradientUpper ?? 0.9) - 0.01) }));
              }}
            />
          </div>
          <div className="field-row">
            <label>Upper Limit {gradientUpper.toFixed(2)}</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={gradientUpper}
              onChange={(e) => {
                const next = Number(e.target.value);
                setRegionFx((prev) => ({ ...prev, gradientUpper: Math.max(next, (prev.gradientLower ?? 0.1) + 0.01) }));
              }}
            />
          </div>
          <div className="field-row">
            <label>Gradient Stops</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: "8px" }}>
              {gradientStops.map((hex, idx) => (
                <input
                  key={`${hex}-${idx}`}
                  type="color"
                  value={hex}
                  onChange={(e) => {
                    const next = gradientStops.slice();
                    next[idx] = e.target.value;
                    setRegionFx((prev) => ({ ...prev, gradientStops: next }));
                  }}
                  title={`Gradient stop ${idx + 1}`}
                />
              ))}
            </div>
          </div>
        </>
      ) : null}
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
