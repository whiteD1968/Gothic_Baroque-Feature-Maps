import Head from "next/head";
import { useMemo, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const MAP_KEYS = [
  "original",
  "edge_map",
  "shadow_depth_map",
  "flow_map",
  "node_map",
  "density_map",
  "symmetry_asymmetry_map",
  "deformation_map",
  "composite_map",
  "palette_quantized_map",
  "combinator_map",
];
const BLENDABLE_MAP_KEYS = [
  "edge_map",
  "shadow_depth_map",
  "flow_map",
  "node_map",
  "density_map",
  "symmetry_asymmetry_map",
  "deformation_map",
  "composite_map",
  "palette_quantized_map",
];
const TAGS = ["Gothic", "Baroque", "Mixed", "Custom"];
const PRESETS = {
  gothic_sensitive: { label: "Gothic-sensitive", edgeLow: 45, edgeHigh: 150, densityKernel: 7 },
  baroque_dense: { label: "Baroque-dense", edgeLow: 85, edgeHigh: 220, densityKernel: 13 },
  balanced_mixed: { label: "Balanced mixed", edgeLow: 70, edgeHigh: 180, densityKernel: 9 },
  custom: { label: "Custom", edgeLow: null, edgeHigh: null, densityKernel: null },
};
function fileToPreview(file) {
  return {
    id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`,
    file,
    tag: "Gothic",
    previewUrl: URL.createObjectURL(file),
  };
}

function mapLabel(key) {
  return key.replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function cardDomId(key) {
  return `result-card-${String(key).replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

export default function Home() {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [batchZip, setBatchZip] = useState("");
  const [top3Zip, setTop3Zip] = useState("");
  const [edgeLow, setEdgeLow] = useState(70);
  const [edgeHigh, setEdgeHigh] = useState(180);
  const [densityKernel, setDensityKernel] = useState(9);
  const [preset, setPreset] = useState("balanced_mixed");
  const [exportFormat, setExportFormat] = useState("jpg");
  const [paletteColors, setPaletteColors] = useState(4);
  const [blendA, setBlendA] = useState("edge_map");
  const [blendB, setBlendB] = useState("density_map");
  const [blendC, setBlendC] = useState("flow_map");
  const [blendWeightA, setBlendWeightA] = useState(50);
  const [blendWeightB, setBlendWeightB] = useState(30);
  const [blendWeightC, setBlendWeightC] = useState(20);
  const [mutationCount, setMutationCount] = useState(12);
  const [mutationJitter, setMutationJitter] = useState(0.2);
  const [selectedResultKeys, setSelectedResultKeys] = useState([]);
  const [crossMapA, setCrossMapA] = useState("edge_map");
  const [crossMapB, setCrossMapB] = useState("density_map");
  const [crossMapC, setCrossMapC] = useState("flow_map");
  const [crossWeightA, setCrossWeightA] = useState(40);
  const [crossWeightB, setCrossWeightB] = useState(35);
  const [crossWeightC, setCrossWeightC] = useState(25);
  const [crossPaletteColors, setCrossPaletteColors] = useState(4);
  const [crossTileRepeat, setCrossTileRepeat] = useState(2);
  const [crossResult, setCrossResult] = useState(null);
  const [crossLoading, setCrossLoading] = useState(false);

  const canRun = useMemo(() => items.length > 0 && !isLoading, [items, isLoading]);
  const onManualControl = (setter, value) => {
    setter(value);
    if (preset !== "custom") setPreset("custom");
  };

  const onSelectFiles = (event) => {
    const selected = Array.from(event.target.files || []);
    const mapped = selected.map(fileToPreview);
    setItems((prev) => [...prev, ...mapped]);
    event.target.value = "";
  };

  const updateTag = (id, tag) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, tag } : item)));
  };

  const removeItem = (id) => {
    setItems((prev) => {
      const next = prev.filter((p) => p.id !== id);
      const removed = prev.find((p) => p.id === id);
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return next;
    });
  };

  const applyPreset = (presetKey) => {
    setPreset(presetKey);
    const config = PRESETS[presetKey];
    if (!config) return;
    if (config.edgeLow !== null) setEdgeLow(config.edgeLow);
    if (config.edgeHigh !== null) setEdgeHigh(config.edgeHigh);
    if (config.densityKernel !== null) setDensityKernel(config.densityKernel);
  };

  const runExtraction = async (variantRun = false) => {
    setIsLoading(true);
    setResults([]);
    setBatchZip("");
    setTop3Zip("");
    setSelectedResultKeys([]);
    setCrossResult(null);
    try {
      const form = new FormData();
      items.forEach((item) => {
        form.append("files", item.file);
        form.append("tags", item.tag);
      });
      form.append("edge_threshold_low", String(edgeLow));
      form.append("edge_threshold_high", String(edgeHigh));
      form.append("density_kernel", String(densityKernel));
      form.append("preset", preset);
      form.append("export_format", exportFormat);
      form.append("palette_colors", String(paletteColors));
      form.append("blend_a", blendA);
      form.append("blend_b", blendB);
      form.append("blend_c", blendC);
      form.append("blend_weight_a", String(blendWeightA / 100));
      form.append("blend_weight_b", String(blendWeightB / 100));
      form.append("blend_weight_c", String(blendWeightC / 100));
      form.append("mutation_count", String(variantRun ? mutationCount : 1));
      form.append("mutation_jitter", String(mutationJitter));

      const response = await fetch(`${API_BASE}/api/process`, {
        method: "POST",
        body: form,
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Backend ${response.status}: ${detail || "Request failed"}`);
      }
      const data = await response.json();
      setResults(data.results || []);
      setBatchZip(`${API_BASE}${data.batch_zip}`);
      setTop3Zip(data.top3_zip ? `${API_BASE}${data.top3_zip}` : "");
    } catch (error) {
      const message = String(error?.message || "");
      if (message.includes("Failed to fetch")) {
        alert(`Cannot reach backend at ${API_BASE}. Start FastAPI on port 8000 or set NEXT_PUBLIC_API_URL.`);
      } else {
        alert(message || "Processing failed. Check backend server and inputs.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const copyDescription = async (text) => {
    await navigator.clipboard.writeText(text);
  };

  const resultKey = (result, idx) => `${result.original_name}-${idx}`;
  const scrollToResultCard = (key) => {
    const el = document.getElementById(cardDomId(key));
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const toggleResultSelection = (key) => {
    setSelectedResultKeys((prev) => {
      if (prev.includes(key)) return prev.filter((p) => p !== key);
      if (prev.length >= 3) return prev;
      return [...prev, key];
    });
  };

  const runCrossBlend = async () => {
    const selected = results
      .map((result, idx) => ({ result, idx, key: resultKey(result, idx) }))
      .filter((x) => selectedResultKeys.includes(x.key));
    if (selected.length < 2 || selected.length > 3) {
      alert("Select 2 or 3 result cards first.");
      return;
    }
    const mapKeys = [crossMapA, crossMapB, crossMapC];
    const mapWeights = [crossWeightA / 100, crossWeightB / 100, crossWeightC / 100];
    const sources = selected.map((s, i) => ({
      path: s.result?.maps?.[mapKeys[i]],
      weight: mapWeights[i],
      label: `${s.result.original_name} :: ${mapLabel(mapKeys[i])}`,
    }));
    if (sources.some((s) => !s.path)) {
      alert("One or more selected map paths are missing.");
      return;
    }

    setCrossLoading(true);
    setCrossResult(null);
    try {
      const response = await fetch(`${API_BASE}/api/cross-blend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sources,
          palette_colors: crossPaletteColors,
          tile_repeat: crossTileRepeat,
          export_format: exportFormat,
        }),
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Backend ${response.status}: ${detail || "Cross-blend failed"}`);
      }
      const data = await response.json();
      setCrossResult(data);
    } catch (error) {
      alert(String(error?.message || "Cross-blend failed."));
    } finally {
      setCrossLoading(false);
    }
  };

  const selectedGraphNodes = results
    .map((result, idx) => ({ result, idx, key: resultKey(result, idx) }))
    .filter((x) => selectedResultKeys.includes(x.key));
  const graphMapKeys = [crossMapA, crossMapB, crossMapC];

  return (
    <>
      <Head>
        <title>Gothic_Baroque Feature Mapper</title>
        <meta name="description" content="Gothic / Baroque Feature Extraction Tool" />
      </Head>
      <main className="page">
        <section className="panel upload">
          <h1>Gothic / Baroque Feature Extraction Tool</h1>
          <p className="sub">Historical image database -&gt; feature extraction -&gt; abstract maps -&gt; AI image references</p>
          <label className="fileBtn">
            Upload JPG, PNG, WEBP
            <input type="file" accept=".jpg,.jpeg,.png,.webp" multiple onChange={onSelectFiles} />
          </label>
        </section>

        <section className="panel controls">
          <h2>Feature Controls</h2>
          <div className="presetRow">
            {Object.entries(PRESETS).map(([key, cfg]) => (
              <button
                key={key}
                className={preset === key ? "activePreset" : ""}
                onClick={() => applyPreset(key)}
                type="button"
              >
                {cfg.label}
              </button>
            ))}
          </div>
          <div className="sliderRow">
            <label>Edge Threshold Low: {edgeLow}</label>
            <input type="range" min="10" max="200" value={edgeLow} onChange={(e) => onManualControl(setEdgeLow, Number(e.target.value))} />
          </div>
          <div className="sliderRow">
            <label>Edge Threshold High: {edgeHigh}</label>
            <input type="range" min="50" max="300" value={edgeHigh} onChange={(e) => onManualControl(setEdgeHigh, Number(e.target.value))} />
          </div>
          <div className="sliderRow">
            <label>Density Kernel: {densityKernel}</label>
            <input type="range" min="3" max="21" step="2" value={densityKernel} onChange={(e) => onManualControl(setDensityKernel, Number(e.target.value))} />
          </div>
          <div className="sliderRow">
            <label>Export Format</label>
            <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value)}>
              <option value="jpg">JPG</option>
              <option value="png">PNG</option>
            </select>
          </div>
          <div className="sliderRow">
            <label>Palette Quantization Colors: {paletteColors}</label>
            <input type="range" min="3" max="8" step="1" value={paletteColors} onChange={(e) => setPaletteColors(Number(e.target.value))} />
          </div>
          <div className="blendGrid">
            <div className="sliderRow">
              <label>Combinator Map A</label>
              <select value={blendA} onChange={(e) => setBlendA(e.target.value)}>
                {BLENDABLE_MAP_KEYS.map((key) => <option key={key} value={key}>{mapLabel(key)}</option>)}
              </select>
              <label>Weight A: {blendWeightA}%</label>
              <input type="range" min="0" max="100" value={blendWeightA} onChange={(e) => setBlendWeightA(Number(e.target.value))} />
            </div>
            <div className="sliderRow">
              <label>Combinator Map B</label>
              <select value={blendB} onChange={(e) => setBlendB(e.target.value)}>
                {BLENDABLE_MAP_KEYS.map((key) => <option key={key} value={key}>{mapLabel(key)}</option>)}
              </select>
              <label>Weight B: {blendWeightB}%</label>
              <input type="range" min="0" max="100" value={blendWeightB} onChange={(e) => setBlendWeightB(Number(e.target.value))} />
            </div>
            <div className="sliderRow">
              <label>Combinator Map C</label>
              <select value={blendC} onChange={(e) => setBlendC(e.target.value)}>
                {BLENDABLE_MAP_KEYS.map((key) => <option key={key} value={key}>{mapLabel(key)}</option>)}
              </select>
              <label>Weight C: {blendWeightC}%</label>
              <input type="range" min="0" max="100" value={blendWeightC} onChange={(e) => setBlendWeightC(Number(e.target.value))} />
            </div>
          </div>
          <div className="sliderRow">
            <label>Variant Count (for mutation run): {mutationCount}</label>
            <input type="range" min="2" max="30" step="1" value={mutationCount} onChange={(e) => setMutationCount(Number(e.target.value))} />
          </div>
          <div className="sliderRow">
            <label>Mutation Jitter: {mutationJitter.toFixed(2)}</label>
            <input type="range" min="0" max="1" step="0.05" value={mutationJitter} onChange={(e) => setMutationJitter(Number(e.target.value))} />
          </div>
          <div className="presetRow">
            <button disabled={!canRun} onClick={() => runExtraction(false)}>{isLoading ? "Processing..." : "Run Feature Extraction"}</button>
            <button disabled={!canRun} onClick={() => runExtraction(true)}>{isLoading ? "Processing..." : `Generate ${mutationCount} Variants`}</button>
          </div>
        </section>

        <section className="panel gallery">
          <h2>Image Gallery</h2>
          <div className="thumbGrid">
            {items.map((item) => (
              <article key={item.id} className="thumbCard">
                <img src={item.previewUrl} alt={item.file.name} />
                <div className="thumbMeta">
                  <span>{item.file.name}</span>
                  <select value={item.tag} onChange={(e) => updateTag(item.id, e.target.value)}>
                    {TAGS.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
                  </select>
                  <button onClick={() => removeItem(item.id)}>Remove</button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="panel results">
          <h2>Results Panel</h2>
          {batchZip && (
            <div className="presetRow">
              <a className="zipLink" href={batchZip} target="_blank" rel="noreferrer">
                Download Batch ZIP ({exportFormat.toUpperCase()})
              </a>
              {top3Zip && (
                <a className="zipLink" href={top3Zip} target="_blank" rel="noreferrer">
                  Download Top 3 ZIP
                </a>
              )}
            </div>
          )}
          {results.map((result, idx) => (
            <article
              id={cardDomId(resultKey(result, idx))}
              className={`resultCard ${result.variant?.is_top3 ? "topRank" : ""}`}
              key={`${result.original_name}-${idx}`}
            >
              <header>
                <h3>{result.original_name} ({result.tag})</h3>
                <label className="pickLabel">
                  <input
                    type="checkbox"
                    checked={selectedResultKeys.includes(resultKey(result, idx))}
                    onChange={() => toggleResultSelection(resultKey(result, idx))}
                  />
                  Select For Cross-Blend
                </label>
                {result.variant && (
                  <p className="sub">
                    Rank #{result.variant.rank}/{result.variant.variant_count} | Score {result.variant.fitness_score}
                    {result.variant.is_top3 ? " | Top 3" : ""}
                    {result.variant.is_base ? " | Base" : ""}
                    {" | "}Edge {result.variant.edge_threshold_low}/{result.variant.edge_threshold_high}
                    {" | "}Density {result.variant.density_kernel}
                    {" | "}Palette {result.variant.palette_colors}
                    {" | "}Weights {result.variant.blend_weight_a}/{result.variant.blend_weight_b}/{result.variant.blend_weight_c}
                  </p>
                )}
              </header>
              <div className="mapsGrid">
                {[...MAP_KEYS, ...Object.keys(result.maps || {}).filter((key) => !MAP_KEYS.includes(key))].filter((key) => Boolean(result.maps?.[key])).map((key) => {
                  const fullPath = `${API_BASE}/api/download/file?path=${encodeURIComponent(result.maps[key])}`;
                  return (
                    <figure key={key}>
                      <img src={fullPath} alt={key} />
                      <figcaption>{mapLabel(key)}</figcaption>
                      <a href={fullPath} target="_blank" rel="noreferrer">Download</a>
                    </figure>
                  );
                })}
              </div>
              <div className="descriptionBlock">
                <textarea value={result.description} readOnly rows={3} />
                <button onClick={() => copyDescription(result.description)}>Copy Trait Description</button>
              </div>
              {result.midjourney && (
                <div className="descriptionBlock">
                  <h4>Midjourney Prompt Export</h4>
                  <textarea value={result.midjourney.short_prompt} readOnly rows={2} />
                  <button onClick={() => copyDescription(result.midjourney.short_prompt)}>Copy Short Prompt</button>
                  <textarea value={result.midjourney.long_prompt} readOnly rows={4} />
                  <button onClick={() => copyDescription(result.midjourney.long_prompt)}>Copy Long Prompt</button>
                  <textarea value={result.midjourney.params} readOnly rows={2} />
                  <button onClick={() => copyDescription(result.midjourney.params)}>Copy Params</button>
                  <textarea value={result.midjourney.full_prompt} readOnly rows={5} />
                  <button onClick={() => copyDescription(result.midjourney.full_prompt)}>Copy Full Prompt</button>
                </div>
              )}
            </article>
          ))}
        </section>

        <section className="panel results">
          <h2>Cross-Reference Composer</h2>
          <p className="sub">
            Select 2-3 result cards above, then assign map roles and generate a new cross-referenced image set.
          </p>
          <div className="blendGrid">
            <div className="sliderRow">
              <label>Selected #1 Map</label>
              <select value={crossMapA} onChange={(e) => setCrossMapA(e.target.value)}>
                {BLENDABLE_MAP_KEYS.map((key) => <option key={key} value={key}>{mapLabel(key)}</option>)}
              </select>
              <label>Weight #1: {crossWeightA}%</label>
              <input type="range" min="0" max="100" value={crossWeightA} onChange={(e) => setCrossWeightA(Number(e.target.value))} />
            </div>
            <div className="sliderRow">
              <label>Selected #2 Map</label>
              <select value={crossMapB} onChange={(e) => setCrossMapB(e.target.value)}>
                {BLENDABLE_MAP_KEYS.map((key) => <option key={key} value={key}>{mapLabel(key)}</option>)}
              </select>
              <label>Weight #2: {crossWeightB}%</label>
              <input type="range" min="0" max="100" value={crossWeightB} onChange={(e) => setCrossWeightB(Number(e.target.value))} />
            </div>
            <div className="sliderRow">
              <label>Selected #3 Map (used when 3 items selected)</label>
              <select value={crossMapC} onChange={(e) => setCrossMapC(e.target.value)}>
                {BLENDABLE_MAP_KEYS.map((key) => <option key={key} value={key}>{mapLabel(key)}</option>)}
              </select>
              <label>Weight #3: {crossWeightC}%</label>
              <input type="range" min="0" max="100" value={crossWeightC} onChange={(e) => setCrossWeightC(Number(e.target.value))} />
            </div>
          </div>
          <div className="blendGrid">
            <div className="sliderRow">
              <label>Cross Palette Colors: {crossPaletteColors}</label>
              <input type="range" min="3" max="8" step="1" value={crossPaletteColors} onChange={(e) => setCrossPaletteColors(Number(e.target.value))} />
            </div>
            <div className="sliderRow">
              <label>Tile Repeat: {crossTileRepeat}</label>
              <input type="range" min="2" max="4" step="1" value={crossTileRepeat} onChange={(e) => setCrossTileRepeat(Number(e.target.value))} />
            </div>
          </div>
          <button onClick={runCrossBlend} disabled={crossLoading || selectedResultKeys.length < 2 || selectedResultKeys.length > 3}>
            {crossLoading ? "Generating..." : "Generate Cross-Reference Maps"}
          </button>

          <div className="graphPanel">
            <h4>Lineage Graph</h4>
            <div className="graphRow">
              {selectedGraphNodes.length === 0 && (
                <div className="graphHint">Select 2-3 result cards above to build a cross-reference lineage.</div>
              )}
              {selectedGraphNodes.map((node, i) => (
                <button
                  key={node.key}
                  className="graphNode sourceNode"
                  type="button"
                  onClick={() => scrollToResultCard(node.key)}
                  title="Jump to source result card"
                >
                  <div className="graphTitle">Source #{i + 1}</div>
                  <div className="graphText">{node.result.original_name}</div>
                  <div className="graphText">{mapLabel(graphMapKeys[i] || crossMapA)}</div>
                </button>
              ))}
            </div>
            {selectedGraphNodes.length > 0 && (
              <div className="graphFlow">+</div>
            )}
            {selectedGraphNodes.length > 0 && (
              <div className="graphRow">
                <div className="graphNode blendNode">
                  <div className="graphTitle">Cross-Blend Node</div>
                  <div className="graphText">Palette: {crossPaletteColors} colors</div>
                  <div className="graphText">Tile: {crossTileRepeat}x</div>
                  <div className="graphText">Weights: {crossWeightA}/{crossWeightB}/{crossWeightC}</div>
                </div>
              </div>
            )}
            {crossResult && (
              <>
                <div className="graphArrow">↓</div>
                <div className="graphRow">
                  <div className="graphNode outputNode">
                    <div className="graphTitle">Generated References</div>
                    <div className="graphText">Cross Blend Map</div>
                    <div className="graphText">Quantized Pattern Map</div>
                    <div className="graphText">Tiled Pattern Map</div>
                  </div>
                </div>
              </>
            )}
          </div>

          {crossResult && (
            <div className="descriptionBlock">
              {crossResult.zip && (
                <a className="zipLink" href={`${API_BASE}${crossResult.zip}`} target="_blank" rel="noreferrer">
                  Download Cross-Blend ZIP
                </a>
              )}
              <div className="mapsGrid">
                {Object.keys(crossResult.maps || {}).map((key) => {
                  const fullPath = `${API_BASE}/api/download/file?path=${encodeURIComponent(crossResult.maps[key])}`;
                  return (
                    <figure key={key}>
                      <img src={fullPath} alt={key} />
                      <figcaption>{mapLabel(key)}</figcaption>
                      <a href={fullPath} target="_blank" rel="noreferrer">Download</a>
                    </figure>
                  );
                })}
              </div>
              {crossResult.midjourney && (
                <div className="descriptionBlock">
                  <h4>Cross-Blend Midjourney Prompt Export</h4>
                  <textarea value={crossResult.midjourney.short_prompt} readOnly rows={2} />
                  <button onClick={() => copyDescription(crossResult.midjourney.short_prompt)}>Copy Short Prompt</button>
                  <textarea value={crossResult.midjourney.long_prompt} readOnly rows={4} />
                  <button onClick={() => copyDescription(crossResult.midjourney.long_prompt)}>Copy Long Prompt</button>
                  <textarea value={crossResult.midjourney.params} readOnly rows={2} />
                  <button onClick={() => copyDescription(crossResult.midjourney.params)}>Copy Params</button>
                  <textarea value={crossResult.midjourney.full_prompt} readOnly rows={5} />
                  <button onClick={() => copyDescription(crossResult.midjourney.full_prompt)}>Copy Full Prompt</button>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
