export default function PresetCard({ title, active, onClick, subtitle }) {
  return (
    <button type="button" className={active ? "preset-card active" : "preset-card"} onClick={onClick}>
      <h4>{title}</h4>
      <p>{subtitle}</p>
    </button>
  );
}
