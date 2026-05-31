import { BLENDABLE_MAP_KEYS, mapLabel } from "./constants";

export default function ComposerBoard({
  slots,
  slotMaps,
  slotWeights,
  setSlotMap,
  setSlotWeight,
  onClearSlot,
  onGenerateVariants,
  onCrossReference,
  crossLoading,
}) {
  return (
    <section className="composer-board glass-panel">
      <div className="sources-grid">
        {slots.map((slot, idx) => (
          <article key={`slot-${idx}`} className="source-slot">
            <h4>Source {String.fromCharCode(65 + idx)}</h4>
            {slot ? <p>{slot.result.original_name}</p> : <p className="muted">Drop from Feature Maps</p>}
            <label>Map Role</label>
            <select value={slotMaps[idx]} onChange={(e) => setSlotMap(idx, e.target.value)}>
              {BLENDABLE_MAP_KEYS.map((key) => (
                <option key={key} value={key}>{mapLabel(key)}</option>
              ))}
            </select>
            <label>Weight {slotWeights[idx]}%</label>
            <input type="range" min="0" max="100" value={slotWeights[idx]} onChange={(e) => setSlotWeight(idx, Number(e.target.value))} />
            <button type="button" className="quiet" onClick={() => onClearSlot(idx)}>Clear</button>
          </article>
        ))}
      </div>
      <div className="composer-actions">
        <button type="button" onClick={onGenerateVariants}>Generate Variants</button>
        <button type="button" onClick={onCrossReference} disabled={crossLoading}>{crossLoading ? "Generating..." : "Cross-Reference Maps"}</button>
      </div>
    </section>
  );
}
