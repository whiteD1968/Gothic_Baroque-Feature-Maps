export default function MetadataPanel({ metadata }) {
  return (
    <section className="glass-panel export-panel">
      <h3>Metadata</h3>
      <pre>{JSON.stringify(metadata || {}, null, 2)}</pre>
    </section>
  );
}

