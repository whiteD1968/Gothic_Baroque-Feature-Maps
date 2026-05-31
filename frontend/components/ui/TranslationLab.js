import { useEffect, useMemo, useState } from "react";
import { MAP_KEYS, mapLabel } from "./constants";
import CanvasInspectorShell from "./CanvasInspectorShell";

const MODES = [
  "Taxonomy / Lineage Board",
  "Hybrid Linework Plate",
  "Pattern Mutation Sheet",
  "Field Condition Map",
  "MidJourney Reference Board",
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

const TRANSLATION_PRESETS = {
  "Gothic Rib Logic": {
    mode: "Hybrid Linework Plate",
    selectedMap: "edge_map",
    lineThickness: 2.2,
    nodeEmphasis: 1.9,
    flowIntensity: 0.45,
    invertBW: false,
    hatchDensity: 11,
    colorMode: "bw",
  },
  "Baroque Swell Logic": {
    mode: "Field Condition Map",
    selectedMap: "shadow_depth_map",
    flowIntensity: 1.1,
    regionCount: 9,
    blurAmount: 18,
    contourLevels: 10,
    fieldSoftness: 0.82,
    boundarySharpness: 0.45,
    fieldGrain: 0.12,
  },
  "Ornament Density Field": {
    mode: "Field Condition Map",
    selectedMap: "density_map",
    regionCount: 13,
    blurAmount: 10,
    contourLevels: 12,
    fieldSoftness: 0.7,
    boundarySharpness: 0.72,
    fieldPalette: 6,
  },
  "Hybrid Tectonic Field": {
    mode: "Hybrid Linework Plate",
    selectedMap: "composite_map",
    lineThickness: 1.5,
    hatchDensity: 9,
    nodeEmphasis: 1.3,
    flowIntensity: 0.95,
    contourSpacing: 20,
    simplification: 0.35,
  },
  "Digital Spolia Plate": {
    mode: "Taxonomy / Lineage Board",
    selectedMap: "edge_map",
    boardLayout: "atlas",
    hideLabels: false,
  },
  "MidJourney Reference Board": {
    mode: "MidJourney Reference Board",
    selectedMap: "composite_map",
    boardLayout: "atlas",
    hideLabels: true,
  },
  "Material Projection Study": {
    mode: "Field Condition Map",
    selectedMap: "composite_map",
    regionCount: 8,
    blurAmount: 8,
    contourLevels: 7,
    fieldSoftness: 0.55,
    boundarySharpness: 0.9,
    fieldPalette: 4,
    fieldTransparency: 0.72,
  },
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function mapUrl(apiBase, result, key) {
  const path = result?.maps?.[key];
  if (!path) return "";
  return `${apiBase}/api/download/file?path=${encodeURIComponent(path)}`;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    if (!src) {
      reject(new Error("Missing image source"));
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed loading image: ${src}`));
    img.src = src;
  });
}

function drawCover(ctx, img, x, y, w, h) {
  const ratio = Math.max(w / img.width, h / img.height);
  const dw = img.width * ratio;
  const dh = img.height * ratio;
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2;
  ctx.drawImage(img, dx, dy, dw, dh);
}

function seeded(seed) {
  let s = Number(seed) || 1;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function grayPixel(data, idx) {
  return (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
}

function writeGray(data, idx, v) {
  data[idx] = v;
  data[idx + 1] = v;
  data[idx + 2] = v;
  data[idx + 3] = 255;
}

function morph(imageData, dilate = true) {
  const { data, width, height } = imageData;
  const out = new Uint8ClampedArray(data.length);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      let val = dilate ? 0 : 255;
      for (let oy = -1; oy <= 1; oy += 1) {
        for (let ox = -1; ox <= 1; ox += 1) {
          const idxN = ((y + oy) * width + (x + ox)) * 4;
          const g = grayPixel(data, idxN);
          if (dilate) val = Math.max(val, g);
          else val = Math.min(val, g);
        }
      }
      const idx = (y * width + x) * 4;
      writeGray(out, idx, val);
    }
  }
  imageData.data.set(out);
  return imageData;
}

export default function TranslationLab({
  apiBase,
  items,
  results,
  sourceSlots,
  crossResult,
  exportFormat,
  onRegisterOutput,
}) {
  const [mode, setMode] = useState(MODES[0]);
  const [activePreset, setActivePreset] = useState("");
  const [selectedResult, setSelectedResult] = useState(0);
  const [selectedMap, setSelectedMap] = useState("density_map");
  const [isRendering, setIsRendering] = useState(false);
  const [renderError, setRenderError] = useState("");
  const [outputUrl, setOutputUrl] = useState("");

  const [lineThickness, setLineThickness] = useState(1.2);
  const [hatchDensity, setHatchDensity] = useState(12);
  const [contourSpacing, setContourSpacing] = useState(28);
  const [nodeEmphasis, setNodeEmphasis] = useState(1.4);
  const [flowIntensity, setFlowIntensity] = useState(0.8);
  const [invertBW, setInvertBW] = useState(false);
  const [drawingNoise, setDrawingNoise] = useState(0.04);
  const [simplification, setSimplification] = useState(0.2);

  const [gridSize, setGridSize] = useState("3x3");
  const [mutationStrength, setMutationStrength] = useState(0.4);
  const [mutationSeed, setMutationSeed] = useState(42);
  const [colorMode, setColorMode] = useState("bw");

  const [regionCount, setRegionCount] = useState(7);
  const [blurAmount, setBlurAmount] = useState(12);
  const [contourLevels, setContourLevels] = useState(8);
  const [fieldSoftness, setFieldSoftness] = useState(0.6);
  const [boundarySharpness, setBoundarySharpness] = useState(0.6);
  const [fieldPalette, setFieldPalette] = useState(5);
  const [fieldTransparency, setFieldTransparency] = useState(0.65);
  const [fieldGrain, setFieldGrain] = useState(0.08);

  const [boardLayout, setBoardLayout] = useState("atlas");
  const [hideLabels, setHideLabels] = useState(false);
  const [graphicStyle, setGraphicStyle] = useState("Editorial Atlas");

  const resolvedResult = useMemo(() => results[selectedResult] || results[0] || null, [results, selectedResult]);

  useEffect(() => {
    if (!results.length) {
      setOutputUrl("");
      setSelectedResult(0);
    }
  }, [results]);

  const applyPreset = (presetName) => {
    const cfg = TRANSLATION_PRESETS[presetName];
    if (!cfg) return;
    setActivePreset(presetName);
    if (cfg.mode) setMode(cfg.mode);
    if (cfg.selectedMap) setSelectedMap(cfg.selectedMap);
    if (cfg.lineThickness !== undefined) setLineThickness(cfg.lineThickness);
    if (cfg.hatchDensity !== undefined) setHatchDensity(cfg.hatchDensity);
    if (cfg.contourSpacing !== undefined) setContourSpacing(cfg.contourSpacing);
    if (cfg.nodeEmphasis !== undefined) setNodeEmphasis(cfg.nodeEmphasis);
    if (cfg.flowIntensity !== undefined) setFlowIntensity(cfg.flowIntensity);
    if (cfg.invertBW !== undefined) setInvertBW(cfg.invertBW);
    if (cfg.drawingNoise !== undefined) setDrawingNoise(cfg.drawingNoise);
    if (cfg.simplification !== undefined) setSimplification(cfg.simplification);
    if (cfg.gridSize !== undefined) setGridSize(cfg.gridSize);
    if (cfg.mutationStrength !== undefined) setMutationStrength(cfg.mutationStrength);
    if (cfg.mutationSeed !== undefined) setMutationSeed(cfg.mutationSeed);
    if (cfg.colorMode !== undefined) setColorMode(cfg.colorMode);
    if (cfg.regionCount !== undefined) setRegionCount(cfg.regionCount);
    if (cfg.blurAmount !== undefined) setBlurAmount(cfg.blurAmount);
    if (cfg.contourLevels !== undefined) setContourLevels(cfg.contourLevels);
    if (cfg.fieldSoftness !== undefined) setFieldSoftness(cfg.fieldSoftness);
    if (cfg.boundarySharpness !== undefined) setBoundarySharpness(cfg.boundarySharpness);
    if (cfg.fieldPalette !== undefined) setFieldPalette(cfg.fieldPalette);
    if (cfg.fieldTransparency !== undefined) setFieldTransparency(cfg.fieldTransparency);
    if (cfg.fieldGrain !== undefined) setFieldGrain(cfg.fieldGrain);
    if (cfg.boardLayout !== undefined) setBoardLayout(cfg.boardLayout);
    if (cfg.hideLabels !== undefined) setHideLabels(cfg.hideLabels);
  };

  const renderHybridLinework = async () => {
    const result = resolvedResult;
    const edge = await loadImage(mapUrl(apiBase, result, "edge_map"));
    const node = await loadImage(mapUrl(apiBase, result, "node_map"));
    const flow = await loadImage(mapUrl(apiBase, result, "flow_map"));
    const density = await loadImage(mapUrl(apiBase, result, "density_map"));
    const size = 1400;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = invertBW ? "#000" : "#fff";
    ctx.fillRect(0, 0, size, size);
    ctx.globalAlpha = 1;

    const base = document.createElement("canvas");
    base.width = size;
    base.height = size;
    const bctx = base.getContext("2d");
    drawCover(bctx, edge, 0, 0, size, size);
    const edgeImg = bctx.getImageData(0, 0, size, size);
    for (let i = 0; i < edgeImg.data.length; i += 4) {
      let v = grayPixel(edgeImg.data, i);
      v = v > 100 + simplification * 120 ? 255 : 0;
      if (invertBW) v = 255 - v;
      writeGray(edgeImg.data, i, v);
    }
    bctx.putImageData(edgeImg, 0, 0);
    ctx.globalAlpha = 0.9;
    ctx.drawImage(base, 0, 0);

    const hatchStep = clamp(Math.round(22 - hatchDensity), 4, 22);
    ctx.save();
    ctx.strokeStyle = invertBW ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.15)";
    ctx.lineWidth = lineThickness * 0.8;
    for (let i = -size; i < size * 2; i += hatchStep) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i - size, size);
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    const flowLayer = document.createElement("canvas");
    flowLayer.width = size;
    flowLayer.height = size;
    const fctx = flowLayer.getContext("2d");
    drawCover(fctx, flow, 0, 0, size, size);
    fctx.globalCompositeOperation = "luminosity";
    ctx.globalAlpha = clamp(flowIntensity, 0, 1);
    ctx.drawImage(flowLayer, 0, 0);
    ctx.restore();

    ctx.save();
    drawCover(ctx, node, 0, 0, size, size);
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = clamp(nodeEmphasis, 0.2, 2) * 0.45;
    ctx.drawImage(canvas, 0, 0);
    ctx.restore();

    const cctx = canvas.getContext("2d");
    const img = cctx.getImageData(0, 0, size, size);
    const step = clamp(contourSpacing, 8, 80);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        if ((x + y) % step === 0) {
          const idx = (y * size + x) * 4;
          const v = invertBW ? 220 : 25;
          writeGray(img.data, idx, v);
        }
      }
    }

    const rand = seeded(mutationSeed);
    for (let i = 0; i < img.data.length; i += 4) {
      const noise = (rand() - 0.5) * 255 * drawingNoise;
      const next = clamp(grayPixel(img.data, i) + noise, 0, 255);
      writeGray(img.data, i, next);
    }
    cctx.putImageData(img, 0, 0);
    drawCover(cctx, density, 0, 0, size, size);
    cctx.globalAlpha = 0.16;

    return canvas;
  };

  const renderTaxonomyBoard = async () => {
    const result = resolvedResult;
    const source = items[selectedResult]?.previewUrl || items[0]?.previewUrl || "";
    const map = mapUrl(apiBase, result, selectedMap);
    const hybrid = await renderHybridLinework();
    const aiRef = crossResult?.maps
      ? `${apiBase}/api/download/file?path=${encodeURIComponent(crossResult.maps.cross_tiled_pattern_map || crossResult.maps.cross_blend_map)}`
      : mapUrl(apiBase, result, "composite_map");
    const [sourceImg, mapImg, aiImg] = await Promise.all([loadImage(source), loadImage(map), loadImage(aiRef)]);

    const canvas = document.createElement("canvas");
    canvas.width = 1800;
    canvas.height = 1200;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#f5f4ef";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#1f1f1f";
    ctx.lineWidth = 1;

    const cards = [
      { title: "source archive", img: sourceImg, x: 70 },
      { title: "edge extraction", img: mapImg, x: 490 },
      { title: "graphic mutation", img: hybrid, x: 910 },
      { title: "AI reference", img: aiImg, x: 1330 },
    ];

    cards.forEach((card, idx) => {
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "rgba(0,0,0,0.2)";
      ctx.fillRect(card.x, 260, 390, 520);
      ctx.strokeRect(card.x, 260, 390, 520);
      drawCover(ctx, card.img, card.x + 18, 318, 354, 390);
      ctx.fillStyle = "#1c1c1c";
      ctx.font = "600 20px Georgia";
      ctx.fillText(card.title, card.x + 18, 296);
      if (idx < cards.length - 1) {
        ctx.strokeStyle = "rgba(0,0,0,0.32)";
        ctx.beginPath();
        ctx.moveTo(card.x + 390, 520);
        ctx.lineTo(card.x + 420, 520);
        ctx.stroke();
      }
    });

    const feature = result?.metrics || {};
    const tags = [
      `tag: ${result?.tag || "Custom"}`,
      `map: ${mapLabel(selectedMap)}`,
      `edge ratio: ${feature.edge_ratio ?? "-"}`,
      `node count: ${feature.node_count ?? "-"}`,
      `density: ${feature.density_mean ?? "-"}`,
      `flow: ${feature.flow_strength ?? "-"}`,
      `fitness: ${result?.variant?.fitness_score ?? "-"}`,
    ];
    ctx.fillStyle = "#222";
    ctx.font = "700 33px Georgia";
    ctx.fillText("Taxonomy / Lineage Board", 70, 106);
    ctx.font = "400 18px 'Courier New', monospace";
    tags.forEach((t, i) => ctx.fillText(t, 70, 150 + i * 26));
    ctx.font = "500 16px 'Courier New', monospace";
    ctx.fillText("source image -> extracted feature map -> graphic abstraction -> AI reference output", 70, 850);
    return canvas;
  };

  const renderMutationSheet = async () => {
    const result = resolvedResult;
    const img = await loadImage(mapUrl(apiBase, result, selectedMap));
    const isFour = gridSize === "4x4";
    const n = isFour ? 4 : 3;
    const size = 1600;
    const gap = 20;
    const cell = Math.floor((size - gap * (n + 1)) / n);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#faf9f7";
    ctx.fillRect(0, 0, size, size);
    const rand = seeded(mutationSeed);

    const ops = [
      "threshold",
      "thicken",
      "erosion",
      "mirror",
      "radial",
      "tile",
      "banding",
      "segments",
      "rotate",
      "noise",
      "contrast",
      "palette",
      "flipv",
      "gamma",
      "posterize",
      "offset",
    ];

    for (let i = 0; i < n * n; i += 1) {
      const x = gap + (i % n) * (cell + gap);
      const y = gap + Math.floor(i / n) * (cell + gap);
      const op = ops[i % ops.length];
      const layer = document.createElement("canvas");
      layer.width = cell;
      layer.height = cell;
      const lctx = layer.getContext("2d");
      drawCover(lctx, img, 0, 0, cell, cell);
      if (op === "rotate") {
        const tmp = document.createElement("canvas");
        tmp.width = cell;
        tmp.height = cell;
        const tctx = tmp.getContext("2d");
        tctx.translate(cell / 2, cell / 2);
        tctx.rotate((Math.PI / 10) * (0.5 + mutationStrength));
        tctx.translate(-cell / 2, -cell / 2);
        tctx.drawImage(layer, 0, 0);
        lctx.clearRect(0, 0, cell, cell);
        lctx.drawImage(tmp, 0, 0);
      } else if (op === "mirror") {
        lctx.save();
        lctx.translate(cell, 0);
        lctx.scale(-1, 1);
        lctx.drawImage(layer, 0, 0);
        lctx.restore();
      } else if (op === "flipv") {
        lctx.save();
        lctx.translate(0, cell);
        lctx.scale(1, -1);
        lctx.drawImage(layer, 0, 0);
        lctx.restore();
      } else if (op === "tile") {
        lctx.drawImage(layer, 0, 0, cell / 2, cell / 2);
        lctx.drawImage(layer, cell / 2, 0, cell / 2, cell / 2);
        lctx.drawImage(layer, 0, cell / 2, cell / 2, cell / 2);
        lctx.drawImage(layer, cell / 2, cell / 2, cell / 2, cell / 2);
      }
      const data = lctx.getImageData(0, 0, cell, cell);
      for (let p = 0; p < data.data.length; p += 4) {
        let v = grayPixel(data.data, p);
        if (op === "threshold") v = v > 128 + mutationStrength * 70 ? 255 : 0;
        if (op === "contrast") v = clamp((v - 128) * (1.3 + mutationStrength) + 128, 0, 255);
        if (op === "banding") v = Math.round(v / 30) * 30;
        if (op === "segments") v = Math.round(v / 45) * 45;
        if (op === "gamma") v = clamp(255 * ((v / 255) ** (1.2 + mutationStrength)), 0, 255);
        if (op === "posterize") v = Math.round(v / 60) * 60;
        if (op === "noise") v = clamp(v + (rand() - 0.5) * mutationStrength * 180, 0, 255);
        if (op === "offset" && (p / 4) % 7 === 0) v = clamp(v + 60 * mutationStrength, 0, 255);
        writeGray(data.data, p, v);
      }
      if (op === "thicken") morph(data, true);
      if (op === "erosion") morph(data, false);
      lctx.putImageData(data, 0, 0);

      if (colorMode !== "bw") {
        lctx.globalCompositeOperation = "multiply";
        if (colorMode === "pastel") lctx.fillStyle = `hsla(${Math.floor(rand() * 360)},55%,75%,0.45)`;
        else lctx.fillStyle = "rgba(255,95,30,0.35)";
        lctx.fillRect(0, 0, cell, cell);
      }

      ctx.drawImage(layer, x, y);
      ctx.strokeStyle = "rgba(0,0,0,0.24)";
      ctx.strokeRect(x, y, cell, cell);
    }
    return canvas;
  };

  const renderFieldCondition = async () => {
    const result = resolvedResult;
    const [density, shadow, flow] = await Promise.all([
      loadImage(mapUrl(apiBase, result, "density_map")),
      loadImage(mapUrl(apiBase, result, "shadow_depth_map")),
      loadImage(mapUrl(apiBase, result, "flow_map")),
    ]);
    const size = 1500;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#f7f6f2";
    ctx.fillRect(0, 0, size, size);

    drawCover(ctx, density, 0, 0, size, size);
    ctx.globalAlpha = clamp(fieldSoftness, 0.1, 1);
    ctx.filter = `blur(${Math.round(blurAmount)}px)`;
    drawCover(ctx, shadow, 0, 0, size, size);
    ctx.filter = "none";
    ctx.globalAlpha = clamp(fieldTransparency, 0.1, 1);
    drawCover(ctx, flow, 0, 0, size, size);
    ctx.globalAlpha = 1;

    const data = ctx.getImageData(0, 0, size, size);
    const regionStep = Math.max(2, Math.floor(255 / regionCount));
    for (let i = 0; i < data.data.length; i += 4) {
      let v = grayPixel(data.data, i);
      v = Math.floor(v / regionStep) * regionStep;
      v = clamp(v * (0.7 + boundarySharpness), 0, 255);
      const r = v;
      const g = clamp(v - fieldPalette * 7, 0, 255);
      const b = clamp(255 - v + fieldPalette * 8, 0, 255);
      data.data[i] = r;
      data.data[i + 1] = g;
      data.data[i + 2] = b;
      data.data[i + 3] = 255;
    }
    ctx.putImageData(data, 0, 0);

    ctx.strokeStyle = "rgba(20,20,20,0.45)";
    ctx.lineWidth = 1.2;
    for (let l = 1; l <= contourLevels; l += 1) {
      const y = (l / (contourLevels + 1)) * size;
      ctx.beginPath();
      for (let x = 0; x <= size; x += 12) {
        const wave = Math.sin((x / size) * Math.PI * (l + 1)) * 16 * fieldSoftness;
        if (x === 0) ctx.moveTo(x, y + wave);
        else ctx.lineTo(x, y + wave);
      }
      ctx.stroke();
    }
    const rand = seeded(mutationSeed + 9);
    const grainCount = Math.floor(size * size * fieldGrain * 0.08);
    for (let i = 0; i < grainCount; i += 1) {
      ctx.fillStyle = rand() > 0.5 ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.09)";
      ctx.fillRect(Math.floor(rand() * size), Math.floor(rand() * size), 1, 1);
    }
    return canvas;
  };

  const renderMidjourneyBoard = async () => {
    const result = resolvedResult;
    const source = items[selectedResult]?.previewUrl || items[0]?.previewUrl || "";
    const analytical = mapUrl(apiBase, result, selectedMap);
    const [sourceImg, mapImg, linework, field, mutation] = await Promise.all([
      loadImage(source),
      loadImage(analytical),
      renderHybridLinework(),
      renderFieldCondition(),
      renderMutationSheet(),
    ]);
    const board = document.createElement("canvas");
    const ctx = board.getContext("2d");
    const labels = ["source", "analytical map", "linework", "field condition", "mutation"];
    const assets = [sourceImg, mapImg, linework, field, mutation];

    if (boardLayout === "horizontal") {
      board.width = 2400; board.height = 760;
      ctx.fillStyle = "#f2f2f2"; ctx.fillRect(0, 0, board.width, board.height);
      assets.forEach((asset, i) => {
        const w = 440; const h = 620; const x = 30 + i * 470; const y = 70;
        drawCover(ctx, asset, x, y, w, h);
        if (!hideLabels) { ctx.fillStyle = "#111"; ctx.font = "500 18px Arial"; ctx.fillText(labels[i], x, 44); }
      });
    } else if (boardLayout === "vertical") {
      board.width = 820; board.height = 3000;
      ctx.fillStyle = "#f2f2f2"; ctx.fillRect(0, 0, board.width, board.height);
      assets.forEach((asset, i) => {
        const x = 40; const y = 40 + i * 580;
        drawCover(ctx, asset, x, y, 740, 520);
        if (!hideLabels) { ctx.fillStyle = "#111"; ctx.font = "500 18px Arial"; ctx.fillText(labels[i], x, y - 12); }
      });
    } else {
      board.width = boardLayout === "2x2" ? 1800 : 2200;
      board.height = boardLayout === "2x2" ? 1800 : 2200;
      ctx.fillStyle = "#f6f4f0";
      ctx.fillRect(0, 0, board.width, board.height);
      const coords = boardLayout === "2x2"
        ? [[40, 40, 840, 840], [920, 40, 840, 840], [40, 920, 840, 840], [920, 920, 840, 840]]
        : [[60, 60, 680, 680], [760, 60, 680, 680], [1460, 60, 680, 680], [60, 760, 1030, 1380], [1110, 760, 1030, 1380]];
      assets.slice(0, coords.length).forEach((asset, i) => {
        const [x, y, w, h] = coords[i];
        drawCover(ctx, asset, x, y, w, h);
        if (!hideLabels) {
          ctx.fillStyle = "rgba(0,0,0,0.74)";
          ctx.fillRect(x + 10, y + 10, 180, 28);
          ctx.fillStyle = "#fff";
          ctx.font = "500 16px Arial";
          ctx.fillText(labels[i], x + 18, y + 30);
        }
      });
    }
    return board;
  };

  const applyGraphicStyle = (canvas) => {
    const styled = document.createElement("canvas");
    styled.width = canvas.width;
    styled.height = canvas.height;
    const ctx = styled.getContext("2d");
    ctx.fillStyle = graphicStyle === "Pastel Field" ? "#f4efe8" : "#f7f6f2";
    ctx.fillRect(0, 0, styled.width, styled.height);
    ctx.shadowColor = "rgba(0,0,0,0.14)";
    ctx.shadowBlur = 26;
    ctx.shadowOffsetY = 10;
    ctx.drawImage(canvas, 26, 26, styled.width - 52, styled.height - 90);
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = "rgba(0,0,0,0.2)";
    ctx.lineWidth = 1;
    ctx.strokeRect(26, 26, styled.width - 52, styled.height - 90);
    ctx.fillStyle = "rgba(255,255,255,0.86)";
    ctx.fillRect(26, styled.height - 62, styled.width - 52, 36);
    ctx.fillStyle = "#222";
    ctx.font = "600 14px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText(`${graphicStyle} · ${mode}`, 38, styled.height - 39);
    if (graphicStyle === "High Contrast Plate" || graphicStyle === "Technical Drawing") {
      const img = ctx.getImageData(0, 0, styled.width, styled.height);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = (img.data[i] + img.data[i + 1] + img.data[i + 2]) / 3;
        const c = graphicStyle === "High Contrast Plate" ? (v > 140 ? 245 : 20) : Math.round(v / 24) * 24;
        img.data[i] = c; img.data[i + 1] = c; img.data[i + 2] = c;
      }
      ctx.putImageData(img, 0, 0);
    }
    if (graphicStyle === "Pastel Field" || graphicStyle === "Soft Diagram") {
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = graphicStyle === "Pastel Field" ? "rgba(255,160,120,0.18)" : "rgba(120,170,255,0.14)";
      ctx.fillRect(0, 0, styled.width, styled.height);
      ctx.globalCompositeOperation = "source-over";
    }
    if (graphicStyle === "Lithic Texture") {
      for (let i = 0; i < 26000; i += 1) {
        ctx.fillStyle = Math.random() > 0.5 ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)";
        ctx.fillRect(Math.random() * styled.width, Math.random() * styled.height, 1, 1);
      }
    }
    return styled;
  };

  const generateOutput = async () => {
    if (!resolvedResult) {
      setRenderError("Run Extraction first to generate translation outputs.");
      return;
    }
    setIsRendering(true);
    setRenderError("");
    try {
      let canvas;
      if (mode === MODES[0]) canvas = await renderTaxonomyBoard();
      if (mode === MODES[1]) canvas = await renderHybridLinework();
      if (mode === MODES[2]) canvas = await renderMutationSheet();
      if (mode === MODES[3]) canvas = await renderFieldCondition();
      if (mode === MODES[4]) canvas = await renderMidjourneyBoard();
      const styledCanvas = applyGraphicStyle(canvas);
      const url = styledCanvas.toDataURL(exportFormat === "jpg" ? "image/jpeg" : "image/png", 0.95);
      setOutputUrl(url);
      const result = resolvedResult || {};
      const promptSummary = crossResult?.midjourney?.full_prompt || result?.midjourney?.full_prompt || result?.description || "";
      const translationSettings = {
        preset: activePreset || "Custom",
        mode,
        selected_map: selectedMap,
        line_thickness: lineThickness,
        hatch_density: hatchDensity,
        contour_spacing: contourSpacing,
        node_emphasis: nodeEmphasis,
        flow_intensity: flowIntensity,
        invert_black_white: invertBW,
        drawing_noise: drawingNoise,
        simplification_level: simplification,
        grid_size: gridSize,
        mutation_strength: mutationStrength,
        color_mode: colorMode,
        region_count: regionCount,
        blur_amount: blurAmount,
        contour_levels: contourLevels,
        field_softness: fieldSoftness,
        boundary_sharpness: boundarySharpness,
        palette_colors: fieldPalette,
        transparency: fieldTransparency,
        grain_noise: fieldGrain,
        board_layout: boardLayout,
        hide_labels: hideLabels,
        labels_enabled: !hideLabels,
        metadata_enabled: true,
        graphic_style: graphicStyle,
      };
      onRegisterOutput?.({
        kind: "translation",
        title: mode,
        previewUrl: url,
        metadata: {
          source_image_name: result?.original_name || "Unknown",
          source_tag: result?.tag || "Custom",
          selected_feature_maps: [selectedMap],
          translation_mode: mode,
          transformation_settings: translationSettings,
          feature_weights: {
            blend_weight_a: result?.variant?.blend_weight_a ?? null,
            blend_weight_b: result?.variant?.blend_weight_b ?? null,
            blend_weight_c: result?.variant?.blend_weight_c ?? null,
            fitness_components: result?.variant?.fitness_components || {},
          },
          mutation_seed: mutationSeed,
          export_type: exportFormat,
          generated_prompt_summary: promptSummary,
          lineage: {
            source_image: result?.original_name || "Unknown",
            feature_extraction: mapLabel(selectedMap),
            graphic_translation: mode,
            ai_reference: crossResult?.maps ? "Cross Reference Map" : "Result Prompt Pack",
            architectural_projection: "Pending Projection",
          },
        },
      });
    } catch (error) {
      setRenderError(String(error?.message || "Failed to render translation mode."));
    } finally {
      setIsRendering(false);
    }
  };

  return (
    <section className="glass-panel translation-lab">
      <h3>Translation Mode Generator</h3>
      <div className="preset-grid translation-preset-grid">
        {Object.keys(TRANSLATION_PRESETS).map((name) => (
          <button
            key={name}
            type="button"
            className={activePreset === name ? "preset-card active" : "preset-card"}
            onClick={() => applyPreset(name)}
          >
            <h4>{name}</h4>
            <p>{TRANSLATION_PRESETS[name].mode}</p>
          </button>
        ))}
      </div>
      <CanvasInspectorShell
        className="translation-workspace"
        header={(
          <header className="workspace-head">
            <h3>{resolvedResult?.original_name || "No source selected"}</h3>
            <p className="muted">Mode: {mode} · Map: {mapLabel(selectedMap)}</p>
          </header>
        )}
        main={(
          <>
            <section className="workspace-canvas">
              {outputUrl ? (
                <img src={outputUrl} alt={mode} />
              ) : resolvedResult?.maps?.[selectedMap] ? (
                <img src={mapUrl(apiBase, resolvedResult, selectedMap)} alt={selectedMap} />
              ) : (
                <p className="muted">Generate a mode output to preview the translation plate.</p>
              )}
            </section>
            <section className="workspace-map-strip">
              {MAP_KEYS.filter((key) => key !== "original").slice(0, 8).map((key) => {
                const src = mapUrl(apiBase, resolvedResult, key);
                if (!src) return null;
                return (
                  <button key={key} type="button" className={selectedMap === key ? "map-chip active" : "map-chip"} onClick={() => setSelectedMap(key)}>
                    <img src={src} alt={key} />
                    <span>{mapLabel(key)}</span>
                  </button>
                );
              })}
            </section>
            <section className="workspace-variant-strip">
              {results.slice(0, 12).map((r, idx) => (
                <button key={`${r.original_name}-${idx}`} type="button" className={selectedResult === idx ? "variant-tile active" : "variant-tile"} onClick={() => setSelectedResult(idx)}>
                  <img src={mapUrl(apiBase, r, "composite_map") || mapUrl(apiBase, r, "edge_map")} alt={r.original_name} />
                  <span>Variant {r?.variant?.index || idx + 1}</span>
                </button>
              ))}
            </section>
          </>
        )}
        inspector={(
          <>
            <h4>Inspector</h4>
            <details className="inspector-drawer" open>
              <summary>Source & Mode</summary>
              <div className="field-row">
                <label>Mode</label>
                <select value={mode} onChange={(e) => setMode(e.target.value)}>
                  {MODES.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </div>
              <div className="field-row">
                <label>Result Source</label>
                <select value={selectedResult} onChange={(e) => setSelectedResult(Number(e.target.value))}>
                  {results.map((r, idx) => <option key={`${r.original_name}-${idx}`} value={idx}>{r.original_name}</option>)}
                </select>
              </div>
              <div className="field-row">
                <label>Feature Map</label>
                <select value={selectedMap} onChange={(e) => setSelectedMap(e.target.value)}>
                  {MAP_KEYS.filter((key) => key !== "original").map((key) => <option key={key} value={key}>{mapLabel(key)}</option>)}
                </select>
              </div>
            </details>
            <details className="inspector-drawer" open>
              <summary>Graphic Style</summary>
              <div className="field-row">
                <label>Style Preset</label>
                <select value={graphicStyle} onChange={(e) => setGraphicStyle(e.target.value)}>
                  {GRAPHIC_STYLES.map((style) => <option key={style} value={style}>{style}</option>)}
                </select>
              </div>
            </details>
            <details className="inspector-drawer">
              <summary>Advanced Controls</summary>
      {mode === MODES[1] && (
        <div className="translation-grid compact">
          <label>Line Thickness</label><input type="range" min="0.5" max="3.5" step="0.1" value={lineThickness} onChange={(e) => setLineThickness(Number(e.target.value))} />
          <label>Hatch Density</label><input type="range" min="2" max="18" value={hatchDensity} onChange={(e) => setHatchDensity(Number(e.target.value))} />
          <label>Contour Spacing</label><input type="range" min="8" max="80" value={contourSpacing} onChange={(e) => setContourSpacing(Number(e.target.value))} />
          <label>Node Emphasis</label><input type="range" min="0.2" max="2" step="0.1" value={nodeEmphasis} onChange={(e) => setNodeEmphasis(Number(e.target.value))} />
          <label>Flow Intensity</label><input type="range" min="0.1" max="1.3" step="0.05" value={flowIntensity} onChange={(e) => setFlowIntensity(Number(e.target.value))} />
          <label>Drawing Noise</label><input type="range" min="0" max="0.2" step="0.01" value={drawingNoise} onChange={(e) => setDrawingNoise(Number(e.target.value))} />
          <label>Simplification</label><input type="range" min="0" max="1" step="0.05" value={simplification} onChange={(e) => setSimplification(Number(e.target.value))} />
          <label>Invert B/W</label><input type="checkbox" checked={invertBW} onChange={(e) => setInvertBW(e.target.checked)} />
        </div>
      )}

      {mode === MODES[2] && (
        <div className="translation-grid compact">
          <label>Grid Size</label>
          <select value={gridSize} onChange={(e) => setGridSize(e.target.value)}>
            <option value="3x3">3x3</option>
            <option value="4x4">4x4</option>
          </select>
          <label>Mutation Strength</label><input type="range" min="0.05" max="1" step="0.05" value={mutationStrength} onChange={(e) => setMutationStrength(Number(e.target.value))} />
          <label>Seed</label><input type="number" value={mutationSeed} onChange={(e) => setMutationSeed(Number(e.target.value))} />
          <label>Color Mode</label>
          <select value={colorMode} onChange={(e) => setColorMode(e.target.value)}>
            <option value="bw">Black-and-white mode</option>
            <option value="pastel">Pastel diagram mode</option>
            <option value="high">High-contrast mode</option>
          </select>
        </div>
      )}

      {mode === MODES[3] && (
        <div className="translation-grid compact">
          <label>Region Count</label><input type="range" min="3" max="16" value={regionCount} onChange={(e) => setRegionCount(Number(e.target.value))} />
          <label>Blur Amount</label><input type="range" min="0" max="24" value={blurAmount} onChange={(e) => setBlurAmount(Number(e.target.value))} />
          <label>Contour Levels</label><input type="range" min="3" max="18" value={contourLevels} onChange={(e) => setContourLevels(Number(e.target.value))} />
          <label>Field Softness</label><input type="range" min="0.1" max="1" step="0.05" value={fieldSoftness} onChange={(e) => setFieldSoftness(Number(e.target.value))} />
          <label>Boundary Sharpness</label><input type="range" min="0.1" max="1.5" step="0.05" value={boundarySharpness} onChange={(e) => setBoundarySharpness(Number(e.target.value))} />
          <label>Palette Colors</label><input type="range" min="3" max="8" value={fieldPalette} onChange={(e) => setFieldPalette(Number(e.target.value))} />
          <label>Transparency</label><input type="range" min="0.1" max="1" step="0.05" value={fieldTransparency} onChange={(e) => setFieldTransparency(Number(e.target.value))} />
          <label>Grain / Noise</label><input type="range" min="0" max="0.4" step="0.01" value={fieldGrain} onChange={(e) => setFieldGrain(Number(e.target.value))} />
        </div>
      )}

      {mode === MODES[4] && (
        <div className="translation-grid compact">
          <label>Layout</label>
          <select value={boardLayout} onChange={(e) => setBoardLayout(e.target.value)}>
            <option value="2x2">2x2 board</option>
            <option value="3x3">3x3 board</option>
            <option value="horizontal">horizontal strip</option>
            <option value="vertical">vertical strip</option>
            <option value="atlas">atlas layout</option>
          </select>
          <label>Hide Labels</label><input type="checkbox" checked={hideLabels} onChange={(e) => setHideLabels(e.target.checked)} />
        </div>
      )}
            </details>
            <details className="inspector-drawer" open>
              <summary>Actions</summary>
              <div className="card-actions">
                <button type="button" onClick={generateOutput} disabled={isRendering || !results.length}>
                  {isRendering ? "Rendering..." : "Generate Translation Output"}
                </button>
                {outputUrl ? (
                  <a href={outputUrl} download={`translation-${mode.toLowerCase().replaceAll(" ", "-")}.${exportFormat}`}>
                    Download Output
                  </a>
                ) : null}
              </div>
            </details>
          </>
        )}
      />
      {renderError ? <p className="muted">{renderError}</p> : null}
      <p className="muted">Selected composer sources: {sourceSlots.filter(Boolean).length} / 3</p>
    </section>
  );
}
