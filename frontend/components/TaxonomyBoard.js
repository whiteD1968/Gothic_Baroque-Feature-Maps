export default function TaxonomyBoard({ imageUrl, alt = "Taxonomy Board" }) {
  if (!imageUrl) return <p className="muted">Generate taxonomy board to preview.</p>;
  return <img src={imageUrl} alt={alt} />;
}

