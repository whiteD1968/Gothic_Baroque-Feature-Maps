export default function CanvasInspectorShell({ header, main, inspector, className = "" }) {
  return (
    <section className={`workspace-lab ${className}`.trim()}>
      <div className="workspace-main">
        {header}
        {main}
      </div>
      <aside className="workspace-inspector">
        {inspector}
      </aside>
    </section>
  );
}

