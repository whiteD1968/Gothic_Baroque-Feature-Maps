export default function MutationSheet({ imageUrl, alt = "Pattern Mutation Sheet" }) {
  if (!imageUrl) return <p className="muted">Generate mutation sheet to preview.</p>;
  return <img src={imageUrl} alt={alt} />;
}

