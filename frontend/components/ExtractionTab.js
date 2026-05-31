import { useMemo, useState } from "react";
import { useEffect, useRef } from "react";
import PresetCard from "./ui/PresetCard";
import ControlCard from "./ui/ControlCard";
import ResultCard from "./ui/ResultCard";
import CanvasInspectorShell from "./ui/CanvasInspectorShell";
import { BLENDABLE_MAP_KEYS, PRESETS, mapLabel, resultKey } from "./ui/constants";

export default function ExtractionTab(props) {
  const {
    extractionOutputs,
    preset,
    applyPreset,
    selectedCount,
    setActiveTab,
    collapsed,
    setCollapsed,
    edgeLow,
    setEdgeLow,
    edgeHigh,
    setEdgeHigh,
    densityKernel,
    setDensityKernel,
    setPreset,
    paletteColors,
    setPaletteColors,
    blendA,
    setBlendA,
    blendB,
    setBlendB,
    blendC,
    setBlendC,
    blendWeightA,
    setBlendWeightA,
    blendWeightB,
    setBlendWeightB,
    blendWeightC,
    setBlendWeightC,
    mutationCount,
    setMutationCount,
    mutationJitter,
    setMutationJitter,
    runExtraction,
    items,
    isLoading,
    backendOnline,
    results,
    apiBase,
    addToComposer,
  } = props;
  const [selectedResultIndex, setSelectedResultIndex] = useState(0);
  const [featuredMapKey, setFeaturedMapKey] = useState("composite_map");
  const [resultViewMode, setResultViewMode] = useState("Grid");
  const [mapStyleMode, setMapStyleMode] = useState("default");
  const canvasRef = useRef(null);
  const selectedResult = useMemo(() => results[selectedResultIndex] || results[0] || null, [results, selectedResultIndex]);

  const mapPreviewKeys = [
    "edge_map",
    "flow_map",
    "density_map",
    "node_map",
    "symmetry_asymmetry_map",
  ];
  const viewModes = ["Grid", "Gallery", "Atlas", "Board", "Detail"];

  const styleOptionsByMap = {
    edge_map: ["default", "thicker line", "inverse mode", "fine-line mode", "monochrome ink mode", "overprint mode"],
    flow_map: ["default", "contour line style", "directional vector field", "engraved line field", "soft banded motion field"],
    density_map: ["default", "contour banding", "heat island mode", "stipple density", "halftone field", "zone clusters"],
    node_map: ["default", "constellation mode", "branching node mode", "connected node web", "weighted node intensity"],
    symmetry_asymmetry_map: ["default", "mirrored split", "difference overlay", "bilateral axis emphasis", "radial balance map"],
  };
  const currentStyleOptions = styleOptionsByMap[featuredMapKey] || ["default"];

  useEffect(() => {
    if (!currentStyleOptions.includes(mapStyleMode)) setMapStyleMode("default");
  }, [featuredMapKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const path = selectedResult?.maps?.[featuredMapKey];
    const canvas = canvasRef.current;
    if (!path || !canvas) return;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      if (mapStyleMode === "default") return;
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imageData.data;

      const gray = (i) => (d[i] + d[i + 1] + d[i + 2]) / 3;
      const setGray = (i, v) => {
        d[i] = v; d[i + 1] = v; d[i + 2] = v; d[i + 3] = 255;
      };
      const clamp = (v) => Math.max(0, Math.min(255, v));

      if (mapStyleMode === "inverse mode") {
        for (let i = 0; i < d.length; i += 4) setGray(i, 255 - gray(i));
      }
      if (mapStyleMode === "fine-line mode") {
        for (let i = 0; i < d.length; i += 4) {
          const g = gray(i);
          setGray(i, g > 160 ? 245 : 32);
        }
      }
      if (mapStyleMode === "monochrome ink mode") {
        for (let i = 0; i < d.length; i += 4) {
          const g = gray(i);
          d[i] = clamp(g * 0.25);
          d[i + 1] = clamp(g * 0.32);
          d[i + 2] = clamp(g * 0.45);
          d[i + 3] = 255;
        }
      }
      if (mapStyleMode === "overprint mode") {
        for (let i = 0; i < d.length; i += 4) {
          const g = gray(i);
          d[i] = clamp(g * 0.75 + 35);
          d[i + 1] = clamp(g * 0.75 + 10);
          d[i + 2] = clamp(g * 0.75 + 40);
        }
      }
      if (mapStyleMode === "thicker line") {
        const copy = new Uint8ClampedArray(d);
        for (let y = 1; y < canvas.height - 1; y += 1) {
          for (let x = 1; x < canvas.width - 1; x += 1) {
            const idx = (y * canvas.width + x) * 4;
            let max = 0;
            for (let oy = -1; oy <= 1; oy += 1) {
              for (let ox = -1; ox <= 1; ox += 1) {
                const n = ((y + oy) * canvas.width + (x + ox)) * 4;
                max = Math.max(max, (copy[n] + copy[n + 1] + copy[n + 2]) / 3);
              }
            }
            setGray(idx, max);
          }
        }
      }
      if (mapStyleMode === "contour line style" || mapStyleMode === "contour banding") {
        for (let i = 0; i < d.length; i += 4) {
          const g = gray(i);
          const b = Math.round(g / 32) * 32;
          setGray(i, b);
        }
      }
      if (mapStyleMode === "soft banded motion field") {
        for (let i = 0; i < d.length; i += 4) {
          const g = gray(i);
          const b = Math.round(g / 42) * 42;
          d[i] = clamp(b * 0.6);
          d[i + 1] = clamp(b * 0.8);
          d[i + 2] = clamp(255 - b * 0.5);
        }
      }
      if (mapStyleMode === "engraved line field") {
        for (let y = 0; y < canvas.height; y += 1) {
          for (let x = 0; x < canvas.width; x += 1) {
            const idx = (y * canvas.width + x) * 4;
            if ((x + y) % 8 === 0) setGray(idx, gray(idx) > 120 ? 40 : 220);
          }
        }
      }
      if (mapStyleMode === "heat island mode") {
        for (let i = 0; i < d.length; i += 4) {
          const g = gray(i);
          d[i] = clamp(g * 1.2);
          d[i + 1] = clamp(160 - g * 0.3);
          d[i + 2] = clamp(255 - g);
        }
      }
      if (mapStyleMode === "stipple density") {
        for (let y = 0; y < canvas.height; y += 1) {
          for (let x = 0; x < canvas.width; x += 1) {
            const idx = (y * canvas.width + x) * 4;
            const g = gray(idx);
            if (Math.random() < g / 255 * 0.3) setGray(idx, 20);
            else setGray(idx, 240);
          }
        }
      }
      if (mapStyleMode === "halftone field") {
        for (let y = 0; y < canvas.height; y += 1) {
          for (let x = 0; x < canvas.width; x += 1) {
            const idx = (y * canvas.width + x) * 4;
            const g = gray(idx);
            const dot = ((x % 6) - 3) ** 2 + ((y % 6) - 3) ** 2;
            setGray(idx, dot < g / 24 ? 20 : 235);
          }
        }
      }
      if (mapStyleMode === "zone clusters") {
        for (let i = 0; i < d.length; i += 4) {
          const g = gray(i);
          const zone = g < 64 ? 35 : g < 128 ? 110 : g < 192 ? 180 : 245;
          d[i] = zone;
          d[i + 1] = clamp(zone - 20);
          d[i + 2] = clamp(255 - zone * 0.7);
        }
      }
      if (mapStyleMode === "constellation mode" || mapStyleMode === "weighted node intensity") {
        for (let i = 0; i < d.length; i += 4) {
          const g = gray(i);
          if (g > 130) {
            d[i] = 230; d[i + 1] = 240; d[i + 2] = 255;
          } else {
            setGray(i, 18);
          }
        }
      }
      if (mapStyleMode === "connected node web" || mapStyleMode === "branching node mode" || mapStyleMode === "directional vector field") {
        ctx.putImageData(imageData, 0, 0);
        ctx.strokeStyle = "rgba(20,20,20,0.35)";
        ctx.lineWidth = mapStyleMode === "branching node mode" ? 1.5 : 1;
        const step = mapStyleMode === "directional vector field" ? 34 : 44;
        for (let y = step; y < canvas.height - step; y += step) {
          for (let x = step; x < canvas.width - step; x += step) {
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + (Math.sin((x + y) / 70) * 20), y + (Math.cos((x - y) / 70) * 20));
            ctx.stroke();
          }
        }
        if (mapStyleMode === "connected node web") {
          ctx.strokeStyle = "rgba(10,132,255,0.22)";
          for (let y = step; y < canvas.height - step; y += step) {
            ctx.beginPath();
            ctx.moveTo(step, y);
            ctx.lineTo(canvas.width - step, y + Math.sin(y / 40) * 14);
            ctx.stroke();
          }
        }
        return;
      }
      if (mapStyleMode === "mirrored split" || mapStyleMode === "difference overlay" || mapStyleMode === "bilateral axis emphasis" || mapStyleMode === "radial balance map") {
        ctx.putImageData(imageData, 0, 0);
        if (mapStyleMode === "mirrored split") {
          ctx.save();
          ctx.scale(-1, 1);
          ctx.globalAlpha = 0.6;
          ctx.drawImage(canvas, -canvas.width, 0);
          ctx.restore();
        }
        if (mapStyleMode === "difference overlay") {
          ctx.fillStyle = "rgba(255,64,64,0.18)";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        if (mapStyleMode === "bilateral axis emphasis") {
          ctx.strokeStyle = "rgba(10,132,255,0.9)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(canvas.width / 2, 0);
          ctx.lineTo(canvas.width / 2, canvas.height);
          ctx.stroke();
        }
        if (mapStyleMode === "radial balance map") {
          const gradient = ctx.createRadialGradient(
            canvas.width / 2, canvas.height / 2, 20,
            canvas.width / 2, canvas.height / 2, canvas.width * 0.5,
          );
          gradient.addColorStop(0, "rgba(10,132,255,0.24)");
          gradient.addColorStop(1, "rgba(255,255,255,0)");
          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        return;
      }
      ctx.putImageData(imageData, 0, 0);
    };
    img.src = `${apiBase}/api/download/file?path=${encodeURIComponent(path)}`;
  }, [selectedResult, featuredMapKey, mapStyleMode, apiBase]);

  const renderResultsByMode = () => {
    if (resultViewMode === "Detail" && selectedResult) {
      return (
        <div className="result-detail-mode">
          <ResultCard
            result={selectedResult}
            title={selectedResult.original_name}
            apiBase={apiBase}
            onSendToComposer={() => addToComposer(selectedResult, selectedResultIndex)}
          />
        </div>
      );
    }
    return (
      <div className={`result-grid result-mode-${resultViewMode.toLowerCase()}`}>
        {results.map((result, idx) => (
          <ResultCard
            key={resultKey(result, idx)}
            result={result}
            title={result.original_name}
            apiBase={apiBase}
            onSendToComposer={() => addToComposer(result, idx)}
            presentationMode={resultViewMode}
          />
        ))}
      </div>
    );
  };

  return (
    <section className="tab-panel">
      <section className="glass-panel mode-panel">
        <h3>Analytical Map Outputs</h3>
        <div className="pill-row">
          {extractionOutputs.map((label) => <span key={label} className="pill">{label}</span>)}
        </div>
      </section>
      <div className="preset-grid">
        {Object.entries(PRESETS).map(([key, cfg]) => (
          <PresetCard
            key={key}
            title={cfg.label}
            subtitle={`Low ${cfg.edgeLow ?? "-"} / High ${cfg.edgeHigh ?? "-"}`}
            active={preset === key}
            onClick={() => applyPreset(key)}
          />
        ))}
      </div>
      <div className="panel-head">
        <h3>Selected for Composer: {selectedCount} / 3</h3>
        <button type="button" onClick={() => setActiveTab("Translation")} disabled={!selectedCount}>Open Translation Lab</button>
      </div>
      <details className="inspector-drawer">
        <summary>Extraction Inspector</summary>
        <div className="controls-grid">
          <ControlCard title="Detection Settings" collapsed={collapsed.detection} onToggle={() => setCollapsed((prev) => ({ ...prev, detection: !prev.detection }))}>
            <label>Edge Low {edgeLow}</label>
            <input type="range" min="10" max="200" value={edgeLow} onChange={(e) => { setEdgeLow(Number(e.target.value)); setPreset("custom"); }} />
            <label>Edge High {edgeHigh}</label>
            <input type="range" min="50" max="300" value={edgeHigh} onChange={(e) => { setEdgeHigh(Number(e.target.value)); setPreset("custom"); }} />
            <label>Density Kernel {densityKernel}</label>
            <input type="range" min="3" max="21" step="2" value={densityKernel} onChange={(e) => { setDensityKernel(Number(e.target.value)); setPreset("custom"); }} />
          </ControlCard>
          <ControlCard title="Map Styling" collapsed={collapsed.styling} onToggle={() => setCollapsed((prev) => ({ ...prev, styling: !prev.styling }))}>
            <label>Palette Colors {paletteColors}</label>
            <input type="range" min="3" max="8" value={paletteColors} onChange={(e) => setPaletteColors(Number(e.target.value))} />
            <label>Blend A</label><select value={blendA} onChange={(e) => setBlendA(e.target.value)}>{BLENDABLE_MAP_KEYS.map((key) => <option key={key} value={key}>{mapLabel(key)}</option>)}</select>
            <label>Blend B</label><select value={blendB} onChange={(e) => setBlendB(e.target.value)}>{BLENDABLE_MAP_KEYS.map((key) => <option key={key} value={key}>{mapLabel(key)}</option>)}</select>
            <label>Blend C</label><select value={blendC} onChange={(e) => setBlendC(e.target.value)}>{BLENDABLE_MAP_KEYS.map((key) => <option key={key} value={key}>{mapLabel(key)}</option>)}</select>
          </ControlCard>
          <ControlCard title="Mutation" collapsed={collapsed.mutation} onToggle={() => setCollapsed((prev) => ({ ...prev, mutation: !prev.mutation }))}>
            <label>Weight A {blendWeightA}%</label><input type="range" min="0" max="100" value={blendWeightA} onChange={(e) => setBlendWeightA(Number(e.target.value))} />
            <label>Weight B {blendWeightB}%</label><input type="range" min="0" max="100" value={blendWeightB} onChange={(e) => setBlendWeightB(Number(e.target.value))} />
            <label>Weight C {blendWeightC}%</label><input type="range" min="0" max="100" value={blendWeightC} onChange={(e) => setBlendWeightC(Number(e.target.value))} />
            <label>Mutation Count {mutationCount}</label><input type="range" min="2" max="30" value={mutationCount} onChange={(e) => setMutationCount(Number(e.target.value))} />
            <label>Mutation Jitter {mutationJitter.toFixed(2)}</label><input type="range" min="0" max="1" step="0.05" value={mutationJitter} onChange={(e) => setMutationJitter(Number(e.target.value))} />
            <button type="button" onClick={() => runExtraction(true)} disabled={!items.length || isLoading || !backendOnline}>{isLoading ? "Processing..." : "Generate Variants"}</button>
          </ControlCard>
        </div>
      </details>
      {selectedResult ? (
        <CanvasInspectorShell
          className="glass-panel"
          header={(
            <header className="workspace-head">
              <h3>{selectedResult.original_name}</h3>
              <p className="muted">Selected Map: {mapLabel(featuredMapKey)}</p>
            </header>
          )}
          main={(
            <>
              <section className="workspace-canvas">
                <canvas ref={canvasRef} className="styled-map-canvas" aria-label={`${selectedResult.original_name} :: ${featuredMapKey}`} />
              </section>
              <section className="workspace-map-strip">
                {mapPreviewKeys.map((key) => {
                  const path = selectedResult?.maps?.[key];
                  if (!path) return null;
                  return (
                    <button
                      key={key}
                      type="button"
                      className={featuredMapKey === key ? "map-chip active" : "map-chip"}
                      onClick={() => setFeaturedMapKey(key)}
                    >
                      <img src={`${apiBase}/api/download/file?path=${encodeURIComponent(path)}`} alt={key} />
                      <span>{mapLabel(key)}</span>
                    </button>
                  );
                })}
              </section>
              <section className="workspace-variant-strip">
                {results.slice(0, 12).map((result, idx) => (
                  <button
                    key={resultKey(result, idx)}
                    type="button"
                    className={selectedResultIndex === idx ? "variant-tile active" : "variant-tile"}
                    onClick={() => setSelectedResultIndex(idx)}
                  >
                    <img
                      src={`${apiBase}/api/download/file?path=${encodeURIComponent(result?.maps?.composite_map || result?.maps?.edge_map || Object.values(result?.maps || {})[0])}`}
                      alt={result.original_name}
                    />
                    <span>Variant {result?.variant?.index || idx + 1}</span>
                  </button>
                ))}
              </section>
            </>
          )}
          inspector={(
            <>
              <h4>Inspector</h4>
              <div className="field-row">
                <label>Featured Map</label>
                <select value={featuredMapKey} onChange={(e) => setFeaturedMapKey(e.target.value)}>
                  {Object.keys(selectedResult.maps || {}).map((key) => (
                    <option key={key} value={key}>{mapLabel(key)}</option>
                  ))}
                </select>
              </div>
              <div className="field-row">
                <label>Map Visual Mode</label>
                <select value={mapStyleMode} onChange={(e) => setMapStyleMode(e.target.value)}>
                  {currentStyleOptions.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
                </select>
              </div>
              <div className="field-row">
                <label>Feature Metrics</label>
                <pre>{JSON.stringify(selectedResult.metrics || {}, null, 2)}</pre>
              </div>
              <div className="card-actions">
                <button type="button" onClick={() => addToComposer(selectedResult, selectedResultIndex)}>Send to Translation</button>
                <button type="button" onClick={() => setActiveTab("Translation")} disabled={!selectedCount}>Open Translation Lab</button>
              </div>
            </>
          )}
        />
      ) : null}

      <details className="inspector-drawer">
        <summary>Presentation Modes</summary>
        <div className="card-actions presentation-mode-picker">
          {viewModes.map((mode) => (
            <button key={mode} type="button" className={resultViewMode === mode ? "action-primary" : ""} onClick={() => setResultViewMode(mode)}>
              {mode}
            </button>
          ))}
        </div>
        {renderResultsByMode()}
      </details>
    </section>
  );
}
