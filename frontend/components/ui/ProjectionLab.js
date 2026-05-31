import { useMemo, useRef, useState } from "react";
import { MAP_KEYS, mapLabel } from "./constants";
import CanvasInspectorShell from "./CanvasInspectorShell";

const GEOMETRIES = [
  "flat tile",
  "folded tile",
  "vault patch",
  "column fragment",
  "stereotomic block",
  "minimal surface patch placeholder",
];
const GRAPHIC_STYLES = [
  "Monochrome Ink",
  "Soft Diagram",
  "Editorial Atlas",
  "Technical Drawing",
  "Pastel Field",
  "Lithic Texture",
  "High Contrast Plate",
  "AI Reference Board",
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed loading: ${src}`));
    img.src = src;
  });
}

function textureUrl(apiBase, result, key) {
  const path = result?.maps?.[key];
  if (!path) return "";
  return `${apiBase}/api/download/file?path=${encodeURIComponent(path)}`;
}

function quantizeImageData(imageData, levels) {
  const lv = clamp(levels, 2, 12);
  const step = Math.floor(255 / (lv - 1));
  for (let i = 0; i < imageData.data.length; i += 4) {
    imageData.data[i] = Math.round(imageData.data[i] / step) * step;
    imageData.data[i + 1] = Math.round(imageData.data[i + 1] / step) * step;
    imageData.data[i + 2] = Math.round(imageData.data[i + 2] / step) * step;
  }
  return imageData;
}

function applyTextureTransform(ctx, texture, opts) {
  const size = 680;
  const off = document.createElement("canvas");
  off.width = size;
  off.height = size;
  const octx = off.getContext("2d");
  octx.imageSmoothingEnabled = !!opts.smoothing;
  octx.translate(size / 2, size / 2);
  octx.rotate((opts.uvRotation * Math.PI) / 180);
  octx.scale(opts.mirrorX ? -1 : 1, opts.mirrorY ? -1 : 1);
  const repeat = clamp(Math.round(opts.repeatCount), 1, 10);
  const unit = size / repeat;
  const scaled = unit * clamp(opts.uvScale, 0.2, 3);
  for (let y = -size; y < size; y += unit) {
    for (let x = -size; x < size; x += unit) {
      octx.drawImage(texture, x, y, scaled, scaled);
    }
  }
  const imageData = octx.getImageData(0, 0, size, size);
  octx.putImageData(quantizeImageData(imageData, opts.colorQuantization), 0, 0);
  ctx.globalAlpha = clamp(opts.opacity, 0.05, 1);
  return off;
}

function drawWarpedStrip(ctx, img, quad, strips = 48) {
  for (let i = 0; i < strips; i += 1) {
    const t0 = i / strips;
    const t1 = (i + 1) / strips;
    const tx0 = quad.tl.x + (quad.tr.x - quad.tl.x) * t0;
    const ty0 = quad.tl.y + (quad.tr.y - quad.tl.y) * t0;
    const tx1 = quad.tl.x + (quad.tr.x - quad.tl.x) * t1;
    const ty1 = quad.tl.y + (quad.tr.y - quad.tl.y) * t1;
    const bx0 = quad.bl.x + (quad.br.x - quad.bl.x) * t0;
    const by0 = quad.bl.y + (quad.br.y - quad.bl.y) * t0;
    const bx1 = quad.bl.x + (quad.br.x - quad.bl.x) * t1;
    const by1 = quad.bl.y + (quad.br.y - quad.bl.y) * t1;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(tx0, ty0);
    ctx.lineTo(tx1, ty1);
    ctx.lineTo(bx1, by1);
    ctx.lineTo(bx0, by0);
    ctx.closePath();
    ctx.clip();
    const sx = t0 * img.width;
    const sw = (t1 - t0) * img.width;
    ctx.drawImage(img, sx, 0, sw, img.height, Math.min(tx0, bx0), Math.min(ty0, ty1, by0, by1), 1000, 1000);
    ctx.restore();
  }
}

export default function ProjectionLab({ apiBase, results, crossResult, exportFormat, onRegisterOutput }) {
  const canvasRef = useRef(null);
  const [geometry, setGeometry] = useState(GEOMETRIES[0]);
  const [resultIndex, setResultIndex] = useState(0);
  const [mapKey, setMapKey] = useState("composite_map");
  const [uvScale, setUvScale] = useState(1);
  const [uvRotation, setUvRotation] = useState(0);
  const [mirrorX, setMirrorX] = useState(false);
  const [mirrorY, setMirrorY] = useState(false);
  const [repeatCount, setRepeatCount] = useState(2);
  const [opacity, setOpacity] = useState(0.95);
  const [perspectiveDistortion, setPerspectiveDistortion] = useState(0.4);
  const [colorQuantization, setColorQuantization] = useState(6);
  const [smoothing, setSmoothing] = useState(true);
  const [graphicStyle, setGraphicStyle] = useState("Editorial Atlas");
  const [error, setError] = useState("");

  const applyGraphicStyleFrame = (canvas, styleName, label) => {
    const styled = document.createElement("canvas");
    styled.width = canvas.width;
    styled.height = canvas.height;
    const sctx = styled.getContext("2d");
    sctx.fillStyle = styleName === "Pastel Field" ? "#f4efe8" : "#f7f6f2";
    sctx.fillRect(0, 0, styled.width, styled.height);
    sctx.shadowColor = "rgba(0,0,0,0.14)";
    sctx.shadowBlur = 22;
    sctx.shadowOffsetY = 10;
    sctx.drawImage(canvas, 26, 26, styled.width - 52, styled.height - 90);
    sctx.shadowColor = "transparent";
    sctx.strokeStyle = "rgba(0,0,0,0.2)";
    sctx.strokeRect(26, 26, styled.width - 52, styled.height - 90);
    sctx.fillStyle = "rgba(255,255,255,0.86)";
    sctx.fillRect(26, styled.height - 62, styled.width - 52, 36);
    sctx.fillStyle = "#222";
    sctx.font = "600 14px -apple-system, BlinkMacSystemFont, sans-serif";
    sctx.fillText(`${styleName} · ${label}`, 38, styled.height - 39);
    return styled;
  };

  const selectedResult = useMemo(() => results[resultIndex] || results[0] || null, [results, resultIndex]);

  const draw = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#efeee9";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setError("");
    if (!selectedResult) {
      setError("Run Extraction first.");
      return;
    }
    const source = mapKey.startsWith("cross_") ? crossResult?.maps?.[mapKey] : selectedResult?.maps?.[mapKey];
    if (!source) {
      setError("Selected texture map is unavailable.");
      return;
    }
    const srcUrl = mapKey.startsWith("cross_")
      ? `${apiBase}/api/download/file?path=${encodeURIComponent(source)}`
      : textureUrl(apiBase, selectedResult, mapKey);

    try {
      const texture = await loadImage(srcUrl);
      const prepared = applyTextureTransform(ctx, texture, { uvScale, uvRotation, mirrorX, mirrorY, repeatCount, opacity, colorQuantization, smoothing });
      ctx.imageSmoothingEnabled = !!smoothing;
      const d = perspectiveDistortion * 180;
      if (geometry === "flat tile") ctx.drawImage(prepared, 110, 110, 580, 580);
      if (geometry === "folded tile") {
        drawWarpedStrip(ctx, prepared, { tl: { x: 90, y: 120 + d * 0.1 }, tr: { x: 370, y: 80 }, bl: { x: 120, y: 620 }, br: { x: 390, y: 590 - d * 0.2 } });
        drawWarpedStrip(ctx, prepared, { tl: { x: 370, y: 80 }, tr: { x: 700, y: 140 + d * 0.1 }, bl: { x: 390, y: 590 - d * 0.2 }, br: { x: 680, y: 640 } });
      }
      if (geometry === "vault patch") {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(120, 640);
        ctx.quadraticCurveTo(400, 40 + d * 0.2, 680, 640);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(prepared, 120, 80, 560, 580);
        ctx.restore();
      }
      if (geometry === "column fragment") {
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(400, 390, 220, 300, 0, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(prepared, 170 - d * 0.2, 90, 460 + d * 0.4, 620);
        ctx.restore();
      }
      if (geometry === "stereotomic block") {
        drawWarpedStrip(ctx, prepared, { tl: { x: 180, y: 250 }, tr: { x: 520, y: 250 }, bl: { x: 180, y: 610 }, br: { x: 520, y: 610 } });
      }
      if (geometry === "minimal surface patch placeholder") {
        for (let i = 0; i < 22; i += 1) {
          const t = i / 22;
          const y = 120 + t * 520;
          const wave = Math.sin(t * Math.PI * 2) * (40 + d * 0.25);
          drawWarpedStrip(ctx, prepared, {
            tl: { x: 120 + wave * 0.3, y }, tr: { x: 680 - wave * 0.3, y: y + wave * 0.2 }, bl: { x: 150 - wave * 0.2, y: y + 24 }, br: { x: 650 + wave * 0.2, y: y + 24 },
          }, 6);
        }
      }
      const styledCanvas = applyGraphicStyleFrame(canvas, graphicStyle, geometry);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(styledCanvas, 0, 0, canvas.width, canvas.height);
      const url = styledCanvas.toDataURL(exportFormat === "jpg" ? "image/jpeg" : "image/png", 0.95);
      onRegisterOutput?.({
        kind: "projection",
        title: `Projection - ${geometry}`,
        previewUrl: url,
        metadata: {
          source_image_name: selectedResult?.original_name || "Unknown",
          source_tag: selectedResult?.tag || "Custom",
          selected_feature_maps: [mapKey],
          translation_mode: "Architectural Projection",
          transformation_settings: { geometry, uv_scale: uvScale, uv_rotation: uvRotation, mirror_x: mirrorX, mirror_y: mirrorY, repeat_count: repeatCount, opacity, perspective_distortion: perspectiveDistortion, color_quantization: colorQuantization, smoothing, graphic_style: graphicStyle },
          feature_weights: { blend_weight_a: selectedResult?.variant?.blend_weight_a ?? null, blend_weight_b: selectedResult?.variant?.blend_weight_b ?? null, blend_weight_c: selectedResult?.variant?.blend_weight_c ?? null, fitness_components: selectedResult?.variant?.fitness_components || {} },
          mutation_seed: null,
          export_type: exportFormat,
          generated_prompt_summary: crossResult?.midjourney?.full_prompt || selectedResult?.midjourney?.full_prompt || selectedResult?.description || "",
          lineage: { source_image: selectedResult?.original_name || "Unknown", feature_extraction: mapLabel(mapKey), graphic_translation: "Selected abstract output", ai_reference: crossResult?.maps ? "Cross/Composite Reference" : "Prompt Pack", architectural_projection: geometry },
        },
      });
    } catch (err) {
      setError(String(err?.message || "Projection failed."));
    }
  };

  const mapOptions = MAP_KEYS.filter((key) => key !== "original");
  if (crossResult?.maps?.cross_blend_map) mapOptions.push("cross_blend_map");
  if (crossResult?.maps?.cross_tiled_pattern_map) mapOptions.push("cross_tiled_pattern_map");

  return (
    <section className="glass-panel projection-lab">
      <h3>Projection Mode</h3>
      <CanvasInspectorShell
        className="projection-workspace"
        header={(
          <header className="workspace-head">
            <h3>Projection Canvas</h3>
            <p className="muted">{geometry} · {mapLabel(mapKey)} · {graphicStyle}</p>
          </header>
        )}
        main={(
          <>
            {error ? <p className="muted">{error}</p> : null}
            <div className="projection-canvas-wrap"><canvas ref={canvasRef} width="800" height="760" /></div>
          </>
        )}
        inspector={(
          <>
            <h4>Inspector</h4>
            <details className="inspector-drawer" open>
              <summary>Source</summary>
              <div className="translation-grid compact">
                <label>Geometry</label><select value={geometry} onChange={(e) => setGeometry(e.target.value)}>{GEOMETRIES.map((item) => <option key={item} value={item}>{item}</option>)}</select>
                <label>Source Result</label><select value={resultIndex} onChange={(e) => setResultIndex(Number(e.target.value))}>{results.map((r, i) => <option key={`${r.original_name}-${i}`} value={i}>{r.original_name}</option>)}</select>
                <label>Abstract Output</label><select value={mapKey} onChange={(e) => setMapKey(e.target.value)}>{mapOptions.map((key) => <option key={key} value={key}>{mapLabel(key)}</option>)}</select>
              </div>
            </details>
            <details className="inspector-drawer" open>
              <summary>Graphic Style</summary>
              <div className="translation-grid compact">
                <label>Style Preset</label><select value={graphicStyle} onChange={(e) => setGraphicStyle(e.target.value)}>{GRAPHIC_STYLES.map((style) => <option key={style} value={style}>{style}</option>)}</select>
              </div>
            </details>
            <details className="inspector-drawer" open>
              <summary>Advanced Controls</summary>
              <div className="translation-grid compact">
                <label>UV Scale</label><input type="range" min="0.2" max="3" step="0.1" value={uvScale} onChange={(e) => setUvScale(Number(e.target.value))} />
                <label>UV Rotation</label><input type="range" min="-180" max="180" value={uvRotation} onChange={(e) => setUvRotation(Number(e.target.value))} />
                <label>Mirror X</label><input type="checkbox" checked={mirrorX} onChange={(e) => setMirrorX(e.target.checked)} />
                <label>Mirror Y</label><input type="checkbox" checked={mirrorY} onChange={(e) => setMirrorY(e.target.checked)} />
                <label>Repeat Count</label><input type="range" min="1" max="10" value={repeatCount} onChange={(e) => setRepeatCount(Number(e.target.value))} />
                <label>Opacity</label><input type="range" min="0.05" max="1" step="0.05" value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} />
                <label>Perspective Distortion</label><input type="range" min="0" max="1" step="0.05" value={perspectiveDistortion} onChange={(e) => setPerspectiveDistortion(Number(e.target.value))} />
                <label>Color Quantization</label><input type="range" min="2" max="12" value={colorQuantization} onChange={(e) => setColorQuantization(Number(e.target.value))} />
                <label>Smoothing</label><input type="checkbox" checked={smoothing} onChange={(e) => setSmoothing(e.target.checked)} />
              </div>
            </details>
            <details className="inspector-drawer">
              <summary>Actions</summary>
              <div className="card-actions"><button type="button" onClick={draw} disabled={!results.length}>Render Projection</button></div>
            </details>
          </>
        )}
      />
    </section>
  );
}

