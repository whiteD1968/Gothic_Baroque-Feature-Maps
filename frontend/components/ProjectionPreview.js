export default function ProjectionPreview({ imageUrl, alt = "Projection Preview" }) {
  if (!imageUrl) return <p className="muted">Render projection to preview.</p>;
  return <img src={imageUrl} alt={alt} />;
}

