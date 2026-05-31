export default function TabWorkspace({ activeTab, children }) {
  return (
    <section key={activeTab} className="workspace tab-enter">
      {children}
    </section>
  );
}
