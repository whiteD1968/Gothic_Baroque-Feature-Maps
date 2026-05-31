export default function Sidebar({ activeTab, setActiveTab, stats, backendStatus, onRetryBackend }) {
  const tabs = ["Archive", "Extraction", "Translation", "Blend Lab", "Projection", "Export"];

  return (
    <aside className="sidebar glass-panel">
      <div>
        <p className="eyebrow">Creative Research</p>
        <h1>Gothic / Baroque Mapper</h1>
        <p className="sidebar-subtitle">Feature Extraction + Graphic Translation Lab</p>
      </div>
      <nav className="side-nav">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            className={activeTab === tab ? "nav-link active" : "nav-link"}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>
      <div className="backend-status">
        <h3>Backend</h3>
        <div className="status-row">
          <span className={`status-pill ${backendStatus.online ? "online" : "offline"}`}>
            {backendStatus.online ? "Online" : "Offline"}
          </span>
          <button type="button" className="retry-btn" onClick={onRetryBackend}>Retry now</button>
        </div>
        <p>{backendStatus.label}</p>
      </div>
      <div className="stats">
        <h3>Dataset</h3>
        <p>Images: <strong>{stats.images}</strong></p>
        <p>Generated Maps: <strong>{stats.maps}</strong></p>
        <p>Composites: <strong>{stats.composites}</strong></p>
      </div>
    </aside>
  );
}
