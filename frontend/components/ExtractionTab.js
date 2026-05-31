import { useMemo, useState } from "react";
import PresetCard from "./ui/PresetCard";
import ControlCard from "./ui/ControlCard";
import ResultCard from "./ui/ResultCard";
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
  const selectedResult = useMemo(() => results[selectedResultIndex] || results[0] || null, [results, selectedResultIndex]);

  const mapPreviewKeys = [
    "edge_map",
    "flow_map",
    "density_map",
    "node_map",
    "symmetry_asymmetry_map",
  ];

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
        <section className="workspace-lab glass-panel">
          <div className="workspace-main">
            <header className="workspace-head">
              <h3>{selectedResult.original_name}</h3>
              <p className="muted">Selected Map: {mapLabel(featuredMapKey)}</p>
            </header>

            <section className="workspace-canvas">
              <img
                src={`${apiBase}/api/download/file?path=${encodeURIComponent(selectedResult?.maps?.[featuredMapKey] || selectedResult?.maps?.original)}`}
                alt={`${selectedResult.original_name} :: ${featuredMapKey}`}
              />
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
          </div>

          <aside className="workspace-inspector">
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
              <label>Feature Metrics</label>
              <pre>{JSON.stringify(selectedResult.metrics || {}, null, 2)}</pre>
            </div>
            <div className="card-actions">
              <button type="button" onClick={() => addToComposer(selectedResult, selectedResultIndex)}>Send to Translation</button>
              <button type="button" onClick={() => setActiveTab("Translation")} disabled={!selectedCount}>Open Translation Lab</button>
            </div>
          </aside>
        </section>
      ) : null}

      <details className="inspector-drawer">
        <summary>Result Card Feed</summary>
        <div className="result-grid">
          {results.map((result, idx) => (
            <ResultCard key={resultKey(result, idx)} result={result} title={result.original_name} apiBase={apiBase} onSendToComposer={() => addToComposer(result, idx)} />
          ))}
        </div>
      </details>
    </section>
  );
}
