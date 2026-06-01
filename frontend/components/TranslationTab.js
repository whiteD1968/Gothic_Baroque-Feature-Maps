import ComposerBoard from "./ui/ComposerBoard";
import TranslationLab from "./ui/TranslationLab";
import { useState } from "react";

export default function TranslationTab(props) {
  const [batchRuns, setBatchRuns] = useState(1);
  const {
    translationOutputs,
    apiBase,
    items,
    results,
    slotNodes,
    crossResult,
    exportFormat,
    registerGeneratedOutput,
    crossMapA,
    crossMapB,
    crossMapC,
    crossWeightA,
    crossWeightB,
    crossWeightC,
    setCrossMapA,
    setCrossMapB,
    setCrossMapC,
    setCrossWeightA,
    setCrossWeightB,
    setCrossWeightC,
    setSourceSlots,
    runExtraction,
    runCrossBlend,
    crossLoading,
    setActiveTab,
  } = props;

  return (
    <section className="tab-panel">
      <section className="glass-panel mode-panel">
        <h3>Abstract AI-Ready Translation Outputs</h3>
        <div className="pill-row">{translationOutputs.map((label) => <span key={label} className="pill">{label}</span>)}</div>
      </section>
      <TranslationLab
        apiBase={apiBase}
        items={items}
        results={results}
        sourceSlots={slotNodes}
        crossResult={crossResult}
        exportFormat={exportFormat}
        onRegisterOutput={registerGeneratedOutput}
      />
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
        onReorderSlots={(from, to) => {
          setSourceSlots((prev) => {
            const next = [...prev];
            const temp = next[from];
            next[from] = next[to];
            next[to] = temp;
            return next;
          });
        }}
        onGenerateVariants={() => runExtraction(true)}
        onCrossReference={runCrossBlend}
        crossLoading={crossLoading}
      />
      <section className="glass-panel mode-panel">
        <h3>Batch Translation Runs</h3>
        <div className="card-actions">
          <label>Runs</label>
          <input type="range" min="1" max="5" value={batchRuns} onChange={(e) => setBatchRuns(Number(e.target.value))} />
          <span className="pill">{batchRuns}</span>
          <button
            type="button"
            onClick={async () => {
              for (let i = 0; i < batchRuns; i += 1) {
                // eslint-disable-next-line no-await-in-loop
                await runExtraction(true);
              }
            }}
          >
            Run Batch
          </button>
        </div>
      </section>
      <div className="panel-head">
        <h3>Projection surfaces become available after cross-reference generation.</h3>
        <button type="button" onClick={() => setActiveTab("Projection")} disabled={!crossResult}>Open Projection</button>
      </div>
    </section>
  );
}
