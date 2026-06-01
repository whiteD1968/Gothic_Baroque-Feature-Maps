import LineageGraph from "./LineageGraph";
import { useState } from "react";
import { buildDesignPromptSummary, copyTextToClipboard, downloadJsonFile, downloadTextFile } from "../../lib/exportUtils";

export default function ExportPanel({
  exportFormat,
  setExportFormat,
  batchZip,
  top3Zip,
  crossResult,
  promptSummary,
  generatedOutputs,
  selectedOutputId,
  setSelectedOutputId,
  results,
  apiBase,
}) {
  const [researchNotes, setResearchNotes] = useState("");
  const [compareOutputId, setCompareOutputId] = useState("");
  const selected = generatedOutputs.find((item) => item.id === selectedOutputId) || generatedOutputs[0] || null;
  const activeResult = results[0] || null;
  const designPrompt = buildDesignPromptSummary(
    selected?.metadata || {},
    selected?.metadata?.generated_prompt_summary || promptSummary,
  );
  const grouped = {
    "Hybrid Linework Plate": generatedOutputs.filter((o) => o.title === "Hybrid Linework Plate"),
    "Pattern Mutation Sheet": generatedOutputs.filter((o) => o.title === "Pattern Mutation Sheet"),
    "Taxonomy Board": generatedOutputs.filter((o) => o.title === "Taxonomy / Lineage Board"),
    "Field Condition Map": generatedOutputs.filter((o) => o.title === "Field Condition Map"),
    "MidJourney Reference Board": generatedOutputs.filter((o) => o.title === "MidJourney Reference Board"),
    "Projection Preview": generatedOutputs.filter((o) => o.kind === "projection"),
  };

  const exportMetadata = selected?.metadata || crossResult || {};
  const compareOutput = generatedOutputs.find((item) => item.id === compareOutputId) || null;
  const exportResearchPackage = () => {
    const manifest = {
      exported_at: new Date().toISOString(),
      selected_output: selected?.title || "",
      output_id: selected?.id || "",
      prompt_summary: designPrompt,
      research_notes: researchNotes,
      lineage: selected?.metadata?.lineage || null,
      metadata: exportMetadata,
      generated_outputs: generatedOutputs.map((item) => ({
        id: item.id,
        title: item.title,
        kind: item.kind,
        createdAt: item.createdAt,
      })),
    };
    downloadJsonFile("digital-spolia-research-package.json", manifest);
    downloadTextFile("digital-spolia-prompt-summary.txt", designPrompt, "text/plain");
    if (researchNotes.trim()) {
      downloadTextFile("digital-spolia-research-notes.txt", researchNotes.trim(), "text/plain");
    }
  };

  return (
    <section className="export-panel glass-panel">
      <h2>Export</h2>
      <div className="field-row">
        <label>Export Format</label>
        <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value)}>
          <option value="jpg">JPG</option>
          <option value="png">PNG</option>
        </select>
      </div>
      <div className="field-row">
        <label>Quick Export</label>
        <div className="card-actions">
          {batchZip ? <a href={batchZip} target="_blank" rel="noreferrer">ZIP Package</a> : null}
          {top3Zip ? <a href={top3Zip} target="_blank" rel="noreferrer">Contact Sheet</a> : null}
          {crossResult?.zip ? <a href={`${apiBase}${crossResult.zip}`} target="_blank" rel="noreferrer">Projection ZIP</a> : null}
        </div>
      </div>

      <details className="inspector-drawer">
        <summary>Advanced Format Exports</summary>
        {Object.entries(grouped).map(([label, items]) => (
          items.length ? (
            <div className="field-row" key={label}>
              <label>{label}</label>
              <div className="card-actions">
                {items.map((item) => (
                  <a key={item.id} href={item.previewUrl} download={`${item.title.toLowerCase().replaceAll(" ", "-")}.${exportFormat}`}>
                    Download {item.title}
                  </a>
                ))}
              </div>
            </div>
          ) : null
        ))}
        {activeResult?.maps ? (
          <div className="field-row">
            <label>Individual Maps</label>
            <div className="card-actions">
              {Object.entries(activeResult.maps).map(([key, value]) => (
                <a key={key} href={`${apiBase}/api/download/file?path=${encodeURIComponent(value)}`} target="_blank" rel="noreferrer">
                  Map: {key}
                </a>
              ))}
            </div>
          </div>
        ) : null}
      </details>

      <div className="field-row">
        <label>Prompt Summary</label>
        <textarea value={designPrompt} readOnly rows={5} />
        <div className="card-actions">
          <button type="button" onClick={() => copyTextToClipboard(designPrompt)}>Copy Prompt Summary</button>
        </div>
      </div>
      <div className="field-row">
        <label>Research Notes</label>
        <textarea value={researchNotes} onChange={(e) => setResearchNotes(e.target.value)} rows={4} placeholder="Design intent, mutation rationale, next experiments..." />
      </div>
      {generatedOutputs.length ? (
        <div className="field-row">
          <label>Generated Output</label>
          <select value={selectedOutputId || generatedOutputs[0].id} onChange={(e) => setSelectedOutputId(e.target.value)}>
            {generatedOutputs.map((item) => (
              <option key={item.id} value={item.id}>{item.title}</option>
            ))}
          </select>
          <label>Compare Against</label>
          <select value={compareOutputId} onChange={(e) => setCompareOutputId(e.target.value)}>
            <option value="">None</option>
            {generatedOutputs.map((item) => (
              <option key={`cmp-${item.id}`} value={item.id}>{item.title}</option>
            ))}
          </select>
          {selected?.previewUrl ? <img className="export-preview" src={selected.previewUrl} alt={selected.title} /> : null}
        </div>
      ) : null}
      <div className="field-row">
        <label>Metadata</label>
        <pre>{JSON.stringify(exportMetadata, null, 2)}</pre>
        <div className="card-actions">
          <button type="button" onClick={() => downloadJsonFile("digital-spolia-metadata.json", exportMetadata)}>Export JSON Metadata</button>
          <button type="button" onClick={exportResearchPackage}>Export Research Package</button>
        </div>
      </div>
      <LineageGraph slots={[]} crossResult={crossResult} lineage={selected?.metadata?.lineage} compareLineage={compareOutput?.metadata?.lineage} />
    </section>
  );
}
