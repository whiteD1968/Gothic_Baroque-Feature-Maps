export default function MutationGrid({ mutationCount, setMutationCount, mutations, onGenerateMutations }) {
  return (
    <article className="inspector-card">
      <h4>Live Mutation Grid</h4>
      <div className="field-row">
        <label>Variant Count</label>
        <select value={mutationCount} onChange={(e) => setMutationCount(Number(e.target.value))}>
          <option value={6}>6</option>
          <option value={9}>9</option>
          <option value={12}>12</option>
        </select>
      </div>
      <div className="card-actions">
        <button type="button" onClick={onGenerateMutations}>Generate Variants</button>
      </div>
      <div className="mutation-grid">
        {mutations.map((src, i) => <img key={`${src.slice(0, 24)}-${i}`} src={src} alt={`mutation-${i + 1}`} />)}
      </div>
    </article>
  );
}
