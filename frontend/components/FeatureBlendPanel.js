const CH = ["edge", "density", "flow", "shadow", "node", "symmetry", "texture"];

export default function FeatureBlendPanel({ roleAssignment, setRoleAssignment, featureWeights, setFeatureWeights }) {
  return (
    <article className="inspector-card">
      <h4>Feature Blending</h4>
      {CH.map((ch) => (
        <div key={ch} className="feature-row">
          <label>{ch}</label>
          <select value={roleAssignment[ch]} onChange={(e) => setRoleAssignment((p) => ({ ...p, [ch]: e.target.value }))}>
            <option value="A">Image A</option>
            <option value="B">Image B</option>
          </select>
          <input type="range" min="0" max="1" step="0.05" value={featureWeights[ch]} onChange={(e) => setFeatureWeights((p) => ({ ...p, [ch]: Number(e.target.value) }))} />
          <span>{featureWeights[ch].toFixed(2)}</span>
        </div>
      ))}
    </article>
  );
}
