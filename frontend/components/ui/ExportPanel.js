export default function ExportPanel({ exportFormat, setExportFormat, batchZip, top3Zip, crossResult, promptSummary }) {
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
      <div className="card-actions">
        {batchZip ? <a href={batchZip} target="_blank" rel="noreferrer">Download Selected Map</a> : null}
        {batchZip ? <a href={batchZip} target="_blank" rel="noreferrer">Download All as ZIP</a> : null}
        {top3Zip ? <a href={top3Zip} target="_blank" rel="noreferrer">Export Contact Sheet</a> : null}
      </div>
      <div className="field-row">
        <label>Prompt Summary</label>
        <textarea value={promptSummary} readOnly rows={4} />
      </div>
      <div className="field-row">
        <label>Metadata Preview</label>
        <pre>{JSON.stringify(crossResult || {}, null, 2)}</pre>
      </div>
    </section>
  );
}
