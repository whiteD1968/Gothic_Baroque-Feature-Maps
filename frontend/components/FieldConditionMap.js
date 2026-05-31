export default function FieldConditionMap({ imageUrl, alt = "Field Condition Map" }) {
  if (!imageUrl) return <p className="muted">Generate field condition map to preview.</p>;
  return <img src={imageUrl} alt={alt} />;
}

