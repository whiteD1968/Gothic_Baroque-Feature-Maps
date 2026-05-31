import { TAGS } from "./ui/constants";
import BlendCanvas from "./BlendCanvas";
import RegionSelector from "./RegionSelector";
import FeatureBlendPanel from "./FeatureBlendPanel";
import BlendModeControls from "./BlendModeControls";
import HybridPreview from "./HybridPreview";
import MutationGrid from "./MutationGrid";
import GrasshopperExportPanel from "./GrasshopperExportPanel";
import BlendLineageGraph from "./BlendLineageGraph";

function SourceRegionPicker({ source, crop, setCrop, label }) {
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const activeCrop = crop || { x: 0, y: 0, w: 1, h: 1 };

  const onPointerDown = (event) => {
    if (!source?.url) return;
    const host = event.currentTarget;
    const rect = host.getBoundingClientRect();
    const startX = clamp01((event.clientX - rect.left) / rect.width);
    const startY = clamp01((event.clientY - rect.top) / rect.height);

    const onMove = (moveEvent) => {
      const cx = clamp01((moveEvent.clientX - rect.left) / rect.width);
      const cy = clamp01((moveEvent.clientY - rect.top) / rect.height);
      const x = Math.min(startX, cx);
      const y = Math.min(startY, cy);
      const w = Math.max(0.02, Math.abs(cx - startX));
      const h = Math.max(0.02, Math.abs(cy - startY));
      setCrop({ x, y, w, h });
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return source?.url ? (
    <div className="source-region-block">
      <small className="muted">{label}</small>
      <div className="source-region-picker" onPointerDown={onPointerDown} role="button" tabIndex={0}>
        <img src={source.url} alt={label} className="source-preview" />
        <div
          className="source-region-rect"
          style={{
            left: `${activeCrop.x * 100}%`,
            top: `${activeCrop.y * 100}%`,
            width: `${activeCrop.w * 100}%`,
            height: `${activeCrop.h * 100}%`,
          }}
        />
      </div>
      <div className="card-actions">
        <button type="button" onClick={() => setCrop({ x: 0, y: 0, w: 1, h: 1 })}>Reset Source Region</button>
      </div>
    </div>
  ) : <p className="muted">Upload source image</p>;
}

export default function BlendLabTab(props) {
  const {
    sourceA,
    sourceB,
    setSourceA,
    setSourceB,
    tagA,
    tagB,
    setTagA,
    setTagB,
    sourceCropA,
    sourceCropB,
    setSourceCropA,
    setSourceCropB,
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
    blendMode,
    setBlendMode,
    opacity,
    setOpacity,
    abstractionMode,
    setAbstractionMode,
    preset,
    applyPreset,
    regionFx,
    setRegionFx,
    roleAssignment,
    setRoleAssignment,
    featureWeights,
    setFeatureWeights,
    mutationCount,
    setMutationCount,
    hybridPreview,
    mutations,
    onGenerateHybrid,
    onGenerateMutations,
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
    lineage,
    onExport,
    clearTick,
    invertTick,
    polygonUndoTick,
    polygonCloseTick,
    contourSimplify,
    setContourSimplify,
    applyTick,
    deselectTick,
    deleteTick,
    undoTick,
    redoTick,
    resetTick,
  } = props;

  const upload = (setter, resetCrop) => (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setter({ file, url: URL.createObjectURL(file), name: file.name });
    if (resetCrop) resetCrop({ x: 0, y: 0, w: 1, h: 1 });
  };

  return (
    <section className="tab-panel blend-lab-tab">
      <section className="glass-panel mode-panel">
        <h3>Blend Lab</h3>
        <p className="muted">Region-based feature crossbreeding for MidJourney and Grasshopper-ready outputs.</p>
      </section>

      <section className="glass-panel blend-lab-workspace">
        <div className="blend-col source-col">
          <h4>Source A</h4>
          <input type="file" accept="image/*" onChange={upload(setSourceA, setSourceCropA)} />
          <select value={tagA} onChange={(e) => setTagA(e.target.value)}>{TAGS.map((t) => <option key={t}>{t}</option>)}</select>
          <SourceRegionPicker source={sourceA} crop={sourceCropA} setCrop={setSourceCropA} label="Source A Region" />
        </div>

        <div className="blend-col canvas-col">
          <h4>Blend Canvas / Live Preview</h4>
          <section className="blend-near-toolbar">
            <RegionSelector
              selectionTool={selectionTool}
              setSelectionTool={setSelectionTool}
              selectionTarget={selectionTarget}
              setSelectionTarget={setSelectionTarget}
              feather={feather}
              setFeather={setFeather}
              brushSize={brushSize}
              setBrushSize={setBrushSize}
              eraseTransparency={eraseTransparency}
              setEraseTransparency={setEraseTransparency}
              onClearSelection={onClearSelection}
              onInvertSelection={onInvertSelection}
              onUndoPolygonNode={onUndoPolygonNode}
              onClosePolygon={onClosePolygon}
              onApplyRegion={onApplyRegion}
              onDeselectRegion={onDeselectRegion}
              onDeleteRegion={onDeleteRegion}
              onUndoEdit={onUndoEdit}
              onRedoEdit={onRedoEdit}
              onResetTools={onResetTools}
              transform={transform}
              setTransform={setTransform}
            />
            <BlendModeControls
              blendMode={blendMode}
              setBlendMode={setBlendMode}
              opacity={opacity}
              setOpacity={setOpacity}
              preset={preset}
              applyPreset={applyPreset}
              regionFx={regionFx}
              setRegionFx={setRegionFx}
              abstractionMode={abstractionMode}
              setAbstractionMode={setAbstractionMode}
            />
          </section>
          <BlendCanvas
            sourceA={sourceA}
            sourceB={sourceB}
            sourceCropA={sourceCropA}
            sourceCropB={sourceCropB}
            selectionTool={selectionTool}
            selectionTarget={selectionTarget}
            feather={feather}
            brushSize={brushSize}
            eraseTransparency={eraseTransparency}
            blendMode={blendMode}
            opacity={opacity}
            roleAssignment={roleAssignment}
            featureWeights={featureWeights}
            transform={transform}
            regionFx={regionFx}
            onHybridReady={onGenerateHybrid}
            clearTick={clearTick}
            invertTick={invertTick}
            polygonUndoTick={polygonUndoTick}
            polygonCloseTick={polygonCloseTick}
            applyTick={applyTick}
            deselectTick={deselectTick}
            deleteTick={deleteTick}
            abstractionMode={abstractionMode}
            undoTick={undoTick}
            redoTick={redoTick}
            resetTick={resetTick}
          />
          {hybridPreview ? <HybridPreview imageUrl={hybridPreview} title="Hybrid Output" /> : null}
        </div>

        <div className="blend-col source-col">
          <h4>Source B</h4>
          <input type="file" accept="image/*" onChange={upload(setSourceB, setSourceCropB)} />
          <select value={tagB} onChange={(e) => setTagB(e.target.value)}>{TAGS.map((t) => <option key={t}>{t}</option>)}</select>
          <SourceRegionPicker source={sourceB} crop={sourceCropB} setCrop={setSourceCropB} label="Source B Region" />
        </div>
      </section>

      <section className="glass-panel blend-lab-inspector">
        <div className="blend-inspector-grid">
          <FeatureBlendPanel roleAssignment={roleAssignment} setRoleAssignment={setRoleAssignment} featureWeights={featureWeights} setFeatureWeights={setFeatureWeights} />
          <MutationGrid mutationCount={mutationCount} setMutationCount={setMutationCount} mutations={mutations} onGenerateMutations={onGenerateMutations} />
          <GrasshopperExportPanel onExport={onExport} contourSimplify={contourSimplify} setContourSimplify={setContourSimplify} />
        </div>
      </section>

      <section className="glass-panel">
        <BlendLineageGraph lineage={lineage} />
      </section>
    </section>
  );
}
