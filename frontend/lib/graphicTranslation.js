import {
  applyContourBanding,
  applyDilation,
  applyLineThickening,
  applyMirror,
  applyNoiseDistortion,
  applyPaletteReduction,
  applyRadialRepeat,
  applyRegionSegmentation,
  applyThresholdShift,
  applyTileRepeat,
  clampValue,
  createSeededRandom,
} from "./mutationUtils";

export const TRANSLATION_MODES = [
  "Taxonomy / Lineage Board",
  "Hybrid Linework Plate",
  "Pattern Mutation Sheet",
  "Field Condition Map",
  "MidJourney Reference Board",
];

export function mapModeLabel(mode) {
  return TRANSLATION_MODES.includes(mode) ? mode : "Custom Translation";
}

export function buildTranslationSettings(mode, settings = {}) {
  return {
    mode: mapModeLabel(mode),
    ...settings,
  };
}

function drawCover(ctx, img, x, y, w, h) {
  const ratio = Math.max(w / img.width, h / img.height);
  const dw = img.width * ratio;
  const dh = img.height * ratio;
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2;
  ctx.drawImage(img, dx, dy, dw, dh);
}

async function toCanvas(source, fallbackSize = 1400) {
  const canvas = document.createElement("canvas");
  if (!source) {
    canvas.width = fallbackSize;
    canvas.height = fallbackSize;
    return canvas;
  }
  if (source instanceof HTMLCanvasElement) return source;
  if (source instanceof ImageData) {
    canvas.width = source.width;
    canvas.height = source.height;
    canvas.getContext("2d").putImageData(source, 0, 0);
    return canvas;
  }
  if (source instanceof HTMLImageElement) {
    canvas.width = source.width;
    canvas.height = source.height;
    canvas.getContext("2d").drawImage(source, 0, 0);
    return canvas;
  }
  if (typeof source === "string") {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.crossOrigin = "anonymous";
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error(`Failed loading: ${source}`));
      el.src = source;
    });
    canvas.width = img.width;
    canvas.height = img.height;
    canvas.getContext("2d").drawImage(img, 0, 0);
    return canvas;
  }
  canvas.width = source.width || fallbackSize;
  canvas.height = source.height || fallbackSize;
  canvas.getContext("2d").drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function selectMapArray(selectedMaps = []) {
  if (Array.isArray(selectedMaps)) return selectedMaps;
  if (selectedMaps && typeof selectedMaps === "object") return Object.values(selectedMaps);
  return [];
}

export async function generateTaxonomyBoard(sourceImage, selectedMaps, options = {}) {
  const cards = [
    { label: "source archive", image: sourceImage },
    { label: options.featureLabel || "edge extraction", image: selectMapArray(selectedMaps)[0] },
    { label: options.translationLabel || "graphic mutation", image: options.abstractGraphic || selectMapArray(selectedMaps)[1] || selectMapArray(selectedMaps)[0] },
    { label: options.aiLabel || "AI reference", image: options.aiReference || selectMapArray(selectedMaps)[2] || selectMapArray(selectedMaps)[0] },
  ];
  const resolved = await Promise.all(cards.map(async (c) => ({ ...c, canvas: await toCanvas(c.image, 600) })));
  const board = document.createElement("canvas");
  board.width = options.width || 1800;
  board.height = options.height || 1200;
  const ctx = board.getContext("2d");
  ctx.fillStyle = options.background || "#f5f4ef";
  ctx.fillRect(0, 0, board.width, board.height);
  const startX = 70;
  const cardW = 390;
  const gap = 30;
  resolved.forEach((card, idx) => {
    const x = startX + idx * (cardW + gap);
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "rgba(0,0,0,0.2)";
    ctx.fillRect(x, 260, cardW, 520);
    ctx.strokeRect(x, 260, cardW, 520);
    drawCover(ctx, card.canvas, x + 18, 318, 354, 390);
    ctx.fillStyle = "#222";
    ctx.font = "600 20px Georgia";
    ctx.fillText(card.label, x + 18, 296);
    if (idx < resolved.length - 1) {
      ctx.beginPath();
      ctx.moveTo(x + cardW, 520);
      ctx.lineTo(x + cardW + gap, 520);
      ctx.stroke();
    }
  });
  ctx.font = "700 33px Georgia";
  ctx.fillText("Taxonomy / Lineage Board", 70, 106);
  return board;
}

export async function generateHybridLineworkPlate(maps, options = {}) {
  const [edge, node, flow, density] = await Promise.all([
    toCanvas(maps.edge_map || maps.edge || maps[0]),
    toCanvas(maps.node_map || maps.node || maps[1] || maps.edge_map || maps[0]),
    toCanvas(maps.flow_map || maps.flow || maps[2] || maps.edge_map || maps[0]),
    toCanvas(maps.density_map || maps.density || maps[3] || maps.edge_map || maps[0]),
  ]);
  const size = options.size || 1400;
  const out = document.createElement("canvas");
  out.width = size;
  out.height = size;
  const ctx = out.getContext("2d");
  ctx.fillStyle = options.invertBW ? "#000" : "#fff";
  ctx.fillRect(0, 0, size, size);
  drawCover(ctx, edge, 0, 0, size, size);
  ctx.globalAlpha = clampValue(options.flowIntensity ?? 0.7, 0, 1);
  drawCover(ctx, flow, 0, 0, size, size);
  ctx.globalAlpha = clampValue(options.nodeEmphasis ?? 1.1, 0.1, 2) * 0.4;
  drawCover(ctx, node, 0, 0, size, size);
  ctx.globalAlpha = 0.2;
  drawCover(ctx, density, 0, 0, size, size);
  ctx.globalAlpha = 1;
  const img = ctx.getImageData(0, 0, size, size);
  const shifted = applyThresholdShift(img, options.simplificationLevel ? options.simplificationLevel * 90 : 0);
  const thickened = applyLineThickening(shifted, options.lineThickness || 1);
  const noisy = applyNoiseDistortion(thickened, options.drawingNoise || 0.03, options.seed || 11);
  ctx.putImageData(noisy, 0, 0);
  return out;
}

export async function generatePatternMutationSheet(baseMap, options = {}) {
  const source = await toCanvas(baseMap, 1000);
  const grid = options.gridSize === "4x4" ? 4 : 3;
  const size = options.size || 1600;
  const gap = 20;
  const cell = Math.floor((size - gap * (grid + 1)) / grid);
  const sheet = document.createElement("canvas");
  sheet.width = size;
  sheet.height = size;
  const ctx = sheet.getContext("2d");
  ctx.fillStyle = "#faf9f7";
  ctx.fillRect(0, 0, size, size);
  const rand = createSeededRandom(options.seed || 42);
  const operations = [
    (img) => applyThresholdShift(img, (options.mutationStrength || 0.4) * 80),
    (img) => applyLineThickening(img, 1 + (options.mutationStrength || 0.4) * 2),
    (img) => applyMirror(img, "x"),
    (img) => applyMirror(img, "y"),
    (img) => applyTileRepeat(img, 2, 2),
    (img) => applyRadialRepeat(img, 6),
    (img) => applyContourBanding(img, 7),
    (img) => applyRegionSegmentation(img, 5),
    (img) => applyNoiseDistortion(img, options.mutationStrength || 0.4, options.seed || 42),
    (img) => applyPaletteReduction(img, 4),
    (img) => applyDilation(img, 2),
    (img) => applyNoiseDistortion(img, 0.15, Math.floor(rand() * 10000)),
  ];
  for (let i = 0; i < grid * grid; i += 1) {
    const x = gap + (i % grid) * (cell + gap);
    const y = gap + Math.floor(i / grid) * (cell + gap);
    const local = document.createElement("canvas");
    local.width = cell;
    local.height = cell;
    const lctx = local.getContext("2d");
    drawCover(lctx, source, 0, 0, cell, cell);
    const baseImg = lctx.getImageData(0, 0, cell, cell);
    const op = operations[i % operations.length];
    const next = op(baseImg);
    lctx.putImageData(next, 0, 0);
    ctx.drawImage(local, x, y);
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.strokeRect(x, y, cell, cell);
  }
  return sheet;
}

export async function generateFieldConditionMap(maps, options = {}) {
  const [density, shadow, flow] = await Promise.all([
    toCanvas(maps.density_map || maps.density || maps[0]),
    toCanvas(maps.shadow_depth_map || maps.shadow || maps[1] || maps[0]),
    toCanvas(maps.flow_map || maps.flow || maps[2] || maps[0]),
  ]);
  const size = options.size || 1500;
  const out = document.createElement("canvas");
  out.width = size;
  out.height = size;
  const ctx = out.getContext("2d");
  ctx.fillStyle = "#f7f6f2";
  ctx.fillRect(0, 0, size, size);
  drawCover(ctx, density, 0, 0, size, size);
  ctx.globalAlpha = options.fieldSoftness ?? 0.6;
  ctx.filter = `blur(${Math.round(options.blurAmount ?? 12)}px)`;
  drawCover(ctx, shadow, 0, 0, size, size);
  ctx.filter = "none";
  ctx.globalAlpha = options.transparency ?? 0.65;
  drawCover(ctx, flow, 0, 0, size, size);
  ctx.globalAlpha = 1;
  const levels = options.contourLevels || 8;
  const data = applyContourBanding(ctx.getImageData(0, 0, size, size), levels);
  const segmented = applyRegionSegmentation(data, options.paletteColors || 5);
  const final = applyNoiseDistortion(segmented, options.grainNoise || 0.08, options.seed || 17);
  ctx.putImageData(final, 0, 0);
  return out;
}

export async function generateMidjourneyReferenceBoard(sourceImage, maps, translations, options = {}) {
  const source = await toCanvas(sourceImage, 900);
  const analytical = await toCanvas(maps?.analytical || maps?.edge_map || maps?.composite_map || maps?.[0], 900);
  const linework = await toCanvas(translations?.linework || translations?.hybrid || maps?.composite_map || maps?.[0], 900);
  const field = await toCanvas(translations?.field || maps?.density_map || maps?.[0], 900);
  const mutation = await toCanvas(translations?.mutation || maps?.composite_map || maps?.[0], 900);
  const layout = options.layout || "atlas";
  const board = document.createElement("canvas");
  const ctx = board.getContext("2d");
  const labels = ["source", "analytical map", "linework", "field condition", "mutation"];
  const assets = [source, analytical, linework, field, mutation];
  if (layout === "horizontal strip") {
    board.width = 2400; board.height = 760;
    ctx.fillStyle = "#f2f2f2"; ctx.fillRect(0, 0, board.width, board.height);
    assets.forEach((asset, i) => {
      drawCover(ctx, asset, 30 + i * 470, 70, 440, 620);
      if (!options.hideLabels) { ctx.fillStyle = "#111"; ctx.font = "500 18px Arial"; ctx.fillText(labels[i], 30 + i * 470, 44); }
    });
    return board;
  }
  if (layout === "vertical strip") {
    board.width = 820; board.height = 3000;
    ctx.fillStyle = "#f2f2f2"; ctx.fillRect(0, 0, board.width, board.height);
    assets.forEach((asset, i) => {
      const y = 40 + i * 580;
      drawCover(ctx, asset, 40, y, 740, 520);
      if (!options.hideLabels) { ctx.fillStyle = "#111"; ctx.font = "500 18px Arial"; ctx.fillText(labels[i], 40, y - 12); }
    });
    return board;
  }
  const is2x2 = layout === "2x2 board";
  board.width = is2x2 ? 1800 : 2200;
  board.height = is2x2 ? 1800 : 2200;
  ctx.fillStyle = "#f6f4f0";
  ctx.fillRect(0, 0, board.width, board.height);
  const coords = is2x2
    ? [[40, 40, 840, 840], [920, 40, 840, 840], [40, 920, 840, 840], [920, 920, 840, 840]]
    : [[60, 60, 680, 680], [760, 60, 680, 680], [1460, 60, 680, 680], [60, 760, 1030, 1380], [1110, 760, 1030, 1380]];
  assets.slice(0, coords.length).forEach((asset, i) => {
    const [x, y, w, h] = coords[i];
    drawCover(ctx, asset, x, y, w, h);
    if (!options.hideLabels) {
      ctx.fillStyle = "rgba(0,0,0,0.74)";
      ctx.fillRect(x + 10, y + 10, 180, 28);
      ctx.fillStyle = "#fff";
      ctx.font = "500 16px Arial";
      ctx.fillText(labels[i], x + 18, y + 30);
    }
  });
  return board;
}
