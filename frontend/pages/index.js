import Head from "next/head";
import { useMemo, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const MAP_KEYS = [
  "original",
  "edge_map",
  "shadow_depth_map",
  "flow_map",
  "node_map",
  "density_map",
  "composite_map",
];
const TAGS = ["Gothic", "Baroque", "Mixed", "Custom"];

function fileToPreview(file) {
  return {
    id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`,
    file,
    tag: "Gothic",
    previewUrl: URL.createObjectURL(file),
  };
}

function mapLabel(key) {
  return key.replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

export default function Home() {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [batchZip, setBatchZip] = useState("");
  const [edgeLow, setEdgeLow] = useState(70);
  const [edgeHigh, setEdgeHigh] = useState(180);
  const [densityKernel, setDensityKernel] = useState(9);

  const canRun = useMemo(() => items.length > 0 && !isLoading, [items, isLoading]);

  const onSelectFiles = (event) => {
    const selected = Array.from(event.target.files || []);
    const mapped = selected.map(fileToPreview);
    setItems((prev) => [...prev, ...mapped]);
    event.target.value = "";
  };

  const updateTag = (id, tag) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, tag } : item)));
  };

  const removeItem = (id) => {
    setItems((prev) => {
      const next = prev.filter((p) => p.id !== id);
      const removed = prev.find((p) => p.id === id);
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return next;
    });
  };

  const runExtraction = async () => {
    setIsLoading(true);
    setResults([]);
    setBatchZip("");
    try {
      const form = new FormData();
      items.forEach((item) => {
        form.append("files", item.file);
        form.append("tags", item.tag);
      });
      form.append("edge_threshold_low", String(edgeLow));
      form.append("edge_threshold_high", String(edgeHigh));
      form.append("density_kernel", String(densityKernel));

      const response = await fetch(`${API_BASE}/api/process`, {
        method: "POST",
        body: form,
      });
      if (!response.ok) throw new Error("Processing failed");
      const data = await response.json();
      setResults(data.results || []);
      setBatchZip(`${API_BASE}${data.batch_zip}`);
    } catch (error) {
      alert("Processing failed. Check backend server and inputs.");
    } finally {
      setIsLoading(false);
    }
  };

  const copyDescription = async (text) => {
    await navigator.clipboard.writeText(text);
  };

  return (
    <>
      <Head>
        <title>Gothic_Baroque Feature Mapper</title>
        <meta name="description" content="Gothic / Baroque Feature Extraction Tool" />
      </Head>
      <main className="page">
        <section className="panel upload">
          <h1>Gothic / Baroque Feature Extraction Tool</h1>
          <p className="sub">Historical image database -> feature extraction -> abstract maps -> AI image references</p>
          <label className="fileBtn">
            Upload JPG, PNG, WEBP
            <input type="file" accept=".jpg,.jpeg,.png,.webp" multiple onChange={onSelectFiles} />
          </label>
        </section>

        <section className="panel controls">
          <h2>Feature Controls</h2>
          <div className="sliderRow">
            <label>Edge Threshold Low: {edgeLow}</label>
            <input type="range" min="10" max="200" value={edgeLow} onChange={(e) => setEdgeLow(Number(e.target.value))} />
          </div>
          <div className="sliderRow">
            <label>Edge Threshold High: {edgeHigh}</label>
            <input type="range" min="50" max="300" value={edgeHigh} onChange={(e) => setEdgeHigh(Number(e.target.value))} />
          </div>
          <div className="sliderRow">
            <label>Density Kernel: {densityKernel}</label>
            <input type="range" min="3" max="21" step="2" value={densityKernel} onChange={(e) => setDensityKernel(Number(e.target.value))} />
          </div>
          <button disabled={!canRun} onClick={runExtraction}>{isLoading ? "Processing..." : "Run Feature Extraction"}</button>
        </section>

        <section className="panel gallery">
          <h2>Image Gallery</h2>
          <div className="thumbGrid">
            {items.map((item) => (
              <article key={item.id} className="thumbCard">
                <img src={item.previewUrl} alt={item.file.name} />
                <div className="thumbMeta">
                  <span>{item.file.name}</span>
                  <select value={item.tag} onChange={(e) => updateTag(item.id, e.target.value)}>
                    {TAGS.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
                  </select>
                  <button onClick={() => removeItem(item.id)}>Remove</button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="panel results">
          <h2>Results Panel</h2>
          {batchZip && (
            <a className="zipLink" href={batchZip} target="_blank" rel="noreferrer">
              Download Batch ZIP
            </a>
          )}
          {results.map((result, idx) => (
            <article className="resultCard" key={`${result.original_name}-${idx}`}>
              <header>
                <h3>{result.original_name} ({result.tag})</h3>
              </header>
              <div className="mapsGrid">
                {MAP_KEYS.map((key) => {
                  const fullPath = `${API_BASE}/api/download/file?path=${encodeURIComponent(result.maps[key])}`;
                  return (
                    <figure key={key}>
                      <img src={fullPath} alt={key} />
                      <figcaption>{mapLabel(key)}</figcaption>
                      <a href={fullPath} target="_blank" rel="noreferrer">Download</a>
                    </figure>
                  );
                })}
              </div>
              <div className="descriptionBlock">
                <textarea value={result.description} readOnly rows={3} />
                <button onClick={() => copyDescription(result.description)}>Copy Trait Description</button>
              </div>
            </article>
          ))}
        </section>
      </main>
    </>
  );
}
