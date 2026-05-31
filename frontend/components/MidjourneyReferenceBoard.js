export default function MidjourneyReferenceBoard({ imageUrl, alt = "Midjourney Reference Board" }) {
  if (!imageUrl) return <p className="muted">Generate reference board to preview.</p>;
  return <img src={imageUrl} alt={alt} />;
}

