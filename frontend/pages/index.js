import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/ui/Sidebar";
import TabWorkspace from "../components/ui/TabWorkspace";
import ArchiveTab from "../components/ArchiveTab";
import ExtractionTab from "../components/ExtractionTab";
import TranslationTab from "../components/TranslationTab";
import BlendLabTab from "../components/BlendLabTab";
import PatternProjectionLab from "../components/PatternProjectionLab";
import ProjectionTab from "../components/ProjectionTab";
import ExportTab from "../components/ExportTab";
import LineageGraph from "../components/LineageGraph";
import { BLENDABLE_MAP_KEYS, PRESETS, fileToPreview, mapLabel, resultKey } from "../components/ui/constants";
import { buildOutputRecord } from "../lib/exportUtils";
import { applyAbstraction, generateMutations } from "../lib/hybridAbstractionUtils";
import {
  downloadDataUrl,
  downloadText,
  exportContourSvg,
  exportDensityCsv,
  exportNodeCsv,
  exportPaletteJson,
  exportRegionSvg,
  imageDataToCanvas,
} from "../lib/grasshopperExportUtils";

const ENV_API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
const API_CANDIDATES = [ENV_API_BASE, "http://127.0.0.1:8000", "http://localhost:8000"].filter(
  (value, idx, arr) => Boolean(value) && arr.indexOf(value) === idx,
);

export default function Home() {
  const [activeTab, setActiveTab] = useState("Archive");
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
  const [generatedOutputs, setGeneratedOutputs] = useState([]);
  const [selectedOutputId, setSelectedOutputId] = useState("");
  const [backendStatus, setBackendStatus] = useState({
    online: false,
    label: "Checking connection...",
  });
  const [manualBackendOnline, setManualBackendOnline] = useState(false);
  const [sourceA, setSourceA] = useState(null);
  const [sourceB, setSourceB] = useState(null);
  const [sourceCropA, setSourceCropA] = useState({ x: 0, y: 0, w: 1, h: 1 });
  const [sourceCropB, setSourceCropB] = useState({ x: 0, y: 0, w: 1, h: 1 });
  const [tagA, setTagA] = useState("Gothic");
  const [tagB, setTagB] = useState("Baroque");
  const [selectionTool, setSelectionTool] = useState("brush mask");
  const [blendSelectionTarget, setBlendSelectionTarget] = useState("A");
  const [feather, setFeather] = useState(0.2);
  const [brushSize, setBrushSize] = useState(24);
  const [eraseTransparency, setEraseTransparency] = useState(100);
  const [blendMode, setBlendMode] = useState("opacity blend");
  const [blendOpacity, setBlendOpacity] = useState(0.5);
  const [abstractionMode, setAbstractionMode] = useState("Hybrid Linework Plate");
  const [blendPreset, setBlendPreset] = useState("Gothic Rib Logic");
  const [roleAssignment, setRoleAssignment] = useState({
    edge: "A",
    density: "B",
    flow: "A",
    shadow: "B",
    node: "A",
    symmetry: "B",
    texture: "B",
  });
  const [featureWeights, setFeatureWeights] = useState({
    edge: 0.9,
    density: 0.7,
    flow: 0.6,
    shadow: 0.5,
    node: 0.8,
    symmetry: 0.4,
    texture: 0.45,
  });
  const [mutationCountBlend, setMutationCountBlend] = useState(9);
  const [blendMutations, setBlendMutations] = useState([]);
  const [blendHybridPreview, setBlendHybridPreview] = useState("");
  const [blendHybridData, setBlendHybridData] = useState(null);
  const [blendTransform, setBlendTransform] = useState({ x: 0, y: 0, rotation: 0, scale: 1 });
  const [blendRegionFx, setBlendRegionFx] = useState({
    blur: 0,
    pixelate: 1,
    glitch: 0,
    smudge: 0,
    gloom: 0,
    fragmentJitter: 0,
    sourceBInfluence: 0.55,
    useSourceBPatch: true,
    enableAbstractionPreview: true,
    blendIf: "all",
    colorMode: "preserve",
    colorShift: 0.25,
    gradientLower: 0.1,
    gradientUpper: 0.9,
    gradientStops: ["#ff8a00", "#ffd400", "#7ed321", "#35c759", "#0a84ff"],
  });
  const [blendLineage, setBlendLineage] = useState(null);
  const [blendClearTick, setBlendClearTick] = useState(0);
  const [blendInvertTick, setBlendInvertTick] = useState(0);
  const [blendPolygonUndoTick, setBlendPolygonUndoTick] = useState(0);
  const [blendPolygonCloseTick, setBlendPolygonCloseTick] = useState(0);
  const [blendContourSimplify, setBlendContourSimplify] = useState(3);
  const [blendApplyTick, setBlendApplyTick] = useState(0);
  const [blendDeselectTick, setBlendDeselectTick] = useState(0);
  const [blendDeleteTick, setBlendDeleteTick] = useState(0);
  const [blendUndoTick, setBlendUndoTick] = useState(0);
  const [blendRedoTick, setBlendRedoTick] = useState(0);
  const [blendResetTick, setBlendResetTick] = useState(0);

  const [collapsed, setCollapsed] = useState({ detection: false, styling: false, mutation: false });
  const slotNodes = sourceSlots;
  const selectedCount = useMemo(() => sourceSlots.filter(Boolean).length, [sourceSlots]);
  const extractionOutputs = ["Edge Map", "Shadow / Depth Map", "Flow Map", "Node Map", "Density Map", "Composite Map"];
  const translationOutputs = [
    "Taxonomy / Lineage Board",
    "Hybrid Linework Plate",
    "Pattern Mutation Sheet",
    "Field Condition Map",
    "MidJourney Reference Board",
  ];
  const projectionSurfaces = [
    "planar tile",
    "vault patch",
    "stereotomic block",
    "column fragment",
    "minimal surface patch",
  ];

  const datasetStats = useMemo(() => {
    const mapCount = results.reduce((sum, result) => sum + Object.keys(result.maps || {}).length, 0);
    return { images: items.length, maps: mapCount, composites: crossResult ? 1 : generatedOutputs.length };
  }, [items, results, crossResult, generatedOutputs.length]);
  const dockLineage = useMemo(() => {
    const selected = generatedOutputs.find((item) => item.id === selectedOutputId) || generatedOutputs[0] || null;
    return selected?.metadata?.lineage || null;
  }, [generatedOutputs, selectedOutputId]);

  const registerGeneratedOutput = (payload) => {
    const output = buildOutputRecord(payload);
    setGeneratedOutputs((prev) => [output, ...prev]);
    setSelectedOutputId(output.id);
  };

  const updateBlendLineage = (overrides = {}) => {
    const channels = Object.entries(roleAssignment).map(([k, v]) => `${k}:${v}`).join(", ");
    const weights = Object.entries(featureWeights).map(([k, v]) => `${k}:${v.toFixed(2)}`).join(", ");
    setBlendLineage({
      sourceA: sourceA?.name || "Source A",
      sourceB: sourceB?.name || "Source B",
      selectionTool,
      channels,
      blendMode,
      region_fx: blendRegionFx,
      weights,
      abstractionMode,
      mutation: `${mutationCountBlend} variants`,
      exportType: overrides.exportType || "Pending",
    });
  };

  const applyBlendPreset = (name) => {
    setBlendPreset(name);
    if (name === "Gothic Rib Logic") {
      setBlendMode("edge-transfer");
      setAbstractionMode("Hybrid Linework Plate");
      setFeatureWeights((p) => ({ ...p, edge: 1, node: 0.9, flow: 0.65 }));
    } else if (name === "Baroque Swell Logic") {
      setBlendMode("field merge");
      setAbstractionMode("Field Condition Map");
      setFeatureWeights((p) => ({ ...p, shadow: 1, flow: 0.9, density: 0.85 }));
    } else if (name === "Monochrome Ink") {
      setBlendMode("contour fusion");
      setAbstractionMode("Contour / Hatch Drawing");
    } else if (name === "MidJourney Board") {
      setBlendMode("pattern crossbreed");
      setAbstractionMode("MidJourney Reference Board");
    }
    updateBlendLineage();
  };

  const onBlendHybridReady = ({ imageData, preview }) => {
    setBlendHybridData(imageData);
    const abstracted = applyAbstraction(imageData, abstractionMode);
    setBlendHybridPreview(imageDataToCanvas(abstracted).toDataURL("image/png", 0.95));
    updateBlendLineage();
  };

  const onGenerateBlendMutations = () => {
    if (!blendHybridData) return;
    const variants = generateMutations(blendHybridData, mutationCountBlend);
    const urls = variants.map((img) => imageDataToCanvas(img).toDataURL("image/png", 0.95));
    setBlendMutations(urls);
    registerGeneratedOutput({
      kind: "blend-lab",
      title: "Blend Mutation Sheet",
      previewUrl: urls[0],
      metadata: { lineage: { ...(blendLineage || {}), mutation: `${mutationCountBlend} variants` } },
    });
    updateBlendLineage();
  };

  const onBlendExport = (format) => {
    if (!blendHybridData) return;
    const canvas = imageDataToCanvas(blendHybridData);
    if (format === "PNG") downloadDataUrl(`blend-hybrid.${"png"}`, canvas.toDataURL("image/png", 0.95));
    if (format === "JPG") downloadDataUrl(`blend-hybrid.${"jpg"}`, canvas.toDataURL("image/jpeg", 0.95));
    if (format === "SVG contour lines") downloadText("blend-contours.svg", exportContourSvg(blendHybridData, 128, blendContourSimplify), "image/svg+xml");
    if (format === "SVG region boundaries") downloadText("blend-regions.svg", exportRegionSvg(blendHybridData), "image/svg+xml");
    if (format === "grayscale heightmap") {
      const gray = applyAbstraction(blendHybridData, "Contour / Hatch Drawing");
      downloadDataUrl("blend-heightmap.png", imageDataToCanvas(gray).toDataURL("image/png", 0.95));
    }
    if (format === "node coordinate CSV") downloadText("blend-nodes.csv", exportNodeCsv(blendHybridData), "text/csv");
    if (format === "JSON metadata") downloadText("blend-lineage.json", JSON.stringify(blendLineage || {}, null, 2), "application/json");
    if (format === "color palette JSON") downloadText("blend-palette.json", exportPaletteJson(blendHybridData), "application/json");
    if (format === "density grid CSV") downloadText("blend-density-grid.csv", exportDensityCsv(blendHybridData), "text/csv");
    updateBlendLineage({ exportType: format });
  };

  const resetBlendLabTools = () => {
    setSelectionTool("brush mask");
    setBlendSelectionTarget("A");
    setFeather(0.2);
    setBrushSize(24);
    setEraseTransparency(100);
    setBlendMode("opacity blend");
    setBlendOpacity(0.5);
    setAbstractionMode("Hybrid Linework Plate");
    setBlendTransform({ x: 0, y: 0, rotation: 0, scale: 1 });
    setBlendRegionFx({
      blur: 0,
      pixelate: 1,
      glitch: 0,
      smudge: 0,
      gloom: 0,
      fragmentJitter: 0,
      sourceBInfluence: 0.55,
      useSourceBPatch: true,
      enableAbstractionPreview: true,
      blendIf: "all",
      colorMode: "preserve",
      colorShift: 0.25,
      gradientLower: 0.1,
      gradientUpper: 0.9,
      gradientStops: ["#ff8a00", "#ffd400", "#7ed321", "#35c759", "#0a84ff"],
    });
    setBlendUndoTick(0);
    setBlendRedoTick(0);
    setSourceCropA({ x: 0, y: 0, w: 1, h: 1 });
    setSourceCropB({ x: 0, y: 0, w: 1, h: 1 });
    setBlendResetTick((v) => v + 1);
  };

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
    setGeneratedOutputs([]);
    setSelectedOutputId("");
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
      setActiveTab("Extraction");
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

  const sendArchiveItemToTranslation = (item) => {
    if (!results.length) {
      alert("Analyze Archive first, then send images to Translation.");
      return;
    }
    const normalizedItemName = String(item?.file?.name || "").toLowerCase();
    const matchIdx = results.findIndex((result) => {
      const original = String(result?.original_name || "").toLowerCase();
      return original === normalizedItemName || original.includes(normalizedItemName) || normalizedItemName.includes(original);
    });
    if (matchIdx === -1) {
      alert(`No extracted result found yet for "${item?.file?.name || "selected image"}". Re-run Analyze Archive if needed.`);
      return;
    }
    addToComposer(results[matchIdx], matchIdx);
    setActiveTab("Translation");
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
      setActiveTab("Projection");
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
    if (manualBackendOnline) {
      setBackendStatus({
        online: true,
        label: `Manual online mode: ${apiBase}`,
      });
      return;
    }
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

  const toggleManualBackendOnline = () => {
    setManualBackendOnline((enabled) => {
      const nextEnabled = !enabled;
      if (nextEnabled) {
        setBackendStatus({
          online: true,
          label: `Manual online mode: ${apiBase}`,
        });
      } else {
        setBackendStatus({
          online: false,
          label: "Checking connection...",
        });
      }
      return nextEnabled;
    });
  };

  useEffect(() => {
    checkBackendHealth();
    const interval = setInterval(checkBackendHealth, 10000);
    return () => {
      clearInterval(interval);
    };
  }, [manualBackendOnline]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const isUndo = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z";
      const isRedo =
        (event.ctrlKey || event.metaKey) &&
        (event.key.toLowerCase() === "y" || (event.shiftKey && event.key.toLowerCase() === "z"));
      if (activeTab !== "Blend Lab") return;
      if (isUndo && !event.shiftKey) {
        event.preventDefault();
        setBlendUndoTick((v) => v + 1);
      }
      if (isRedo) {
        event.preventDefault();
        setBlendRedoTick((v) => v + 1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeTab]);

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
          manualBackendOnline={manualBackendOnline}
          onToggleManualBackendOnline={toggleManualBackendOnline}
        />

        <TabWorkspace activeTab={activeTab}>
          {activeTab === "Archive" && (
            <ArchiveTab
              items={items}
              onSelectFiles={onSelectFiles}
              runExtraction={runExtraction}
              isLoading={isLoading}
              backendOnline={backendStatus.online}
              updateTag={updateTag}
              removeItem={removeItem}
              onSendArchiveItemToTranslation={sendArchiveItemToTranslation}
              hasResults={results.length > 0}
            />
          )}

          {activeTab === "Extraction" && (
            <ExtractionTab
              extractionOutputs={extractionOutputs}
              preset={preset}
              applyPreset={applyPreset}
              selectedCount={selectedCount}
              setActiveTab={setActiveTab}
              collapsed={collapsed}
              setCollapsed={setCollapsed}
              edgeLow={edgeLow}
              setEdgeLow={setEdgeLow}
              edgeHigh={edgeHigh}
              setEdgeHigh={setEdgeHigh}
              densityKernel={densityKernel}
              setDensityKernel={setDensityKernel}
              setPreset={setPreset}
              paletteColors={paletteColors}
              setPaletteColors={setPaletteColors}
              blendA={blendA}
              setBlendA={setBlendA}
              blendB={blendB}
              setBlendB={setBlendB}
              blendC={blendC}
              setBlendC={setBlendC}
              blendWeightA={blendWeightA}
              setBlendWeightA={setBlendWeightA}
              blendWeightB={blendWeightB}
              setBlendWeightB={setBlendWeightB}
              blendWeightC={blendWeightC}
              setBlendWeightC={setBlendWeightC}
              mutationCount={mutationCount}
              setMutationCount={setMutationCount}
              mutationJitter={mutationJitter}
              setMutationJitter={setMutationJitter}
              runExtraction={runExtraction}
              items={items}
              isLoading={isLoading}
              backendOnline={backendStatus.online}
              results={results}
              apiBase={apiBase}
              addToComposer={addToComposer}
            />
          )}

          {activeTab === "Translation" && (
            <TranslationTab
              translationOutputs={translationOutputs}
              apiBase={apiBase}
              items={items}
              results={results}
              slotNodes={slotNodes}
              crossResult={crossResult}
              exportFormat={exportFormat}
              registerGeneratedOutput={registerGeneratedOutput}
              crossMapA={crossMapA}
              crossMapB={crossMapB}
              crossMapC={crossMapC}
              crossWeightA={crossWeightA}
              crossWeightB={crossWeightB}
              crossWeightC={crossWeightC}
              setCrossMapA={setCrossMapA}
              setCrossMapB={setCrossMapB}
              setCrossMapC={setCrossMapC}
              setCrossWeightA={setCrossWeightA}
              setCrossWeightB={setCrossWeightB}
              setCrossWeightC={setCrossWeightC}
              setSourceSlots={setSourceSlots}
              runExtraction={runExtraction}
              runCrossBlend={runCrossBlend}
              crossLoading={crossLoading}
              setActiveTab={setActiveTab}
            />
          )}

          {activeTab === "Projection" && (
            <ProjectionTab
              projectionSurfaces={projectionSurfaces}
              apiBase={apiBase}
              results={results}
              crossResult={crossResult}
              exportFormat={exportFormat}
              registerGeneratedOutput={registerGeneratedOutput}
              slotNodes={slotNodes}
              generatedOutputs={generatedOutputs}
            />
          )}

          {activeTab === "Blend Lab" && (
            <BlendLabTab
              sourceA={sourceA}
              sourceB={sourceB}
              setSourceA={setSourceA}
              setSourceB={setSourceB}
              sourceCropA={sourceCropA}
              sourceCropB={sourceCropB}
              setSourceCropA={setSourceCropA}
              setSourceCropB={setSourceCropB}
              tagA={tagA}
              tagB={tagB}
              setTagA={setTagA}
              setTagB={setTagB}
              selectionTool={selectionTool}
              setSelectionTool={setSelectionTool}
              selectionTarget={blendSelectionTarget}
              setSelectionTarget={setBlendSelectionTarget}
              feather={feather}
              setFeather={setFeather}
              brushSize={brushSize}
              setBrushSize={setBrushSize}
              eraseTransparency={eraseTransparency}
              setEraseTransparency={setEraseTransparency}
              blendMode={blendMode}
              setBlendMode={setBlendMode}
              opacity={blendOpacity}
              setOpacity={setBlendOpacity}
              abstractionMode={abstractionMode}
              setAbstractionMode={setAbstractionMode}
              preset={blendPreset}
              applyPreset={applyBlendPreset}
              regionFx={blendRegionFx}
              setRegionFx={setBlendRegionFx}
              roleAssignment={roleAssignment}
              setRoleAssignment={setRoleAssignment}
              featureWeights={featureWeights}
              setFeatureWeights={setFeatureWeights}
              mutationCount={mutationCountBlend}
              setMutationCount={setMutationCountBlend}
              hybridPreview={blendHybridPreview}
              mutations={blendMutations}
              onGenerateHybrid={onBlendHybridReady}
              onGenerateMutations={onGenerateBlendMutations}
              onClearSelection={() => setBlendClearTick((v) => v + 1)}
              onInvertSelection={() => setBlendInvertTick((v) => v + 1)}
              onUndoPolygonNode={() => setBlendPolygonUndoTick((v) => v + 1)}
              onClosePolygon={() => setBlendPolygonCloseTick((v) => v + 1)}
              onApplyRegion={() => setBlendApplyTick((v) => v + 1)}
              onDeselectRegion={() => setBlendDeselectTick((v) => v + 1)}
              onDeleteRegion={() => setBlendDeleteTick((v) => v + 1)}
              onUndoEdit={() => setBlendUndoTick((v) => v + 1)}
              onRedoEdit={() => setBlendRedoTick((v) => v + 1)}
              onResetTools={resetBlendLabTools}
              transform={blendTransform}
              setTransform={setBlendTransform}
              lineage={blendLineage}
              onExport={onBlendExport}
              clearTick={blendClearTick}
              invertTick={blendInvertTick}
              polygonUndoTick={blendPolygonUndoTick}
              polygonCloseTick={blendPolygonCloseTick}
              contourSimplify={blendContourSimplify}
              setContourSimplify={setBlendContourSimplify}
              applyTick={blendApplyTick}
              deselectTick={blendDeselectTick}
              deleteTick={blendDeleteTick}
              undoTick={blendUndoTick}
              redoTick={blendRedoTick}
              resetTick={blendResetTick}
            />
          )}

          {activeTab === "Pattern Projection Lab" && (
            <PatternProjectionLab
              apiBase={apiBase}
              results={results}
              generatedOutputs={generatedOutputs}
              registerGeneratedOutput={registerGeneratedOutput}
            />
          )}

          {activeTab === "Export" && (
            <ExportTab
              exportFormat={exportFormat}
              setExportFormat={setExportFormat}
              batchZip={batchZip}
              top3Zip={top3Zip}
              crossResult={crossResult}
              promptSummary={promptSummary}
              generatedOutputs={generatedOutputs}
              selectedOutputId={selectedOutputId}
              setSelectedOutputId={setSelectedOutputId}
              results={results}
              apiBase={apiBase}
            />
          )}
        </TabWorkspace>
        <section className="lineage-dock glass-panel">
          <LineageGraph slots={slotNodes} crossResult={crossResult} lineage={dockLineage} />
        </section>
      </main>
    </>
  );
}
