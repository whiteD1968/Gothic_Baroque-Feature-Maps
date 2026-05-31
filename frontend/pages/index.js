import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/ui/Sidebar";
import TabWorkspace from "../components/ui/TabWorkspace";
import UploadZone from "../components/ui/UploadZone";
import ImageCard from "../components/ui/ImageCard";
import PresetCard from "../components/ui/PresetCard";
import ControlCard from "../components/ui/ControlCard";
import ResultCard from "../components/ui/ResultCard";
import ComposerBoard from "../components/ui/ComposerBoard";
import LineageGraph from "../components/ui/LineageGraph";
import ExportPanel from "../components/ui/ExportPanel";
import { BLENDABLE_MAP_KEYS, PRESETS, fileToPreview, mapLabel, resultKey } from "../components/ui/constants";

const ENV_API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
const API_CANDIDATES = [ENV_API_BASE, "http://127.0.0.1:8000", "http://localhost:8000"].filter(
  (value, idx, arr) => Boolean(value) && arr.indexOf(value) === idx,
);

export default function Home() {
  const [activeTab, setActiveTab] = useState("Library");
  const [items, setItems] = useState([]);
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
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

  const [sourceSlots, setSourceSlots] = useState([null, null, null]);
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
  const [apiBase, setApiBase] = useState(API_CANDIDATES[0] || "http://127.0.0.1:8000");
  const [backendStatus, setBackendStatus] = useState({
    online: false,
    label: "Checking connection...",
  });

  const [collapsed, setCollapsed] = useState({ detection: false, styling: false, mutation: false });
  const slotNodes = sourceSlots;
  const selectedCount = useMemo(() => sourceSlots.filter(Boolean).length, [sourceSlots]);

  const datasetStats = useMemo(() => {
    const mapCount = results.reduce((sum, result) => sum + Object.keys(result.maps || {}).length, 0);
    return { images: items.length, maps: mapCount, composites: crossResult ? 1 : 0 };
  }, [items, results, crossResult]);

  const onSelectFiles = (event) => {
    const selected = Array.from(event.target.files || []);
    setItems((prev) => [...prev, ...selected.map(fileToPreview)]);
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
    if (!backendStatus.online) {
      alert(`Backend is offline at ${apiBase}. Start FastAPI on port 8000, then click Retry now.`);
      return;
    }
    setIsLoading(true);
    setResults([]);
    setBatchZip("");
    setTop3Zip("");
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

      const response = await fetch(`${apiBase}/api/process`, { method: "POST", body: form });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Backend ${response.status}: ${detail || "Request failed"}`);
      }
      const data = await response.json();
      setResults(data.results || []);
      setBatchZip(`${apiBase}${data.batch_zip}`);
      setTop3Zip(data.top3_zip ? `${apiBase}${data.top3_zip}` : "");
      setActiveTab("Feature Maps");
    } catch (error) {
      const message = String(error?.message || "");
      if (message.includes("Failed to fetch")) {
        alert(`Cannot reach backend at ${apiBase}. Start FastAPI on port 8000 or set NEXT_PUBLIC_API_URL.`);
      } else {
        alert(message || "Processing failed. Check backend server and inputs.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const addToComposer = (result, idx) => {
    const key = resultKey(result, idx);
    setSourceSlots((prev) => {
      if (prev.some((slot) => slot?.key === key)) return prev;
      const next = [...prev];
      const slotIdx = next.findIndex((value) => !value);
      if (slotIdx !== -1) next[slotIdx] = { key, result };
      return next;
    });
  };

  const runCrossBlend = async () => {
    const selected = sourceSlots.filter(Boolean);
    if (selected.length < 2 || selected.length > 3) {
      alert("Select 2 or 3 sources in Composer first.");
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
      const response = await fetch(`${apiBase}/api/cross-blend`, {
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
      setActiveTab("Export");
    } catch (error) {
      alert(String(error?.message || "Cross-blend failed."));
    } finally {
      setCrossLoading(false);
    }
  };

  const promptSummary = useMemo(() => {
    if (!results.length) return "No generated prompt summary yet.";
    const latest = results[0];
    return latest.midjourney?.full_prompt || latest.description || "Prompt unavailable.";
  }, [results]);

  const checkBackendHealth = async () => {
    for (const candidate of API_CANDIDATES) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2500);
        const response = await fetch(`${candidate}/health`, { cache: "no-store", signal: controller.signal });
        clearTimeout(timeout);
        if (!response.ok) continue;
        setApiBase(candidate);
        setBackendStatus({
          online: true,
          label: `Connected: ${candidate}`,
        });
        return;
      } catch (_error) {
        // Try next candidate.
      }
    }
    setBackendStatus({
      online: false,
      label: "No backend found. Start: npm run dev:backend",
    });
  };

  useEffect(() => {
    checkBackendHealth();
    const interval = setInterval(checkBackendHealth, 10000);
    return () => {
      clearInterval(interval);
    };
  }, []);

  return (
    <>
      <Head>
        <title>Gothic_Baroque Feature Mapper</title>
        <meta name="description" content="Gothic / Baroque Feature Extraction Tool" />
      </Head>
      <main className="app-shell">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          stats={datasetStats}
          backendStatus={backendStatus}
          onRetryBackend={checkBackendHealth}
        />

        <TabWorkspace activeTab={activeTab}>
          {activeTab === "Library" && (
            <section className="tab-panel">
              <section className="intro-copy glass-panel">
                <h2>Feature Extraction + Graphic Translation Lab</h2>
                <p>
                  This tool treats historical architecture as a database of latent spatial, ornamental, and structural
                  features. It extracts architectural intelligence from Gothic and Baroque precedents and translates
                  those features into abstract visual references for AI-assisted design, digital spolia, computational
                  craft, and material fabrication workflows.
                </p>
              </section>
              <UploadZone onSelectFiles={onSelectFiles} />
              <div className="panel-head">
                <h2>Library</h2>
                <button type="button" onClick={() => runExtraction(false)} disabled={!items.length || isLoading || !backendStatus.online}>
                  {isLoading ? "Analyzing..." : "Analyze Library"}
                </button>
              </div>
              <div className="gallery-grid">
                {items.map((item) => (
                  <ImageCard
                    key={item.id}
                    item={item}
                    onTagChange={updateTag}
                    onRemove={removeItem}
                    onAnalyze={() => runExtraction(false)}
                    analyzeDisabled={!backendStatus.online || isLoading}
                    onView={() => window.open(item.previewUrl, "_blank", "noopener,noreferrer")}
                  />
                ))}
              </div>
            </section>
          )}

          {activeTab === "Feature Maps" && (
            <section className="tab-panel">
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
                <button type="button" onClick={() => setActiveTab("Composer")} disabled={!selectedCount}>
                  Open Composer
                </button>
              </div>

              <div className="controls-grid">
                <ControlCard
                  title="Detection Settings"
                  collapsed={collapsed.detection}
                  onToggle={() => setCollapsed((prev) => ({ ...prev, detection: !prev.detection }))}
                >
                  <label>Edge Low {edgeLow}</label>
                  <input type="range" min="10" max="200" value={edgeLow} onChange={(e) => { setEdgeLow(Number(e.target.value)); setPreset("custom"); }} />
                  <label>Edge High {edgeHigh}</label>
                  <input type="range" min="50" max="300" value={edgeHigh} onChange={(e) => { setEdgeHigh(Number(e.target.value)); setPreset("custom"); }} />
                  <label>Density Kernel {densityKernel}</label>
                  <input type="range" min="3" max="21" step="2" value={densityKernel} onChange={(e) => { setDensityKernel(Number(e.target.value)); setPreset("custom"); }} />
                </ControlCard>

                <ControlCard
                  title="Map Styling"
                  collapsed={collapsed.styling}
                  onToggle={() => setCollapsed((prev) => ({ ...prev, styling: !prev.styling }))}
                >
                  <label>Palette Colors {paletteColors}</label>
                  <input type="range" min="3" max="8" value={paletteColors} onChange={(e) => setPaletteColors(Number(e.target.value))} />
                  <label>Blend A</label>
                  <select value={blendA} onChange={(e) => setBlendA(e.target.value)}>{BLENDABLE_MAP_KEYS.map((key) => <option key={key} value={key}>{mapLabel(key)}</option>)}</select>
                  <label>Blend B</label>
                  <select value={blendB} onChange={(e) => setBlendB(e.target.value)}>{BLENDABLE_MAP_KEYS.map((key) => <option key={key} value={key}>{mapLabel(key)}</option>)}</select>
                  <label>Blend C</label>
                  <select value={blendC} onChange={(e) => setBlendC(e.target.value)}>{BLENDABLE_MAP_KEYS.map((key) => <option key={key} value={key}>{mapLabel(key)}</option>)}</select>
                </ControlCard>

                <ControlCard
                  title="Mutation"
                  collapsed={collapsed.mutation}
                  onToggle={() => setCollapsed((prev) => ({ ...prev, mutation: !prev.mutation }))}
                >
                  <label>Weight A {blendWeightA}%</label>
                  <input type="range" min="0" max="100" value={blendWeightA} onChange={(e) => setBlendWeightA(Number(e.target.value))} />
                  <label>Weight B {blendWeightB}%</label>
                  <input type="range" min="0" max="100" value={blendWeightB} onChange={(e) => setBlendWeightB(Number(e.target.value))} />
                  <label>Weight C {blendWeightC}%</label>
                  <input type="range" min="0" max="100" value={blendWeightC} onChange={(e) => setBlendWeightC(Number(e.target.value))} />
                  <label>Mutation Count {mutationCount}</label>
                  <input type="range" min="2" max="30" value={mutationCount} onChange={(e) => setMutationCount(Number(e.target.value))} />
                  <label>Mutation Jitter {mutationJitter.toFixed(2)}</label>
                  <input type="range" min="0" max="1" step="0.05" value={mutationJitter} onChange={(e) => setMutationJitter(Number(e.target.value))} />
                  <button type="button" onClick={() => runExtraction(true)} disabled={!items.length || isLoading || !backendStatus.online}>
                    {isLoading ? "Processing..." : "Generate Variants"}
                  </button>
                </ControlCard>
              </div>

              <div className="result-grid">
                {results.map((result, idx) => (
                  <ResultCard
                    key={resultKey(result, idx)}
                    result={result}
                    title={result.original_name}
                    apiBase={apiBase}
                    onSendToComposer={() => addToComposer(result, idx)}
                  />
                ))}
              </div>
            </section>
          )}

          {activeTab === "Composer" && (
            <section className="tab-panel">
              <ComposerBoard
                slots={slotNodes}
                slotMaps={[crossMapA, crossMapB, crossMapC]}
                slotWeights={[crossWeightA, crossWeightB, crossWeightC]}
                setSlotMap={(idx, value) => {
                  if (idx === 0) setCrossMapA(value);
                  if (idx === 1) setCrossMapB(value);
                  if (idx === 2) setCrossMapC(value);
                }}
                setSlotWeight={(idx, value) => {
                  if (idx === 0) setCrossWeightA(value);
                  if (idx === 1) setCrossWeightB(value);
                  if (idx === 2) setCrossWeightC(value);
                }}
                onClearSlot={(idx) => setSourceSlots((prev) => prev.map((value, i) => (i === idx ? null : value)))}
                onGenerateVariants={() => runExtraction(true)}
                onCrossReference={runCrossBlend}
                crossLoading={crossLoading}
              />
              <section className="preview-panel glass-panel">
                <h3>Composite Preview</h3>
                {crossResult?.maps ? (
                  <img
                    src={`${apiBase}/api/download/file?path=${encodeURIComponent(crossResult.maps.cross_blend_map || Object.values(crossResult.maps)[0])}`}
                    alt="Composite preview"
                  />
                ) : (
                  <p className="muted">Generate cross-reference maps to preview composite output.</p>
                )}
              </section>
              <LineageGraph slots={slotNodes} crossResult={crossResult} />
            </section>
          )}

          {activeTab === "Export" && (
            <section className="tab-panel">
              <ExportPanel
                exportFormat={exportFormat}
                setExportFormat={setExportFormat}
                batchZip={batchZip}
                top3Zip={top3Zip}
                crossResult={crossResult}
                promptSummary={promptSummary}
              />
            </section>
          )}
        </TabWorkspace>
      </main>
    </>
  );
}
