import { TAGS } from "./ui/constants";
import BlendCanvas from "./BlendCanvas";
import RegionSelector from "./RegionSelector";
import FeatureBlendPanel from "./FeatureBlendPanel";
import BlendModeControls from "./BlendModeControls";
import HybridPreview from "./HybridPreview";
import MutationGrid from "./MutationGrid";
import GrasshopperExportPanel from "./GrasshopperExportPanel";
import BlendLineageGraph from "./BlendLineageGraph";

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
    selectionTool,
    setSelectionTool,
    selectionTarget,
    setSelectionTarget,
    feather,
    setFeather,
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
  } = props;

  const upload = (setter) => (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setter({ file, url: URL.createObjectURL(file), name: file.name });
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
          <input type="file" accept="image/*" onChange={upload(setSourceA)} />
          <select value={tagA} onChange={(e) => setTagA(e.target.value)}>{TAGS.map((t) => <option key={t}>{t}</option>)}</select>
          {sourceA?.url ? <img src={sourceA.url} alt="Source A" className="source-preview" /> : <p className="muted">Upload source image A</p>}
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
              onClearSelection={onClearSelection}
              onInvertSelection={onInvertSelection}
              onUndoPolygonNode={onUndoPolygonNode}
              onClosePolygon={onClosePolygon}
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
            selectionTool={selectionTool}
            selectionTarget={selectionTarget}
            feather={feather}
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
          />
          {hybridPreview ? <HybridPreview imageUrl={hybridPreview} title="Hybrid Output" /> : null}
        </div>

        <div className="blend-col source-col">
          <h4>Source B</h4>
          <input type="file" accept="image/*" onChange={upload(setSourceB)} />
          <select value={tagB} onChange={(e) => setTagB(e.target.value)}>{TAGS.map((t) => <option key={t}>{t}</option>)}</select>
          {sourceB?.url ? <img src={sourceB.url} alt="Source B" className="source-preview" /> : <p className="muted">Upload source image B</p>}
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
