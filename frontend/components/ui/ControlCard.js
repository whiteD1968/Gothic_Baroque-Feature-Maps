export default function ControlCard({ title, collapsed, onToggle, children }) {
  return (
    <article className="control-card glass-panel">
      <button type="button" className="control-header" onClick={onToggle}>
        <h3>{title}</h3>
        <span>{collapsed ? "+" : "-"}</span>
      </button>
      {!collapsed && <div className="control-body">{children}</div>}
    </article>
  );
}
