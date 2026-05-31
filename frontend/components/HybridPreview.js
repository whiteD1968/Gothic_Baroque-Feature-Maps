export default function HybridPreview({ imageUrl, title }) {
  return (
    <section className="hybrid-preview">
      <h4>{title}</h4>
      <img src={imageUrl} alt={title} />
    </section>
  );
}
