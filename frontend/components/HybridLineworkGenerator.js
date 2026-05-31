export default function HybridLineworkGenerator({ imageUrl, alt = "Hybrid Linework Plate" }) {
  if (!imageUrl) return <p className="muted">Generate hybrid linework to preview.</p>;
  return <img src={imageUrl} alt={alt} />;
}

