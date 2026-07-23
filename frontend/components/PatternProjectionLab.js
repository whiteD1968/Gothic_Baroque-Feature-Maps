import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  NodeResizer,
  Position,
  ReactFlow,
  applyNodeChanges,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { contours as d3Contours } from "d3-contour";
import paper from "paper";
import { downloadDataUrl, downloadText } from "../lib/grasshopperExportUtils";

const MAP_TYPES = [
  { key: "edge", label: "Edge", mode: "edge" },
  { key: "density", label: "Density", mode: "density" },
  { key: "flow", label: "Flow", mode: "flow" },
  { key: "zones", label: "Material Zones", mode: "zones" },
  { key: "height", label: "Height", mode: "height" },
  { key: "composite", label: "Composite", mode: "composite" },
];

const INITIAL_NODES = {
  database: { x: 80, y: 40, w: 340 },
  blend: { x: 920, y: 560, w: 370 },
  branch: { x: 1380, y: 560, w: 350 },
  print: { x: 80, y: 1120, w: 370 },
  printMatrix: { x: 80, y: 1600, w: 410 },
  printExport: { x: 570, y: 1600, w: 350 },
  pixelLoom: { x: 570, y: 1120, w: 390 },
  pixelLoomMatrix: { x: 570, y: 2060, w: 430 },
  pixelLoomExport: { x: 1040, y: 2060, w: 350 },
  matrix: { x: 1380, y: 1020, w: 380 },
  mesh: { x: 1840, y: 1020, w: 400 },
  export: { x: 920, y: 1020, w: 350 },
};

const PALETTE = ["#cbdac3", "#a6c0b1", "#e3d9b1", "#d99ab0", "#8fbfd0", "#22272b"];
const PRINT_PALETTES = {
  circuit: ["#101214", "#22c5cc", "#ef3f2f", "#f4f0dd", "#9fb8ad"],
  atlas: ["#0b2f3f", "#ff4564", "#ffd33d", "#45d4c8", "#f4f1e7", "#7d5cff"],
  pastel: ["#22272b", "#77c7de", "#f0c4d6", "#f4c80f", "#8c94a5", "#f3eee4"],
  mono: ["#111111", "#f7f6f2", "#777777", "#d2d2d2"],
};

function getPrintPalette(options = {}) {
  const custom = Array.isArray(options.customPalette)
    ? options.customPalette.filter((color) => /^#[0-9a-f]{6}$/i.test(color))
    : [];
  if (options.palette === "custom" && custom.length) return custom;
  return PRINT_PALETTES[options.palette || "atlas"] || PRINT_PALETTES.atlas;
}

const DEFAULT_MIXER_OPTIONS = {
  scale: 1.05,
  rotation: 0,
  threshold: 90,
  displacement: 0.34,
  zoneCount: 5,
  blendMode: "multiply",
  heightPower: 1.15,
};

const DEFAULT_PRINT_OPTIONS = {
  method: "layered collage",
  palette: "atlas",
  customPalette: ["#101214", "#22c5cc", "#ef3f2f", "#f4f0dd"],
  paperTool: "path simplify",
  toolStrength: 0.5,
  voronoiCells: 42,
  offsetSteps: 4,
  pathSimplify: 0.8,
  lineSpacing: 12,
  lineWeight: 5,
  dotSpacing: 15,
  dotScale: 0.46,
  stripCount: 28,
  rotation: -32,
  edgeOverlay: 0.12,
  contourOverlay: true,
  contourThreshold: 0.52,
  contourLevels: 4,
  darkGround: false,
};

const PIXEL_LOOM_PALETTES = {
  smalley: ["#050607", "#f0ef24", "#e5232c", "#315d9a", "#f8f6e8"],
  manuscript: ["#17120f", "#d7b64a", "#b63d45", "#2f6f78", "#f4ead0"],
  circuit: ["#050607", "#d7e546", "#e12a32", "#315d9a", "#f7f7f1"],
  glass: ["#101214", "#f7d84b", "#d64045", "#227c9d", "#f5f1da", "#7d3c98"],
};

const DEFAULT_PIXEL_LOOM_OPTIONS = {
  seedType: "checker",
  gridSize: 32,
  outputSize: 900,
  layerCount: 5,
  rotation: 5,
  rotationJitter: 1.4,
  scale: 1.16,
  tileRepeat: 5,
  blendMode: "difference",
  palette: "smalley",
  sourceInfluence: 0.42,
  dither: 0.35,
  weave: 0.28,
  darkGround: true,
  nearest: true,
};

const DEFAULT_MESH_OPTIONS = {
  viewMode: "solid",
  uvProjection: "auto",
  textureScale: 1,
  textureRotation: 0,
  bumpStrength: 0.35,
  heightSource: "luminance",
  heightLow: 0,
  heightHigh: 1,
  heightGamma: 1,
  heightInvert: false,
  heightColor: "#e3c9d8",
  heightColorTolerance: 0.35,
  prepMode: "clean",
  subdivision: 0,
  smoothIterations: 0,
  smoothStrength: 0.35,
  smoothShading: true,
  showEdges: false,
};

const DEFAULT_MAP_EDIT = {
  pixelSize: 1,
  zones: 6,
  threshold: 0,
  contrast: 1,
  blur: 0,
  invert: false,
  smooth: false,
};

function resolveMapUrl(path, apiBase) {
  if (!path) return "";
  if (String(path).startsWith("blob:") || String(path).startsWith("data:") || String(path).startsWith("http")) return path;
  return `${apiBase}/api/download/file?path=${encodeURIComponent(path)}`;
}

function mapTitle(key) {
  return key.replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function makeCanvas(size = 512) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function imageToCanvas(image, size = 512) {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#eeede9";
  ctx.fillRect(0, 0, size, size);
  const scale = Math.max(size / image.width, size / image.height);
  const w = image.width * scale;
  const h = image.height * scale;
  ctx.drawImage(image, (size - w) / 2, (size - h) / 2, w, h);
  return canvas;
}

function quantize(value, steps) {
  return Math.max(0, Math.min(steps - 1, Math.floor((value / 256) * steps)));
}

function deriveMapFromCanvas(sourceCanvas, mode, seed = 0) {
  const size = 512;
  const base = makeCanvas(size);
  const bctx = base.getContext("2d");
  bctx.drawImage(sourceCanvas, 0, 0, size, size);
  const src = bctx.getImageData(0, 0, size, size);
  const out = bctx.createImageData(size, size);
  const data = src.data;
  const target = out.data;

  for (let y = 1; y < size - 1; y += 1) {
    for (let x = 1; x < size - 1; x += 1) {
      const idx = (y * size + x) * 4;
      const l = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
      const left = ((y * size + x - 1) * 4);
      const right = ((y * size + x + 1) * 4);
      const up = (((y - 1) * size + x) * 4);
      const down = (((y + 1) * size + x) * 4);
      const lx = (data[right] + data[right + 1] + data[right + 2] - data[left] - data[left + 1] - data[left + 2]) / 3;
      const ly = (data[down] + data[down + 1] + data[down + 2] - data[up] - data[up + 1] - data[up + 2]) / 3;
      const mag = Math.min(255, Math.sqrt(lx * lx + ly * ly) * 1.7);
      const wave = Math.sin((x + seed * 19) * 0.045) * Math.cos((y - seed * 13) * 0.035);

      let r = l;
      let g = l;
      let b = l;
      if (mode === "edge") {
        r = g = b = mag > 36 ? 18 : 245;
      } else if (mode === "density") {
        const d = Math.min(255, mag * 0.5 + l * 0.45 + (wave + 1) * 32);
        r = g = b = d;
      } else if (mode === "flow") {
        const angle = Math.atan2(ly, lx);
        r = 120 + Math.cos(angle + seed) * 95;
        g = 120 + Math.sin(angle * 1.7) * 88;
        b = Math.min(255, mag * 1.4);
      } else if (mode === "zones") {
        const q = quantize(l + wave * 28 + seed * 8, 5);
        const hex = PALETTE[q];
        r = parseInt(hex.slice(1, 3), 16);
        g = parseInt(hex.slice(3, 5), 16);
        b = parseInt(hex.slice(5, 7), 16);
      } else if (mode === "height") {
        const h = Math.min(255, Math.max(0, l * 0.58 + mag * 0.72 + (wave + 1) * 26));
        r = g = b = h;
      } else if (mode === "composite") {
        r = Math.min(255, mag * 1.25 + l * 0.35);
        g = Math.min(255, l * 0.7 + (wave + 1) * 44);
        b = Math.min(255, 90 + Math.abs(lx) * 0.8 + Math.abs(ly) * 0.35);
      }
      target[idx] = r;
      target[idx + 1] = g;
      target[idx + 2] = b;
      target[idx + 3] = 255;
    }
  }

  const canvas = makeCanvas(size);
  const ctx = canvas.getContext("2d");
  ctx.putImageData(out, 0, 0);
  return canvas;
}

function editMapCanvas(inputCanvas, settings = {}) {
  const size = 512;
  const merged = { ...DEFAULT_MAP_EDIT, ...settings };
  const pixelSize = Math.max(1, Number(merged.pixelSize || 1));
  const zones = Math.max(2, Number(merged.zones || 6));
  const threshold = Number(merged.threshold || 0);
  const contrast = Number(merged.contrast || 1);
  const blur = Number(merged.blur || 0);
  const smooth = Boolean(merged.smooth);
  const tiny = makeCanvas(Math.max(8, Math.floor(size / pixelSize)));
  const tctx = tiny.getContext("2d");
  tctx.imageSmoothingEnabled = smooth;
  tctx.filter = blur > 0 ? `blur(${blur}px)` : "none";
  tctx.drawImage(inputCanvas, 0, 0, tiny.width, tiny.height);

  const canvas = makeCanvas(size);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tiny, 0, 0, size, size);
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    let l = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
    l = Math.max(0, Math.min(255, (l - 128) * contrast + 128));
    if (merged.invert) l = 255 - l;
    if (threshold > 0 && l < threshold) {
      d[i] = d[i + 1] = d[i + 2] = 0;
      continue;
    }
    if (zones < 6) {
      const q = quantize(l, zones);
      const hex = PALETTE[q % PALETTE.length];
      d[i] = d[i] * 0.42 + parseInt(hex.slice(1, 3), 16) * 0.58;
      d[i + 1] = d[i + 1] * 0.42 + parseInt(hex.slice(3, 5), 16) * 0.58;
      d[i + 2] = d[i + 2] * 0.42 + parseInt(hex.slice(5, 7), 16) * 0.58;
    } else {
      d[i] = d[i] * contrast;
      d[i + 1] = d[i + 1] * contrast;
      d[i + 2] = d[i + 2] * contrast;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function buildVariantCanvas(mapCanvases, options, index) {
  const size = 512;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ecebe7";
  ctx.fillRect(0, 0, size, size);

  const a = mapCanvases[index % mapCanvases.length]?.canvas;
  const b = mapCanvases[(index + 2) % mapCanvases.length]?.canvas;
  if (!a) return canvas;

  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.rotate(((options.rotation + index * 11) * Math.PI) / 180);
  const scale = options.scale + (index % 3) * 0.12;
  ctx.scale(scale, scale);
  ctx.globalAlpha = 0.84;
  ctx.drawImage(a, -size / 2, -size / 2, size, size);
  if (b) {
    ctx.globalCompositeOperation = options.blendMode || (index % 2 ? "multiply" : "screen");
    ctx.globalAlpha = 0.52;
    ctx.drawImage(b, -size / 2 + index * 9, -size / 2 - index * 7, size, size);
  }
  ctx.restore();

  ctx.globalCompositeOperation = "source-over";
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const l = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
    if (l < options.threshold) {
      d[i] *= 0.52;
      d[i + 1] *= 0.52;
      d[i + 2] *= 0.52;
    }
    if (options.heightPower !== 1) {
      const powered = Math.pow(l / 255, options.heightPower) * 255;
      d[i] = d[i] * 0.72 + powered * 0.28;
      d[i + 1] = d[i + 1] * 0.72 + powered * 0.28;
      d[i + 2] = d[i + 2] * 0.72 + powered * 0.28;
    }
    if (options.zoneCount < 6) {
      const q = quantize(l, options.zoneCount);
      const hex = PALETTE[q % PALETTE.length];
      d[i] = d[i] * 0.58 + parseInt(hex.slice(1, 3), 16) * 0.42;
      d[i + 1] = d[i + 1] * 0.58 + parseInt(hex.slice(3, 5), 16) * 0.42;
      d[i + 2] = d[i + 2] * 0.58 + parseInt(hex.slice(5, 7), 16) * 0.42;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function sampleLightness(canvas, x, y) {
  const ctx = canvas.getContext("2d");
  const px = ctx.getImageData(Math.max(0, Math.min(canvas.width - 1, x)), Math.max(0, Math.min(canvas.height - 1, y)), 1, 1).data;
  return (px[0] * 0.299 + px[1] * 0.587 + px[2] * 0.114) / 255;
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
}

function hexToRgb(hex) {
  const clean = String(hex || "").replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(clean)) return { r: 0, g: 0, b: 0 };
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function normalizeHex(value, fallback = "#101214") {
  const next = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(next) ? next.toLowerCase() : fallback;
}

function analyzeCanvas(canvas) {
  const size = 96;
  const sample = makeCanvas(size);
  const ctx = sample.getContext("2d");
  ctx.drawImage(canvas, 0, 0, size, size);
  const data = ctx.getImageData(0, 0, size, size).data;
  const bins = new Map();
  let sum = 0;
  let sumSq = 0;
  let edges = 0;
  let horizontal = 0;
  let vertical = 0;

  for (let y = 1; y < size - 1; y += 1) {
    for (let x = 1; x < size - 1; x += 1) {
      const idx = (y * size + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const l = r * 0.299 + g * 0.587 + b * 0.114;
      const right = (y * size + x + 1) * 4;
      const down = ((y + 1) * size + x) * 4;
      const lx = Math.abs((data[right] + data[right + 1] + data[right + 2]) / 3 - l);
      const ly = Math.abs((data[down] + data[down + 1] + data[down + 2]) / 3 - l);
      edges += lx + ly > 48 ? 1 : 0;
      horizontal += lx;
      vertical += ly;
      sum += l;
      sumSq += l * l;
      const key = `${Math.round(r / 42) * 42},${Math.round(g / 42) * 42},${Math.round(b / 42) * 42}`;
      bins.set(key, (bins.get(key) || 0) + 1);
    }
  }

  const count = (size - 2) * (size - 2);
  const mean = sum / count;
  const variance = Math.max(0, sumSq / count - mean * mean);
  const edgeDensity = edges / count;
  const palette = [...bins.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key]) => rgbToHex(...key.split(",").map(Number)));
  const tags = [];
  if (edgeDensity > 0.24) tags.push("porous");
  if (edgeDensity > 0.34) tags.push("high frequency");
  if (Math.sqrt(variance) > 58) tags.push("high contrast");
  if (horizontal > vertical * 1.18) tags.push("vertical seams");
  if (vertical > horizontal * 1.18) tags.push("horizontal strata");
  if (mean < 92) tags.push("dark mass");
  if (mean > 168) tags.push("pale field");
  if (!tags.length) tags.push("balanced grain");

  return {
    palette,
    edgeDensity,
    contrast: Math.sqrt(variance) / 255,
    mean: mean / 255,
    direction: horizontal > vertical ? "vertical" : "horizontal",
    tags,
  };
}

function getContourSegments(inputCanvas, threshold = 0.52, step = 10) {
  const size = inputCanvas.width;
  const segments = [];
  const interp = (a, b, av, bv) => {
    const denom = bv - av;
    const t = Math.abs(denom) < 0.0001 ? 0.5 : (threshold - av) / denom;
    return a + Math.max(0, Math.min(1, t)) * (b - a);
  };
  for (let y = 0; y < size - step; y += step) {
    for (let x = 0; x < size - step; x += step) {
      const tl = sampleLightness(inputCanvas, x, y);
      const tr = sampleLightness(inputCanvas, x + step, y);
      const br = sampleLightness(inputCanvas, x + step, y + step);
      const bl = sampleLightness(inputCanvas, x, y + step);
      const pts = [];
      if ((tl >= threshold) !== (tr >= threshold)) pts.push({ x: interp(x, x + step, tl, tr), y });
      if ((tr >= threshold) !== (br >= threshold)) pts.push({ x: x + step, y: interp(y, y + step, tr, br) });
      if ((bl >= threshold) !== (br >= threshold)) pts.push({ x: interp(x, x + step, bl, br), y: y + step });
      if ((tl >= threshold) !== (bl >= threshold)) pts.push({ x, y: interp(y, y + step, tl, bl) });
      if (pts.length === 2) segments.push([pts[0], pts[1]]);
      if (pts.length === 4) {
        segments.push([pts[0], pts[1]]);
        segments.push([pts[2], pts[3]]);
      }
    }
  }
  return segments;
}

function getD3ContourRings(inputCanvas, thresholds = [0.52], resolution = 128) {
  const sample = makeCanvas(resolution);
  const ctx = sample.getContext("2d");
  ctx.drawImage(inputCanvas, 0, 0, resolution, resolution);
  const data = ctx.getImageData(0, 0, resolution, resolution).data;
  const values = new Array(resolution * resolution);
  for (let y = 0; y < resolution; y += 1) {
    for (let x = 0; x < resolution; x += 1) {
      const idx = (y * resolution + x) * 4;
      values[y * resolution + x] = (data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114) / 255;
    }
  }
  return d3Contours()
    .size([resolution, resolution])
    .thresholds(thresholds)(values)
    .flatMap((contour) => contour.coordinates.flatMap((polygon) => polygon))
    .map((ring) => ring.map(([x, y]) => ({
      x: (x / resolution) * inputCanvas.width,
      y: (y / resolution) * inputCanvas.height,
    })))
    .filter((ring) => ring.length > 3);
}

function drawContourOverlay(ctx, source, options, palette, index = 0) {
  const levels = Math.max(1, Number(options.contourLevels || 1));
  const scale = ctx.canvas.width / source.width;
  ctx.save();
  ctx.globalAlpha = 0.72;
  ctx.lineCap = "round";
  const thresholds = Array.from({ length: levels }, (_, i) => (
    Math.max(0.08, Math.min(0.92, Number(options.contourThreshold || 0.5) + (i - (levels - 1) / 2) * 0.08))
  ));
  getD3ContourRings(source, thresholds, 128).forEach((ring, ringIndex) => {
    ctx.strokeStyle = palette[(ringIndex + index + 1) % palette.length];
    ctx.lineWidth = Math.max(1.2, Number(options.lineWeight || 4) * 0.26);
    ctx.beginPath();
    ring.forEach((point, pointIndex) => {
      const x = point.x * scale;
      const y = point.y * scale;
      if (pointIndex === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.stroke();
  });
  ctx.restore();
}

function drawDotMatrix(ctx, source, palette, step, radiusScale, alpha = 0.78, offset = 0) {
  for (let y = step / 2; y < source.height; y += step) {
    for (let x = step / 2; x < source.width; x += step) {
      const l = sampleLightness(source, Math.floor(x), Math.floor(y));
      const r = Math.max(1.2, (1 - l) * step * radiusScale);
      const color = palette[Math.floor((l * (palette.length - 1) + offset) % palette.length)];
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawLineField(ctx, source, palette, spacing, angle, weightScale, alpha = 0.8) {
  const size = source.width;
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.rotate((angle * Math.PI) / 180);
  ctx.translate(-size / 2, -size / 2);
  for (let y = -size; y < size * 2; y += spacing) {
    for (let x = 0; x < size; x += spacing * 1.6) {
      const sx = Math.max(0, Math.min(size - 1, Math.floor(x)));
      const sy = Math.max(0, Math.min(size - 1, Math.floor((y + size) % size)));
      const l = sampleLightness(source, sx, sy);
      const len = spacing * (2.5 + (1 - l) * 8);
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = palette[Math.floor((1 - l) * (palette.length - 1))];
      ctx.lineWidth = Math.max(1, (1 - l) * weightScale);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + len, y);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawStripCollage(ctx, source, palette, count, angle, alpha = 0.72) {
  const size = source.width;
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.rotate((angle * Math.PI) / 180);
  ctx.translate(-size / 2, -size / 2);
  const strip = Math.max(8, Math.floor(size / count));
  for (let i = -count; i < count * 2; i += 1) {
    const x = i * strip;
    const l = sampleLightness(source, Math.abs(x) % size, (i * 37) % size);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = palette[i % 3 === 0 ? 0 : Math.floor(l * (palette.length - 1))];
    ctx.fillRect(x, 0, strip * (0.35 + l * 1.2), size);
    if (i % 2 === 0) {
      ctx.strokeStyle = palette[(i + 2) % palette.length];
      ctx.lineWidth = Math.max(1, strip * 0.08);
      ctx.beginPath();
      ctx.moveTo(x + strip * 0.5, 0);
      ctx.lineTo(x + strip * 0.5, size);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function seededRandom(seed) {
  let value = Math.sin(seed * 999.13) * 10000;
  return () => {
    value = Math.sin(value + 12.9898) * 43758.5453;
    return value - Math.floor(value);
  };
}

function drawVoronoiCells(ctx, source, palette, count = 42, strength = 0.5, index = 0) {
  const size = source.width;
  const rand = seededRandom(count + index * 17);
  const sites = Array.from({ length: Math.max(8, Math.min(120, count)) }, (_, i) => {
    const x = rand() * size;
    const y = rand() * size;
    const l = sampleLightness(source, Math.floor(x), Math.floor(y));
    return {
      x,
      y,
      color: palette[(Math.floor((1 - l) * (palette.length - 1)) + i) % palette.length],
    };
  });
  const cell = Math.max(8, Math.floor(size / Math.sqrt(sites.length * 3.2)));
  ctx.save();
  ctx.globalAlpha = 0.2 + strength * 0.36;
  for (let y = 0; y < size; y += cell) {
    for (let x = 0; x < size; x += cell) {
      let closest = sites[0];
      let best = Infinity;
      sites.forEach((site) => {
        const d = (site.x - x) ** 2 + (site.y - y) ** 2;
        if (d < best) {
          best = d;
          closest = site;
        }
      });
      ctx.fillStyle = closest.color;
      ctx.fillRect(x, y, cell + 1, cell + 1);
    }
  }
  ctx.globalAlpha = 0.45 + strength * 0.35;
  ctx.strokeStyle = palette[0];
  ctx.lineWidth = Math.max(0.7, strength * 2.4);
  sites.forEach((site, i) => {
    for (let j = i + 1; j < sites.length; j += 1) {
      const other = sites[j];
      const d = Math.hypot(site.x - other.x, site.y - other.y);
      if (d < size * 0.18) {
        ctx.beginPath();
        ctx.moveTo(site.x, site.y);
        ctx.lineTo(other.x, other.y);
        ctx.stroke();
      }
    }
  });
  ctx.restore();
}

function drawMetaballField(ctx, source, palette, count = 42, strength = 0.5, index = 0) {
  const size = source.width;
  const rand = seededRandom(90 + count + index * 23);
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (let i = 0; i < count; i += 1) {
    const x = rand() * size;
    const y = rand() * size;
    const l = sampleLightness(source, Math.floor(x), Math.floor(y));
    const radius = (16 + (1 - l) * 70) * (0.6 + strength);
    const color = palette[(i + Math.floor(l * palette.length)) % palette.length];
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `${color}dd`);
    gradient.addColorStop(0.55, `${color}55`);
    gradient.addColorStop(1, `${color}00`);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawOffsetContours(ctx, source, options, palette, index = 0) {
  const steps = Math.max(1, Number(options.offsetSteps || 1));
  const strength = Number(options.toolStrength || 0.5);
  const levels = Math.max(1, Number(options.contourLevels || 1));
  const thresholds = Array.from({ length: levels }, (_, i) => (
    Math.max(0.08, Math.min(0.92, Number(options.contourThreshold || 0.5) + (i - (levels - 1) / 2) * 0.08))
  ));
  const scale = ctx.canvas.width / source.width;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  getD3ContourRings(source, thresholds, 128).forEach((ring, ringIndex) => {
    for (let step = 0; step < steps; step += 1) {
      const offset = (step - (steps - 1) / 2) * (2 + strength * 8);
      ctx.globalAlpha = Math.max(0.14, 0.5 - step * 0.06);
      ctx.strokeStyle = palette[(ringIndex + step + index) % palette.length];
      ctx.lineWidth = Math.max(0.8, Number(options.lineWeight || 4) * (0.18 + strength * 0.08));
      ctx.beginPath();
      ring.forEach((point, pointIndex) => {
        const x = point.x * scale + offset;
        const y = point.y * scale - offset;
        if (pointIndex === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.stroke();
    }
  });
  ctx.restore();
}

function drawRasterDivision(ctx, source, palette, strength = 0.5, index = 0) {
  const size = source.width;
  const step = Math.max(14, Math.floor(54 - strength * 32));
  ctx.save();
  ctx.globalAlpha = 0.32 + strength * 0.34;
  for (let y = 0; y < size; y += step) {
    for (let x = 0; x < size; x += step) {
      const l = sampleLightness(source, x, y);
      const w = step * (0.4 + (1 - l) * 1.2);
      const h = step * (0.35 + l * 1.25);
      ctx.fillStyle = palette[(Math.floor((1 - l) * (palette.length - 1)) + index) % palette.length];
      ctx.fillRect(x, y, Math.min(w, step * 1.8), Math.min(h, step * 1.8));
      if ((x / step + y / step + index) % 3 === 0) {
        ctx.strokeStyle = palette[(index + 2) % palette.length];
        ctx.lineWidth = Math.max(0.6, strength * 2);
        ctx.strokeRect(x + step * 0.12, y + step * 0.12, step * 0.72, step * 0.72);
      }
    }
  }
  ctx.restore();
}

function drawBooleanCollage(ctx, source, palette, strength = 0.5, index = 0) {
  const size = source.width;
  const rand = seededRandom(170 + index * 31);
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.globalAlpha = 0.34 + strength * 0.28;
  const ops = ["multiply", "screen", "difference", "source-over"];
  for (let i = 0; i < 18; i += 1) {
    const x = (rand() - 0.5) * size * 1.25;
    const y = (rand() - 0.5) * size * 1.25;
    const w = size * (0.08 + rand() * 0.34);
    const h = size * (0.035 + rand() * 0.22);
    const l = sampleLightness(source, Math.floor(Math.abs(x) % size), Math.floor(Math.abs(y) % size));
    ctx.globalCompositeOperation = ops[i % ops.length];
    ctx.fillStyle = palette[(Math.floor(l * palette.length) + i) % palette.length];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(((index * 9 + i * 13 + rand() * 50) * Math.PI) / 180);
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.restore();
  }
  ctx.restore();
  ctx.globalCompositeOperation = "source-over";
}

function applyPaperToolCanvas(ctx, source, options, palette, index = 0) {
  const tool = options.paperTool || "none";
  const strength = Number(options.toolStrength || 0.5);
  if (tool === "none") return;
  if (tool === "path simplify") {
    drawOffsetContours(ctx, source, { ...options, offsetSteps: Math.max(1, Math.round(Number(options.offsetSteps || 2) * 0.5)) }, palette, index);
  } else if (tool === "voronoi cells") {
    drawVoronoiCells(ctx, source, palette, Number(options.voronoiCells || 42), strength, index);
  } else if (tool === "metaball field") {
    drawMetaballField(ctx, source, palette, Number(options.voronoiCells || 42), strength, index);
  } else if (tool === "offset contours") {
    drawOffsetContours(ctx, source, options, palette, index);
  } else if (tool === "raster division") {
    drawRasterDivision(ctx, source, palette, strength, index);
  } else if (tool === "boolean collage") {
    drawBooleanCollage(ctx, source, palette, strength, index);
  }
}

function buildPrintCanvas(inputCanvas, options = {}, index = 0) {
  const size = 900;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext("2d");
  const source = makeCanvas(size);
  source.getContext("2d").drawImage(inputCanvas, 0, 0, size, size);
  const palette = getPrintPalette(options);
  ctx.fillStyle = options.darkGround ? "#050607" : "#f5f2ec";
  ctx.fillRect(0, 0, size, size);

  if (options.method === "strip collage" || options.method === "layered collage") {
    drawStripCollage(ctx, source, palette, options.stripCount + index * 2, options.rotation + index * 7, 0.78);
  }
  if (options.method === "line field" || options.method === "layered collage" || options.method === "weave") {
    drawLineField(ctx, source, palette, options.lineSpacing, options.rotation + index * 9, options.lineWeight, 0.72);
  }
  if (options.method === "dot matrix" || options.method === "layered collage" || options.method === "weave") {
    drawDotMatrix(ctx, source, palette, options.dotSpacing, options.dotScale, 0.72, index);
  }
  if (options.method === "weave") {
    drawLineField(ctx, source, palette.slice().reverse(), Math.max(4, options.lineSpacing * 1.35), options.rotation + 90 - index * 5, options.lineWeight * 0.75, 0.62);
  }
  if (options.contourOverlay) {
    drawContourOverlay(ctx, source, options, palette, index);
  }
  applyPaperToolCanvas(ctx, source, options, palette, index);

  ctx.globalAlpha = options.edgeOverlay;
  ctx.globalCompositeOperation = "multiply";
  ctx.drawImage(source, 0, 0, size, size);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  return canvas;
}

function getPixelLoomPalette(options = {}) {
  return PIXEL_LOOM_PALETTES[options.palette || "smalley"] || PIXEL_LOOM_PALETTES.smalley;
}

function colorDistance(a, b) {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return dr * dr + dg * dg + db * db;
}

function nearestPaletteColor(r, g, b, paletteRgb) {
  const target = { r, g, b };
  return paletteRgb.reduce((best, color) => (
    colorDistance(target, color) < colorDistance(target, best) ? color : best
  ), paletteRgb[0]);
}

function drawPixelSeed(ctx, options, palette, index = 0) {
  const grid = Math.max(8, Number(options.gridSize || 32));
  const rand = seededRandom(grid * 31 + index * 101 + options.layerCount * 17);
  const type = options.seedType || "checker";
  ctx.clearRect(0, 0, grid, grid);
  for (let y = 0; y < grid; y += 1) {
    for (let x = 0; x < grid; x += 1) {
      let colorIndex = 0;
      if (type === "checker") {
        colorIndex = (x + y + index) % 2 ? 1 : 2;
      } else if (type === "stripe") {
        colorIndex = (Math.floor((x + index) / 2) + Math.floor(y / 5)) % palette.length;
      } else if (type === "arch") {
        const cx = grid / 2;
        const cy = grid * 0.58;
        const dx = Math.abs(x - cx) / Math.max(1, grid * 0.42);
        const dy = (y - cy) / Math.max(1, grid * 0.42);
        const arch = Math.abs(dx * dx + dy * dy - 1);
        colorIndex = arch < 0.14 || (y > cy && dx < 0.26) ? 2 + (index % 2) : ((x + y) % 3 ? 1 : 0);
      } else if (type === "glyph") {
        const wave = Math.sin((x + index * 3) * 0.72) + Math.cos((y - index) * 0.58);
        const cross = Math.abs(x - grid / 2) < 2 || Math.abs(y - grid / 2) < 2;
        colorIndex = cross ? 3 : Math.floor(Math.abs(wave) * palette.length) % palette.length;
      } else {
        colorIndex = Math.floor(rand() * palette.length);
      }
      ctx.fillStyle = palette[colorIndex % palette.length];
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

function buildPixelLoomCanvas(inputCanvas, options = {}, index = 0) {
  const merged = { ...DEFAULT_PIXEL_LOOM_OPTIONS, ...options };
  const size = Math.max(512, Number(merged.outputSize || 900));
  const grid = Math.max(8, Number(merged.gridSize || 32));
  const palette = getPixelLoomPalette(merged);
  const paletteRgb = palette.map(hexToRgb);
  const seed = makeCanvas(grid);
  const seedCtx = seed.getContext("2d");
  drawPixelSeed(seedCtx, merged, palette, index);

  const canvas = makeCanvas(size);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = !merged.nearest;
  ctx.fillStyle = merged.darkGround ? palette[0] : palette[palette.length - 1];
  ctx.fillRect(0, 0, size, size);

  const layers = Math.max(1, Number(merged.layerCount || 1));
  for (let layer = 0; layer < layers; layer += 1) {
    const repeat = Math.max(1, Number(merged.tileRepeat || 1) + (layer % 2));
    const tileSize = Math.ceil(size / repeat);
    const tile = makeCanvas(tileSize);
    const tctx = tile.getContext("2d");
    tctx.imageSmoothingEnabled = !merged.nearest;
    tctx.drawImage(seed, 0, 0, tileSize, tileSize);
    if (inputCanvas && merged.sourceInfluence > 0) {
      tctx.globalCompositeOperation = layer % 2 ? "multiply" : "screen";
      tctx.globalAlpha = Math.max(0, Math.min(0.8, Number(merged.sourceInfluence || 0)));
      tctx.imageSmoothingEnabled = true;
      tctx.drawImage(inputCanvas, 0, 0, tileSize, tileSize);
      tctx.globalAlpha = 1;
      tctx.globalCompositeOperation = "source-over";
    }

    ctx.save();
    ctx.translate(size / 2, size / 2);
    const angle = (Number(merged.rotation || 0) + (layer - (layers - 1) / 2) * Number(merged.rotationJitter || 0) + index * 0.55) * Math.PI / 180;
    ctx.rotate(angle);
    const scale = Number(merged.scale || 1) + layer * 0.035 + index * 0.01;
    ctx.scale(scale, scale);
    ctx.globalAlpha = Math.max(0.22, 0.82 - layer * 0.08);
    ctx.globalCompositeOperation = layer === 0 ? "source-over" : (merged.blendMode || "difference");
    for (let y = -size; y < size * 1.5; y += tileSize) {
      for (let x = -size; x < size * 1.5; x += tileSize) {
        const offset = (layer % 2) * tileSize * 0.5;
        ctx.drawImage(tile, x - size / 2 + offset, y - size / 2, tileSize, tileSize);
      }
    }
    ctx.restore();
  }

  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  const img = ctx.getImageData(0, 0, size, size);
  const data = img.data;
  const dither = Number(merged.dither || 0);
  const weave = Number(merged.weave || 0);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      const weaveBias = ((x % 7 === 0 ? -28 : 0) + (y % 11 === 0 ? 24 : 0)) * weave;
      const noise = (((x * 13 + y * 17 + index * 31) % 19) - 9) * dither * 2.8;
      const nearest = nearestPaletteColor(
        data[i] + weaveBias + noise,
        data[i + 1] + weaveBias * 0.45 - noise,
        data[i + 2] - weaveBias * 0.35 + noise,
        paletteRgb,
      );
      data[i] = nearest.r;
      data[i + 1] = nearest.g;
      data[i + 2] = nearest.b;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function exportPrintSvg(inputCanvas, options = {}) {
  const size = 900;
  const step = Math.max(8, Number(options.dotSpacing || 16));
  const palette = getPrintPalette(options);
  const project = new paper.Project();
  project.activate();
  const layer = new paper.Layer();
  const background = new paper.Path.Rectangle({
    rectangle: new paper.Rectangle(0, 0, size, size),
    fillColor: options.darkGround ? "#050607" : "#f5f2ec",
  });
  layer.addChild(background);
  for (let y = step / 2; y < size; y += step) {
    for (let x = step / 2; x < size; x += step) {
      const l = sampleLightness(inputCanvas, Math.floor((x / size) * inputCanvas.width), Math.floor((y / size) * inputCanvas.height));
      const r = Math.max(1.1, (1 - l) * step * Number(options.dotScale || 0.42));
      const fill = palette[Math.floor((1 - l) * (palette.length - 1))];
      if (r > 1.4) {
        layer.addChild(new paper.Path.Circle({
          center: new paper.Point(x, y),
          radius: r,
          fillColor: fill,
        }));
      }
    }
  }
  if (options.contourOverlay) {
    const levels = Math.max(1, Number(options.contourLevels || 1));
    const thresholds = Array.from({ length: levels }, (_, i) => (
      Math.max(0.08, Math.min(0.92, Number(options.contourThreshold || 0.5) + (i - (levels - 1) / 2) * 0.08))
    ));
    getD3ContourRings(inputCanvas, thresholds, 128).forEach((ring, ringIndex) => {
      const path = new paper.Path({
        strokeColor: palette[(ringIndex + 1) % palette.length],
        strokeWidth: Math.max(1.2, Number(options.lineWeight || 4) * 0.26),
        strokeCap: "round",
      });
      ring.forEach((point) => path.add(new paper.Point((point.x * size) / inputCanvas.width, (point.y * size) / inputCanvas.height)));
      path.closed = true;
      path.simplify(Math.max(0.1, Number(options.pathSimplify ?? 0.8)));
      if (options.paperTool === "path simplify") path.smooth({ type: "continuous" });
      layer.addChild(path);
    });
  }
  if (options.paperTool === "offset contours") {
    const steps = Math.max(1, Number(options.offsetSteps || 1));
    const thresholds = [Number(options.contourThreshold || 0.52)];
    getD3ContourRings(inputCanvas, thresholds, 128).forEach((ring, ringIndex) => {
      for (let offsetStep = 0; offsetStep < steps; offsetStep += 1) {
        const offset = (offsetStep - (steps - 1) / 2) * (2 + Number(options.toolStrength || 0.5) * 8);
        const path = new paper.Path({
          strokeColor: palette[(ringIndex + offsetStep) % palette.length],
          strokeWidth: Math.max(0.7, Number(options.lineWeight || 4) * 0.22),
          strokeCap: "round",
          opacity: Math.max(0.16, 0.62 - offsetStep * 0.06),
        });
        ring.forEach((point) => path.add(new paper.Point((point.x * size) / inputCanvas.width + offset, (point.y * size) / inputCanvas.height - offset)));
        path.closed = true;
        path.simplify(Math.max(0.1, Number(options.pathSimplify ?? 0.8)));
        layer.addChild(path);
      }
    });
  } else if (options.paperTool === "voronoi cells" || options.paperTool === "raster division") {
    const cellCount = Number(options.voronoiCells || 42);
    const step = options.paperTool === "raster division"
      ? Math.max(14, Math.floor(54 - Number(options.toolStrength || 0.5) * 32))
      : Math.max(10, Math.floor(size / Math.sqrt(cellCount * 2.4)));
    for (let y = 0; y < size; y += step) {
      for (let x = 0; x < size; x += step) {
        const l = sampleLightness(inputCanvas, Math.floor((x / size) * inputCanvas.width), Math.floor((y / size) * inputCanvas.height));
        const rect = new paper.Path.Rectangle({
          rectangle: new paper.Rectangle(x, y, step * (0.55 + (1 - l) * 0.9), step * (0.45 + l * 0.9)),
          fillColor: palette[Math.floor((1 - l) * (palette.length - 1))],
          opacity: 0.28 + Number(options.toolStrength || 0.5) * 0.34,
        });
        layer.addChild(rect);
      }
    }
  } else if (options.paperTool === "metaball field") {
    const count = Math.max(8, Math.min(120, Number(options.voronoiCells || 42)));
    const rand = seededRandom(311 + count);
    for (let i = 0; i < count; i += 1) {
      const x = rand() * size;
      const y = rand() * size;
      const l = sampleLightness(inputCanvas, Math.floor((x / size) * inputCanvas.width), Math.floor((y / size) * inputCanvas.height));
      layer.addChild(new paper.Path.Circle({
        center: new paper.Point(x, y),
        radius: Math.max(4, (1 - l) * 34 * (0.6 + Number(options.toolStrength || 0.5))),
        fillColor: palette[(i + Math.floor(l * palette.length)) % palette.length],
        opacity: 0.18 + Number(options.toolStrength || 0.5) * 0.22,
      }));
    }
  } else if (options.paperTool === "boolean collage") {
    const rand = seededRandom(431);
    for (let i = 0; i < 18; i += 1) {
      const item = new paper.Path.Rectangle({
        rectangle: new paper.Rectangle(-size * (0.05 + rand() * 0.15), -size * (0.015 + rand() * 0.08), size * (0.1 + rand() * 0.34), size * (0.035 + rand() * 0.18)),
        fillColor: palette[i % palette.length],
        opacity: 0.22 + Number(options.toolStrength || 0.5) * 0.22,
      });
      item.position = new paper.Point(rand() * size, rand() * size);
      item.rotate(-45 + rand() * 90);
      layer.addChild(item);
    }
  }
  const svg = project.exportSVG({ asString: true, bounds: new paper.Rectangle(0, 0, size, size) });
  project.remove();
  return String(svg);
}

function connectionId(sourceId, mapKey) {
  return `${sourceId}:${mapKey}`;
}

function parseConnectionId(id) {
  const [sourceId, mapKey] = String(id).split(":");
  return { sourceId, mapKey };
}

function mapsFromConnections(sources, connectedMapIds) {
  return connectedMapIds
    .map((id) => {
      const { sourceId, mapKey } = parseConnectionId(id);
      const source = sources.find((item) => item.id === sourceId);
      const map = source?.maps?.find((item) => item.key === mapKey);
      return map ? { ...map, sourceId, sourceLabel: source.label } : null;
    })
    .filter(Boolean);
}

function blendMaps(sources, connectedMapIds, options) {
  const inputs = mapsFromConnections(sources, connectedMapIds);
  if (!inputs.length) return null;
  const size = 512;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ecebe7";
  ctx.fillRect(0, 0, size, size);
  inputs.forEach((map, index) => {
    ctx.globalAlpha = index === 0 ? 0.9 : 0.55;
    ctx.globalCompositeOperation = index === 0 ? "source-over" : options.blendMode || "multiply";
    ctx.drawImage(map.canvas, index * 10, index * -6, size, size);
  });
  ctx.globalCompositeOperation = "source-over";
  return {
    key: "hybrid",
    label: `Hybrid ${inputs.map((map) => `${map.sourceLabel} / ${map.label}`).join(" + ")}`,
    mode: "hybrid",
    canvas,
    url: canvas.toDataURL("image/png", 0.95),
  };
}

function buildReliefObj(imageCanvas, displacement = 0.35, resolution = 56) {
  const sample = makeCanvas(resolution);
  const sctx = sample.getContext("2d");
  sctx.drawImage(imageCanvas, 0, 0, resolution, resolution);
  const pixels = sctx.getImageData(0, 0, resolution, resolution).data;
  const vertices = [];
  const uvs = [];
  const faces = [];

  for (let y = 0; y < resolution; y += 1) {
    for (let x = 0; x < resolution; x += 1) {
      const idx = (y * resolution + x) * 4;
      const l = (pixels[idx] * 0.299 + pixels[idx + 1] * 0.587 + pixels[idx + 2] * 0.114) / 255;
      const px = (x / (resolution - 1) - 0.5) * 4;
      const py = (y / (resolution - 1) - 0.5) * -4;
      const pz = l * displacement;
      vertices.push(`v ${px.toFixed(5)} ${py.toFixed(5)} ${pz.toFixed(5)}`);
      uvs.push(`vt ${(x / (resolution - 1)).toFixed(5)} ${(1 - y / (resolution - 1)).toFixed(5)}`);
    }
  }

  for (let y = 0; y < resolution - 1; y += 1) {
    for (let x = 0; x < resolution - 1; x += 1) {
      const a = y * resolution + x + 1;
      const b = y * resolution + x + 2;
      const c = (y + 1) * resolution + x + 2;
      const d = (y + 1) * resolution + x + 1;
      faces.push(`f ${a}/${a} ${b}/${b} ${c}/${c} ${d}/${d}`);
    }
  }

  return ["# Pattern Projection Lab relief OBJ", ...vertices, ...uvs, ...faces].join("\n");
}

function DraggableNode({ id, node, title, type, children, onMove, onResize }) {
  const start = useRef(null);
  const resizeStart = useRef(null);
  const onPointerDown = (event) => {
    if (event.button !== 0) return;
    if (event.target.closest("button,input,select,textarea,a,label,.pattern-mesh-preview,canvas")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    start.current = {
      px: event.clientX,
      py: event.clientY,
      x: node.x,
      y: node.y,
    };
  };
  const onPointerMove = (event) => {
    if (resizeStart.current) {
      onResize(id, {
        w: Math.max(220, resizeStart.current.w + event.clientX - resizeStart.current.px),
        h: Math.max(140, resizeStart.current.h + event.clientY - resizeStart.current.py),
      });
      return;
    }
    if (!start.current) return;
    onMove(id, {
      x: Math.max(10, start.current.x + event.clientX - start.current.px),
      y: Math.max(10, start.current.y + event.clientY - start.current.py),
    });
  };
  const onPointerUp = () => {
    start.current = null;
    resizeStart.current = null;
  };
  const onResizePointerDown = (event) => {
    event.stopPropagation();
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeStart.current = {
      px: event.clientX,
      py: event.clientY,
      w: node.w || 260,
      h: node.h || 0,
    };
  };

  return (
    <article
      className={`pattern-node ${type || ""}`}
      style={{
        transform: `translate(${node.x}px, ${node.y}px)`,
        width: `${node.w || 260}px`,
        ...(node.h ? { height: `${node.h}px` } : {}),
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <header className="pattern-node-head">
        <span>{title}</span>
        <i />
      </header>
      {children}
      <span className="pattern-resize-handle" onPointerDown={onResizePointerDown} />
    </article>
  );
}

function ConnectorLayer({ nodes, sources = [], connectedMapIds = [] }) {
  const links = [
    ["blend", "branch"],
    ["blend", "print"],
    ["blend", "pixelLoom"],
    ["print", "printMatrix"],
    ["printMatrix", "printExport"],
    ["pixelLoom", "pixelLoomMatrix"],
    ["pixelLoomMatrix", "pixelLoomExport"],
    ["branch", "matrix"],
    ["matrix", "mesh"],
    ["matrix", "export"],
  ];
  const bounds = Object.values(nodes).reduce(
    (acc, node) => ({
      width: Math.max(acc.width, node.x + (node.w || 260) + 260),
      height: Math.max(acc.height, node.y + (node.h || 260) + 260),
    }),
    { width: 1500, height: 980 },
  );
  const point = (node, side = "right", offset = 0) => {
    const w = node.w || 260;
    const h = node.h || 220;
    if (side === "top") return { x: node.x + w / 2, y: node.y };
    if (side === "bottom") return { x: node.x + w / 2, y: node.y + h };
    if (side === "left") return { x: node.x, y: node.y + offset };
    return { x: node.x + w, y: node.y + offset };
  };
  const curve = (from, to, mode = "horizontal") => {
    if (mode === "vertical") {
      const midY = (from.y + to.y) / 2;
      return `M ${from.x} ${from.y} C ${from.x} ${midY}, ${to.x} ${midY}, ${to.x} ${to.y}`;
    }
    const midX = (from.x + to.x) / 2;
    return `M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`;
  };
  const mapSocketPoint = (node, mapKey) => {
    const idx = Math.max(0, MAP_TYPES.findIndex((type) => type.key === mapKey));
    const w = node.w || 300;
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const gridPad = 12;
    const gap = 8;
    const colW = (w - gridPad * 2 - gap) / 2;
    return {
      x: node.x + gridPad + col * (colW + gap) + colW + 7,
      y: node.y + 40 + gridPad + row * 128 + 105,
    };
  };
  return (
    <svg className="pattern-connectors" width={bounds.width} height={bounds.height} viewBox={`0 0 ${bounds.width} ${bounds.height}`} aria-hidden="true">
      {links.map(([from, to]) => {
        const a = nodes[from];
        const b = nodes[to];
        if (!a || !b) return null;
        const mode = from === "branch" || from === "matrix" ? "vertical" : "horizontal";
        return (
          <path
            key={`${from}-${to}`}
            d={curve(point(a, "bottom"), point(b, "top"), mode)}
          />
        );
      })}
      {sources.map((source) => {
        const sourceNode = nodes[`source-${source.id}`];
        const mapsNode = nodes[`maps-${source.id}`];
        if (!sourceNode || !mapsNode) return null;
        return (
          <g key={`branch-${source.id}`}>
            <path className="lineage-wire" d={curve(point(nodes.database, "bottom"), point(sourceNode, "top"), "vertical")} />
            <path className="lineage-wire" d={curve(point(sourceNode, "bottom"), point(mapsNode, "top"), "vertical")} />
          </g>
        );
      })}
      {connectedMapIds.map((id, idx) => {
        const { sourceId, mapKey } = parseConnectionId(id);
        const a = nodes[`maps-${sourceId}`];
        const b = nodes.blend;
        if (!a || !b) return null;
        const from = mapSocketPoint(a, mapKey);
        const to = point(b, "left", 82 + idx * 26);
        return (
          <path
            key={`map-${id}`}
            className="map-wire"
            d={curve(from, to)}
          />
        );
      })}
    </svg>
  );
}

function FlowPanelNode({ data, selected }) {
  return (
    <article className={`pattern-node pattern-flow-node ${data.kind || ""}`}>
      <NodeResizer
        color="#202428"
        isVisible
        minWidth={data.minWidth || 220}
        minHeight={data.minHeight || 140}
        keepAspectRatio={false}
        handleClassName="pattern-flow-resize-handle"
        lineClassName="pattern-flow-resize-line"
      />
      {data.target !== false ? (
        <Handle
          type="target"
          id={data.targetHandle || "in"}
          position={data.targetPosition || Position.Left}
          className="pattern-rf-handle target"
        />
      ) : null}
      {data.source !== false ? (
        <Handle
          type="source"
          id={data.sourceHandle || "out"}
          position={data.sourcePosition || Position.Right}
          className="pattern-rf-handle source"
        />
      ) : null}
      {(data.mapHandles || []).map((handle) => (
        <Handle
          key={handle.id}
          type="source"
          id={handle.id}
          position={Position.Right}
          className="pattern-rf-handle map"
          style={{ top: `${handle.top}%` }}
          title={handle.label}
        />
      ))}
      <header className="pattern-node-head">
        <span>{data.title}</span>
        <i />
      </header>
      <div
        className="pattern-node-content nodrag nowheel"
        onPointerDown={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        {data.content}
      </div>
    </article>
  );
}

const FLOW_NODE_TYPES = { panel: FlowPanelNode };

function applyGeometryUvs(geometry, projection = "auto") {
  if (!geometry || !geometry.attributes?.position) return false;
  if (projection === "existing" && geometry.attributes?.uv) return true;
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (!box) return false;
  const size = box.getSize(new THREE.Vector3());
  const position = geometry.attributes.position;
  const uv = [];
  const axesByProjection = {
    xy: ["x", size.x || 1, "y", size.y || 1],
    xz: ["x", size.x || 1, "z", size.z || 1],
    yz: ["y", size.y || 1, "z", size.z || 1],
  };
  const autoAxes = size.x >= size.z
    ? ["x", size.x || 1, "z", size.z || 1]
    : ["z", size.z || 1, "y", size.y || 1];
  const axes = axesByProjection[projection] || autoAxes;
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const values = { x, y, z };
    uv.push(
      (values[axes[0]] - box.min[axes[0]]) / axes[1],
      (values[axes[2]] - box.min[axes[2]]) / axes[3],
    );
  }
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  return true;
}

function makeMeshEdges(mesh) {
  if (!mesh.geometry) return null;
  const edges = new THREE.EdgesGeometry(mesh.geometry, 18);
  const material = new THREE.LineBasicMaterial({ color: "#1f2524", transparent: true, opacity: 0.38 });
  return new THREE.LineSegments(edges, material);
}

function subdivideGeometry(geometry, levels = 0) {
  let current = geometry?.toNonIndexed?.() || geometry;
  const iterations = Math.max(0, Math.min(3, Number(levels || 0)));
  for (let level = 0; level < iterations; level += 1) {
    const position = current.attributes?.position;
    if (!position || position.count > 220000) break;
    const uv = current.attributes?.uv;
    const nextPositions = [];
    const nextUvs = [];
    const pushVertex = (point, tex) => {
      nextPositions.push(point.x, point.y, point.z);
      if (tex) nextUvs.push(tex.x, tex.y);
    };
    for (let i = 0; i < position.count; i += 3) {
      const a = new THREE.Vector3().fromBufferAttribute(position, i);
      const b = new THREE.Vector3().fromBufferAttribute(position, i + 1);
      const c = new THREE.Vector3().fromBufferAttribute(position, i + 2);
      const ab = a.clone().lerp(b, 0.5);
      const bc = b.clone().lerp(c, 0.5);
      const ca = c.clone().lerp(a, 0.5);
      const ua = uv ? new THREE.Vector2().fromBufferAttribute(uv, i) : null;
      const ub = uv ? new THREE.Vector2().fromBufferAttribute(uv, i + 1) : null;
      const uc = uv ? new THREE.Vector2().fromBufferAttribute(uv, i + 2) : null;
      const uab = ua && ub ? ua.clone().lerp(ub, 0.5) : null;
      const ubc = ub && uc ? ub.clone().lerp(uc, 0.5) : null;
      const uca = uc && ua ? uc.clone().lerp(ua, 0.5) : null;
      [[a, ab, ca, ua, uab, uca], [ab, b, bc, uab, ub, ubc], [ca, bc, c, uca, ubc, uc], [ab, bc, ca, uab, ubc, uca]].forEach((tri) => {
        pushVertex(tri[0], tri[3]);
        pushVertex(tri[1], tri[4]);
        pushVertex(tri[2], tri[5]);
      });
    }
    const next = new THREE.BufferGeometry();
    next.setAttribute("position", new THREE.Float32BufferAttribute(nextPositions, 3));
    if (nextUvs.length) next.setAttribute("uv", new THREE.Float32BufferAttribute(nextUvs, 2));
    next.computeVertexNormals();
    if (current !== geometry) current.dispose?.();
    current = next;
  }
  current.computeVertexNormals?.();
  return current;
}

function smoothGeometry(geometry, iterations = 0, strength = 0.35) {
  const count = Math.max(0, Math.min(20, Number(iterations || 0)));
  if (!geometry?.attributes?.position || count === 0) return geometry;
  let current = geometry.index ? geometry : mergeVertices(geometry, 1e-5);
  const position = current.attributes.position;
  const index = current.index;
  if (!index) return current;
  const locked = new Set();
  const edgeUse = new Map();
  const keyFor = (a, b) => (a < b ? `${a}:${b}` : `${b}:${a}`);
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i);
    const b = index.getX(i + 1);
    const c = index.getX(i + 2);
    [keyFor(a, b), keyFor(b, c), keyFor(c, a)].forEach((key) => edgeUse.set(key, (edgeUse.get(key) || 0) + 1));
  }
  edgeUse.forEach((uses, key) => {
    if (uses === 1) key.split(":").forEach((id) => locked.add(Number(id)));
  });

  const neighbors = Array.from({ length: position.count }, () => new Set());
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i);
    const b = index.getX(i + 1);
    const c = index.getX(i + 2);
    neighbors[a].add(b).add(c);
    neighbors[b].add(a).add(c);
    neighbors[c].add(a).add(b);
  }

  const alpha = Math.max(0, Math.min(0.85, Number(strength || 0)));
  for (let pass = 0; pass < count; pass += 1) {
    const next = new Float32Array(position.array);
    for (let i = 0; i < position.count; i += 1) {
      if (locked.has(i) || !neighbors[i].size) continue;
      const average = new THREE.Vector3();
      neighbors[i].forEach((neighbor) => {
        average.x += position.getX(neighbor);
        average.y += position.getY(neighbor);
        average.z += position.getZ(neighbor);
      });
      average.multiplyScalar(1 / neighbors[i].size);
      const currentPoint = new THREE.Vector3(position.getX(i), position.getY(i), position.getZ(i));
      currentPoint.lerp(average, alpha);
      next[i * 3] = currentPoint.x;
      next[i * 3 + 1] = currentPoint.y;
      next[i * 3 + 2] = currentPoint.z;
    }
    position.array.set(next);
    position.needsUpdate = true;
  }
  current.computeVertexNormals();
  return current;
}

function prepareMeshGeometry(geometry, meshOptions = DEFAULT_MESH_OPTIONS) {
  if (!geometry) return geometry;
  let prepared = geometry.clone();
  applyGeometryUvs(prepared, meshOptions.uvProjection || "auto");
  if (meshOptions.prepMode !== "raw") {
    prepared = mergeVertices(prepared, meshOptions.prepMode === "remesh" ? 1e-4 : 1e-5);
    prepared.computeVertexNormals();
  }
  const levels = Number(meshOptions.subdivision || 0);
  if (levels > 0 && meshOptions.viewMode !== "wire") {
    prepared = subdivideGeometry(prepared, levels);
    if (meshOptions.prepMode !== "raw") prepared = mergeVertices(prepared, 1e-5);
  }
  if (meshOptions.prepMode === "remesh" || Number(meshOptions.smoothIterations || 0) > 0) {
    prepared = smoothGeometry(prepared, meshOptions.smoothIterations, meshOptions.smoothStrength);
  }
  prepared.computeVertexNormals?.();
  return prepared;
}

function configureMeshTexture(texture, meshOptions = DEFAULT_MESH_OPTIONS) {
  if (!texture) return texture;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(meshOptions.textureScale || 1, meshOptions.textureScale || 1);
  texture.rotation = ((meshOptions.textureRotation || 0) * Math.PI) / 180;
  texture.center.set(0.5, 0.5);
  texture.needsUpdate = true;
  return texture;
}

function buildDisplacementCanvas(image, meshOptions = DEFAULT_MESH_OPTIONS) {
  const size = 512;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0, size, size);
  const img = ctx.getImageData(0, 0, size, size);
  const data = img.data;
  const low = Math.min(Number(meshOptions.heightLow ?? 0), Number(meshOptions.heightHigh ?? 1));
  const high = Math.max(Number(meshOptions.heightLow ?? 0), Number(meshOptions.heightHigh ?? 1));
  const range = Math.max(0.001, high - low);
  const gamma = Math.max(0.05, Number(meshOptions.heightGamma || 1));
  const target = hexToRgb(meshOptions.heightColor || DEFAULT_MESH_OPTIONS.heightColor);
  const tolerance = Math.max(0.02, Math.min(1, Number(meshOptions.heightColorTolerance || 0.35)));
  const maxDistance = Math.sqrt(3 * 255 * 255) * tolerance;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let value = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
    if (meshOptions.heightSource === "red") value = r / 255;
    else if (meshOptions.heightSource === "green") value = g / 255;
    else if (meshOptions.heightSource === "blue") value = b / 255;
    else if (meshOptions.heightSource === "saturation") value = max === 0 ? 0 : (max - min) / max;
    else if (meshOptions.heightSource === "targetColor") {
      const distance = Math.sqrt((r - target.r) ** 2 + (g - target.g) ** 2 + (b - target.b) ** 2);
      value = Math.max(0, 1 - distance / maxDistance);
    }
    value = Math.max(0, Math.min(1, (value - low) / range));
    value = Math.pow(value, gamma);
    if (meshOptions.heightInvert) value = 1 - value;
    const height = Math.round(value * 255);
    data[i] = height;
    data[i + 1] = height;
    data[i + 2] = height;
    data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function sampleHeightCanvas(canvas, u, v) {
  if (!canvas) return 0.5;
  const wrappedU = ((u % 1) + 1) % 1;
  const wrappedV = ((v % 1) + 1) % 1;
  const x = Math.max(0, Math.min(canvas.width - 1, Math.floor(wrappedU * canvas.width)));
  const y = Math.max(0, Math.min(canvas.height - 1, Math.floor((1 - wrappedV) * canvas.height)));
  return sampleLightness(canvas, x, y);
}

function displaceGeometryByHeight(geometry, heightCanvas, meshOptions = DEFAULT_MESH_OPTIONS, displacement = 0) {
  if (!geometry?.attributes?.position || !geometry.attributes?.uv || !heightCanvas || displacement <= 0) return geometry;
  geometry.computeBoundingBox();
  geometry.computeVertexNormals();
  const box = geometry.boundingBox;
  const size = box?.getSize(new THREE.Vector3()) || new THREE.Vector3(1, 1, 1);
  const maxDim = Math.max(size.x, size.y, size.z, 1);
  const amount = maxDim * Number(displacement || 0) * (0.05 + Number(meshOptions.bumpStrength || 0.35) * 0.14);
  const position = geometry.attributes.position;
  const normal = geometry.attributes.normal;
  const uv = geometry.attributes.uv;
  const repeat = Number(meshOptions.textureScale || 1);
  const angle = ((meshOptions.textureRotation || 0) * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  for (let i = 0; i < position.count; i += 1) {
    let u = (uv.getX(i) - 0.5) * repeat;
    let v = (uv.getY(i) - 0.5) * repeat;
    const ru = u * cos - v * sin + 0.5;
    const rv = u * sin + v * cos + 0.5;
    const h = sampleHeightCanvas(heightCanvas, ru, rv);
    const offset = (h - 0.5) * amount;
    position.setXYZ(
      i,
      position.getX(i) + normal.getX(i) * offset,
      position.getY(i) + normal.getY(i) * offset,
      position.getZ(i) + normal.getZ(i) * offset,
    );
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function PrintComposerControls({ options, onCommit, onReset, selectedPrintOutput }) {
  const [draft, setDraft] = useState(options);
  const lastCommittedRef = useRef(JSON.stringify(options));
  const paletteDraftRef = useRef(false);

  useEffect(() => {
    const next = JSON.stringify(options);
    if (next !== lastCommittedRef.current) {
      lastCommittedRef.current = next;
      setDraft(options);
    }
  }, [options]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (paletteDraftRef.current) return;
      const next = JSON.stringify(draft);
      if (next !== lastCommittedRef.current) {
        lastCommittedRef.current = next;
        onCommit(draft);
      }
    }, 220);
    return () => window.clearTimeout(timeout);
  }, [draft, onCommit]);

  const update = (key, value) => {
    paletteDraftRef.current = false;
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const updateCustomColor = (index, value) => {
    paletteDraftRef.current = false;
    const nextDraft = (() => {
      const base = draft || DEFAULT_PRINT_OPTIONS;
      const colors = [...(base.customPalette || DEFAULT_PRINT_OPTIONS.customPalette)];
      colors[index] = normalizeHex(value, colors[index]);
      return { ...base, palette: "custom", customPalette: colors };
    })();
    commitNow(nextDraft);
  };

  const updateCustomColorDraft = (index, value) => {
    paletteDraftRef.current = false;
    setDraft((prev) => {
      const colors = [...(prev.customPalette || DEFAULT_PRINT_OPTIONS.customPalette)];
      colors[index] = value;
      return { ...prev, palette: "custom", customPalette: colors };
    });
  };

  const commitNow = (next) => {
    paletteDraftRef.current = false;
    const serialized = JSON.stringify(next);
    lastCommittedRef.current = serialized;
    setDraft(next);
    onCommit(next);
  };

  const applyCustomPalette = () => {
    commitNow({
      ...draft,
      palette: "custom",
      customPalette: (draft.customPalette || DEFAULT_PRINT_OPTIONS.customPalette).slice(0, 8),
    });
  };

  const addCustomColor = () => {
    paletteDraftRef.current = true;
    setDraft((prev) => ({
      ...prev,
      palette: "custom",
      customPalette: [...(prev.customPalette || DEFAULT_PRINT_OPTIONS.customPalette), "#8fbfd0"].slice(0, 8),
    }));
  };

  const removeCustomColor = (index) => {
    paletteDraftRef.current = true;
    setDraft((prev) => {
      const colors = [...(prev.customPalette || DEFAULT_PRINT_OPTIONS.customPalette)];
      colors.splice(index, 1);
      return { ...prev, palette: "custom", customPalette: colors.length ? colors : DEFAULT_PRINT_OPTIONS.customPalette };
    });
  };

  const reset = () => {
    setDraft(DEFAULT_PRINT_OPTIONS);
    lastCommittedRef.current = JSON.stringify(DEFAULT_PRINT_OPTIONS);
    onReset();
  };

  return (
    <div className="node-control-list nowheel">
      <p className="node-help">Build 2D print/collage outputs from the active hybrid map. This path is independent of the 3D mesh output.</p>
      <button type="button" className="tool-reset-btn" onClick={reset}>Reset Print Defaults</button>
      <label>
        Graphic Method
        <select value={draft.method} onChange={(e) => update("method", e.target.value)}>
          <option>layered collage</option>
          <option>line field</option>
          <option>dot matrix</option>
          <option>strip collage</option>
          <option>weave</option>
        </select>
      </label>
      <label>
        Palette
        <select value={draft.palette} onChange={(e) => update("palette", e.target.value)}>
          <option value="atlas">Atlas color</option>
          <option value="circuit">Circuit red/cyan</option>
          <option value="pastel">Pastel architectural</option>
          <option value="mono">Monochrome</option>
          <option value="custom">Custom colors</option>
        </select>
      </label>
      <label>
        Paper Vector Tool
        <select value={draft.paperTool} onChange={(e) => update("paperTool", e.target.value)}>
          <option value="none">None</option>
          <option value="path simplify">Path simplify / smooth</option>
          <option value="voronoi cells">Voronoi cells</option>
          <option value="metaball field">Metaball field</option>
          <option value="offset contours">Offset contours</option>
          <option value="raster division">Raster division</option>
          <option value="boolean collage">Boolean collage</option>
        </select>
      </label>
      <label>
        Tool Strength {draft.toolStrength.toFixed(2)}
        <input type="range" min="0" max="1" step="0.02" value={draft.toolStrength} onChange={(e) => update("toolStrength", Number(e.target.value))} />
      </label>
      <label>
        Cell / Blob Count {draft.voronoiCells}
        <input type="range" min="8" max="120" step="1" value={draft.voronoiCells} onChange={(e) => update("voronoiCells", Number(e.target.value))} />
      </label>
      <label>
        Offset Steps {draft.offsetSteps}
        <input type="range" min="1" max="9" step="1" value={draft.offsetSteps} onChange={(e) => update("offsetSteps", Number(e.target.value))} />
      </label>
      <label>
        Path Simplify {draft.pathSimplify.toFixed(2)}
        <input type="range" min="0" max="3" step="0.1" value={draft.pathSimplify} onChange={(e) => update("pathSimplify", Number(e.target.value))} />
      </label>
      <div className="custom-palette-editor">
        <div className="custom-palette-head">
          <span>Custom Palette</span>
          <div className="custom-palette-actions">
            <button type="button" onClick={applyCustomPalette}>Apply Palette</button>
            <button type="button" onClick={addCustomColor} disabled={(draft.customPalette || []).length >= 8}>Add Color</button>
          </div>
        </div>
        <div className="custom-palette-swatches">
          {(draft.customPalette || DEFAULT_PRINT_OPTIONS.customPalette).map((color, index) => {
            const rgb = hexToRgb(color);
            const setChannel = (channel, value) => updateCustomColor(index, rgbToHex(
              channel === "r" ? value : rgb.r,
              channel === "g" ? value : rgb.g,
              channel === "b" ? value : rgb.b,
            ));
            return (
              <div key={`${index}-${color}`} className="custom-color-control">
                <label className="custom-color-swatch-button" title="Pick color">
                  <span className="custom-color-swatch" style={{ background: color }} />
                  <input
                    type="color"
                    value={normalizeHex(color)}
                    onChange={(event) => updateCustomColor(index, event.target.value)}
                  />
                </label>
                <input
                  className="custom-color-hex"
                  value={color}
                  onChange={(event) => updateCustomColorDraft(index, event.target.value)}
                  onBlur={(event) => updateCustomColor(index, normalizeHex(event.target.value, color))}
                />
                <button type="button" onClick={() => removeCustomColor(index)} disabled={(draft.customPalette || []).length <= 2}>Remove</button>
                <label>
                  R {rgb.r}
                  <input type="range" min="0" max="255" step="1" value={rgb.r} onChange={(event) => setChannel("r", Number(event.target.value))} />
                </label>
                <label>
                  G {rgb.g}
                  <input type="range" min="0" max="255" step="1" value={rgb.g} onChange={(event) => setChannel("g", Number(event.target.value))} />
                </label>
                <label>
                  B {rgb.b}
                  <input type="range" min="0" max="255" step="1" value={rgb.b} onChange={(event) => setChannel("b", Number(event.target.value))} />
                </label>
              </div>
            );
          })}
        </div>
      </div>
      <label>
        Line Spacing {draft.lineSpacing}
        <input type="range" min="5" max="38" step="1" value={draft.lineSpacing} onChange={(e) => update("lineSpacing", Number(e.target.value))} />
      </label>
      <label>
        Dot Spacing {draft.dotSpacing}
        <input type="range" min="6" max="42" step="1" value={draft.dotSpacing} onChange={(e) => update("dotSpacing", Number(e.target.value))} />
      </label>
      <label>
        Strip Count {draft.stripCount}
        <input type="range" min="8" max="72" step="1" value={draft.stripCount} onChange={(e) => update("stripCount", Number(e.target.value))} />
      </label>
      <label>
        Rotation {draft.rotation} deg
        <input type="range" min="-90" max="90" step="3" value={draft.rotation} onChange={(e) => update("rotation", Number(e.target.value))} />
      </label>
      <label>
        Edge Overlay {draft.edgeOverlay.toFixed(2)}
        <input type="range" min="0" max="0.55" step="0.01" value={draft.edgeOverlay} onChange={(e) => update("edgeOverlay", Number(e.target.value))} />
      </label>
      <label className="map-edit-toggle">
        <input type="checkbox" checked={draft.contourOverlay} onChange={(e) => update("contourOverlay", e.target.checked)} />
        Vector contour overlay
      </label>
      <label>
        Contour Threshold {draft.contourThreshold.toFixed(2)}
        <input type="range" min="0.12" max="0.88" step="0.02" value={draft.contourThreshold} onChange={(e) => update("contourThreshold", Number(e.target.value))} />
      </label>
      <label>
        Contour Levels {draft.contourLevels}
        <input type="range" min="1" max="7" step="1" value={draft.contourLevels} onChange={(e) => update("contourLevels", Number(e.target.value))} />
      </label>
      <label className="map-edit-toggle">
        <input type="checkbox" checked={draft.darkGround} onChange={(e) => update("darkGround", e.target.checked)} />
        Dark ground
      </label>
      {selectedPrintOutput ? <img className="print-composer-preview" src={selectedPrintOutput.url} alt={selectedPrintOutput.label} /> : <div className="node-empty small">Connect maps to preview print output</div>}
    </div>
  );
}

function PixelLoomControls({ options, onCommit, onReset, selectedOutput }) {
  const [draft, setDraft] = useState(options);
  const lastCommittedRef = useRef(JSON.stringify(options));

  useEffect(() => {
    const next = JSON.stringify(options);
    if (next !== lastCommittedRef.current) {
      lastCommittedRef.current = next;
      setDraft(options);
    }
  }, [options]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const next = JSON.stringify(draft);
      if (next !== lastCommittedRef.current) {
        lastCommittedRef.current = next;
        onCommit(draft);
      }
    }, 180);
    return () => window.clearTimeout(timeout);
  }, [draft, onCommit]);

  const update = (key, value) => setDraft((prev) => ({ ...prev, [key]: value }));

  const reset = () => {
    setDraft(DEFAULT_PIXEL_LOOM_OPTIONS);
    lastCommittedRef.current = JSON.stringify(DEFAULT_PIXEL_LOOM_OPTIONS);
    onReset();
  };

  return (
    <div className="node-control-list nowheel">
      <p className="node-help">Generate square pixel studies from tiny grids, nearest-neighbor rotation, layer blending, palette quantization, and woven raster noise.</p>
      <button type="button" className="tool-reset-btn" onClick={reset}>Reset Pixel Loom</button>
      <label>
        Seed Pattern
        <select value={draft.seedType} onChange={(e) => update("seedType", e.target.value)}>
          <option value="checker">Checker</option>
          <option value="stripe">Stripe</option>
          <option value="arch">Gothic arch</option>
          <option value="glyph">Glyph field</option>
          <option value="random">Random cells</option>
        </select>
      </label>
      <label>
        Palette
        <select value={draft.palette} onChange={(e) => update("palette", e.target.value)}>
          <option value="smalley">Pixel rug bright</option>
          <option value="circuit">Circuit board</option>
          <option value="manuscript">Manuscript dye</option>
          <option value="glass">Stained glass</option>
        </select>
      </label>
      <label>
        Grid Size {draft.gridSize} px
        <input type="range" min="8" max="64" step="4" value={draft.gridSize} onChange={(e) => update("gridSize", Number(e.target.value))} />
      </label>
      <label>
        Layers {draft.layerCount}
        <input type="range" min="1" max="9" step="1" value={draft.layerCount} onChange={(e) => update("layerCount", Number(e.target.value))} />
      </label>
      <label>
        Rotation {draft.rotation.toFixed(2)} deg
        <input type="range" min="-22" max="22" step="0.25" value={draft.rotation} onChange={(e) => update("rotation", Number(e.target.value))} />
      </label>
      <label>
        Rotation Jitter {draft.rotationJitter.toFixed(2)}
        <input type="range" min="0" max="8" step="0.1" value={draft.rotationJitter} onChange={(e) => update("rotationJitter", Number(e.target.value))} />
      </label>
      <label>
        Tile Repeat {draft.tileRepeat}
        <input type="range" min="1" max="12" step="1" value={draft.tileRepeat} onChange={(e) => update("tileRepeat", Number(e.target.value))} />
      </label>
      <label>
        Scale {draft.scale.toFixed(2)}
        <input type="range" min="0.75" max="1.8" step="0.03" value={draft.scale} onChange={(e) => update("scale", Number(e.target.value))} />
      </label>
      <label>
        Blend Mode
        <select value={draft.blendMode} onChange={(e) => update("blendMode", e.target.value)}>
          <option value="difference">Difference</option>
          <option value="multiply">Multiply</option>
          <option value="screen">Screen</option>
          <option value="overlay">Overlay</option>
          <option value="exclusion">Exclusion</option>
          <option value="source-over">Normal</option>
        </select>
      </label>
      <label>
        Source Influence {draft.sourceInfluence.toFixed(2)}
        <input type="range" min="0" max="0.8" step="0.02" value={draft.sourceInfluence} onChange={(e) => update("sourceInfluence", Number(e.target.value))} />
      </label>
      <label>
        Dither {draft.dither.toFixed(2)}
        <input type="range" min="0" max="1" step="0.02" value={draft.dither} onChange={(e) => update("dither", Number(e.target.value))} />
      </label>
      <label>
        Weave Noise {draft.weave.toFixed(2)}
        <input type="range" min="0" max="1" step="0.02" value={draft.weave} onChange={(e) => update("weave", Number(e.target.value))} />
      </label>
      <label className="map-edit-toggle">
        <input type="checkbox" checked={draft.nearest} onChange={(e) => update("nearest", e.target.checked)} />
        Nearest-neighbor pixels
      </label>
      <label className="map-edit-toggle">
        <input type="checkbox" checked={draft.darkGround} onChange={(e) => update("darkGround", e.target.checked)} />
        Dark ground
      </label>
      {selectedOutput ? <img className="print-composer-preview pixel-loom-preview" src={selectedOutput.url} alt={selectedOutput.label} /> : <div className="node-empty small">Pixel loom preview pending</div>}
    </div>
  );
}

function MeshPreview({ objUrl, textureUrl, displacement, meshOptions = DEFAULT_MESH_OPTIONS }) {
  const mountRef = useRef(null);
  const [status, setStatus] = useState(objUrl ? "Loading OBJ..." : "Generated relief preview");

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;
    const width = mount.clientWidth || 320;
    const height = mount.clientHeight || 260;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#e9e9e5");
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.001, 10000);
    camera.position.set(0, 1.1, 4);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.innerHTML = "";
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enableZoom = true;
    controls.enablePan = true;
    controls.autoRotate = false;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    };
    renderer.domElement.addEventListener("pointerdown", (event) => event.stopPropagation());
    renderer.domElement.addEventListener("wheel", (event) => event.stopPropagation(), { passive: true });
    scene.add(new THREE.AmbientLight(0xffffff, 0.74));
    scene.add(new THREE.HemisphereLight(0xffffff, 0xa5b2a7, 0.86));
    const key = new THREE.DirectionalLight(0xffffff, 1.35);
    key.position.set(3, 4, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xcbdac3, 0.72);
    fill.position.set(-4, 2, -2);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 0.7);
    rim.position.set(-3, 5, -5);
    scene.add(rim);
    const grid = new THREE.GridHelper(4.5, 18, 0xb7beb8, 0xd4d6d2);
    grid.position.y = -1.42;
    grid.material.opacity = 0.24;
    grid.material.transparent = true;
    scene.add(grid);

    let material = null;
    let heightTexture = null;
    let heightCanvas = null;
    let renderStarted = false;
    const textureLoader = new THREE.TextureLoader();
    const texture = textureUrl ? textureLoader.load(textureUrl, (loaded) => {
      configureMeshTexture(loaded, meshOptions);
      heightCanvas = buildDisplacementCanvas(loaded.image, meshOptions);
      heightTexture = configureMeshTexture(new THREE.CanvasTexture(heightCanvas), meshOptions);
      if (material && ["relief", "reliefPlane"].includes(meshOptions.viewMode)) {
        material.displacementMap = meshOptions.viewMode === "reliefPlane" ? heightTexture : null;
        material.bumpMap = heightTexture;
        material.needsUpdate = true;
      }
      if (!renderStarted) startPreview();
    }) : null;
    configureMeshTexture(texture, meshOptions);

    const makeMaterial = () => {
      if (meshOptions.viewMode === "normal") {
        return new THREE.MeshNormalMaterial({ side: THREE.DoubleSide });
      }
      if (meshOptions.viewMode === "wire") {
        return new THREE.MeshBasicMaterial({ color: "#202428", wireframe: true, side: THREE.DoubleSide });
      }
      const useTexture = ["texture", "relief", "reliefPlane"].includes(meshOptions.viewMode) && texture;
      const reliefScale = Number(displacement || 0) * (0.25 + Number(meshOptions.bumpStrength || 0.35));
      return new THREE.MeshStandardMaterial({
        color: useTexture ? "#f7f7f3" : "#8d9a8f",
        map: useTexture ? texture : null,
        bumpMap: useTexture ? (heightTexture || texture) : null,
        bumpScale: useTexture ? reliefScale * 0.32 : 0,
        displacementMap: meshOptions.viewMode === "reliefPlane" ? (heightTexture || texture) : null,
        displacementScale: meshOptions.viewMode === "reliefPlane" ? reliefScale : 0,
        displacementBias: meshOptions.viewMode === "reliefPlane" ? -reliefScale * 0.45 : 0,
        flatShading: !meshOptions.smoothShading,
        roughness: useTexture ? 0.58 : 0.74,
        metalness: 0.02,
        side: THREE.DoubleSide,
      });
    };
    material = makeMaterial();
    const lineMaterial = new THREE.LineBasicMaterial({ color: "#202428" });

    const group = new THREE.Group();
    scene.add(group);
    const addReliefPlane = (message = "Dense UV relief plane preview") => {
      const reliefSegments = [96, 144, 208, 288][Math.max(0, Math.min(3, Number(meshOptions.subdivision || 0)))];
      const geometry = new THREE.PlaneGeometry(2.8, 2.1, reliefSegments, reliefSegments);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.x = -0.78;
      mesh.rotation.z = -0.12;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      fitGroup(group, [mesh]);
      setStatus(message);
    };
    const addFallback = () => {
      addReliefPlane(objUrl ? "OBJ could not be displayed. Showing generated relief plane." : "Generated relief preview");
    };

    const fitGroup = (root, focusObjects = []) => {
      root.position.set(0, 0, 0);
      root.scale.set(1, 1, 1);
      root.updateMatrixWorld(true);
      const box = new THREE.Box3();
      const targets = focusObjects.length ? focusObjects : [root];
      targets.forEach((target) => {
        target.updateMatrixWorld(true);
        box.union(new THREE.Box3().setFromObject(target));
      });
      if (box.isEmpty()) return false;
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      if (!Number.isFinite(maxDim) || maxDim <= 0.0001) return false;
      root.position.sub(center);
      root.updateMatrixWorld(true);
      const scale = 2.8 / maxDim;
      root.scale.setScalar(scale);
      root.updateMatrixWorld(true);
      const scaledBox = new THREE.Box3();
      targets.forEach((target) => {
        target.updateMatrixWorld(true);
        scaledBox.union(new THREE.Box3().setFromObject(target));
      });
      const scaledSize = scaledBox.getSize(new THREE.Vector3());
      const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
      if (Number.isFinite(scaledCenter.x)) {
        root.position.sub(scaledCenter);
        root.updateMatrixWorld(true);
      }
      const fittedRadius = Math.max(1, scaledSize.length() * 0.5);
      const distance = fittedRadius / Math.sin((camera.fov * Math.PI) / 360);
      camera.near = Math.max(0.001, distance / 1000);
      camera.far = Math.max(100, distance * 1000);
      camera.position.set(distance * 0.38, distance * 0.32, distance);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
      controls.target.set(0, 0, 0);
      controls.minDistance = fittedRadius * 0.05;
      controls.maxDistance = distance * 20;
      controls.update();
      return true;
    };

    const startPreview = () => {
      if (renderStarted || stopped) return;
      renderStarted = true;
      if (meshOptions.viewMode === "reliefPlane") {
        addReliefPlane("Dense UV relief plane / selected matrix");
      } else if (objUrl) {
      setStatus("Loading OBJ...");
      new OBJLoader().load(
        objUrl,
        (object) => {
          let meshCount = 0;
          let lineCount = 0;
          let vertexCount = 0;
          let sourceVertexCount = 0;
          const meshObjects = [];
          const lineObjects = [];
          object.traverse((child) => {
            if (child.isMesh) {
              meshCount += 1;
              sourceVertexCount += child.geometry?.attributes?.position?.count || 0;
              child.geometry = prepareMeshGeometry(child.geometry, meshOptions);
              if (["relief", "reliefPlane"].includes(meshOptions.viewMode)) {
                child.geometry = displaceGeometryByHeight(child.geometry, heightCanvas, meshOptions, displacement);
              }
              meshObjects.push(child);
              vertexCount += child.geometry?.attributes?.position?.count || 0;
              child.material = material;
              child.geometry?.computeVertexNormals?.();
              child.castShadow = true;
              child.receiveShadow = true;
              const edges = meshOptions.showEdges ? makeMeshEdges(child) : null;
              if (edges) child.add(edges);
            } else if (child.isLine || child.isLineSegments) {
              lineCount += 1;
              lineObjects.push(child);
              vertexCount += child.geometry?.attributes?.position?.count || 0;
              child.material = lineMaterial;
            }
          });
          if (!meshCount && !lineCount) {
            addFallback();
            setStatus("OBJ loaded, but no mesh faces or curve geometry were found.");
            return;
          }
          group.add(object);
          if (!fitGroup(group, meshObjects.length ? meshObjects : lineObjects)) {
            group.remove(object);
            addFallback();
            setStatus("OBJ geometry loaded, but its bounds were too small to frame.");
            return;
          }
          setStatus(`${meshCount} mesh${meshCount === 1 ? "" : "es"}${lineCount ? `, ${lineCount} line set${lineCount === 1 ? "" : "s"}` : ""} / ${sourceVertexCount.toLocaleString()} -> ${vertexCount.toLocaleString()} vertices / ${meshOptions.prepMode}`);
        },
        undefined,
        () => {
          addFallback();
        },
      );
      } else {
        addFallback();
      }
    };

    let stopped = false;
    const animate = () => {
      if (stopped) return;
      controls.update();
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };
    animate();
    if (!textureUrl) startPreview();

    const onResize = () => {
      const w = mount.clientWidth || 320;
      const h = mount.clientHeight || 260;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(onResize) : null;
    observer?.observe(mount);
    window.addEventListener("resize", onResize);

    return () => {
      stopped = true;
      observer?.disconnect();
      window.removeEventListener("resize", onResize);
      controls.dispose();
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj.isMesh || obj.isLine || obj.isLineSegments) {
          obj.geometry?.dispose?.();
          if (Array.isArray(obj.material)) obj.material.forEach((mat) => mat.dispose?.());
          else obj.material?.dispose?.();
        }
      });
      lineMaterial.dispose();
      texture?.dispose?.();
      heightTexture?.dispose?.();
    };
  }, [objUrl, textureUrl, displacement, meshOptions]);

  return (
    <div className="pattern-mesh-preview">
      <div className="mesh-canvas-mount" ref={mountRef} />
      <span className="mesh-status-overlay">{status}</span>
    </div>
  );
}

export default function PatternProjectionLab({ apiBase, results = [], generatedOutputs = [], registerGeneratedOutput }) {
  const [nodes, setNodes] = useState(INITIAL_NODES);
  const [sources, setSources] = useState([]);
  const [activeSourceId, setActiveSourceId] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceName, setSourceName] = useState("Drop or select a source image");
  const [mapCanvases, setMapCanvases] = useState([]);
  const [connectedMapIds, setConnectedMapIds] = useState([]);
  const [inspectedMap, setInspectedMap] = useState(null);
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const canvasRef = useRef(null);
  const panRef = useRef(null);
  const [selectedVariant, setSelectedVariant] = useState(0);
  const [objUrl, setObjUrl] = useState("");
  const [meshName, setMeshName] = useState("Generated relief plane");
  const [meshOptions, setMeshOptions] = useState(DEFAULT_MESH_OPTIONS);
  const [projectionType, setProjectionType] = useState("Box / Rhino friendly");
  const [options, setOptions] = useState(DEFAULT_MIXER_OPTIONS);
  const [printOptions, setPrintOptions] = useState(DEFAULT_PRINT_OPTIONS);
  const [selectedPrint, setSelectedPrint] = useState(0);
  const [pixelLoomOptions, setPixelLoomOptions] = useState(DEFAULT_PIXEL_LOOM_OPTIONS);
  const [selectedPixelLoom, setSelectedPixelLoom] = useState(0);
  const [rfNodes, setRfNodes] = useState([]);
  const [layoutVersion, setLayoutVersion] = useState(0);
  const [opencvStatus] = useState("installed");
  const recipeInputRef = useRef(null);
  const sourceInputRef = useRef(null);
  const objInputRef = useRef(null);
  const layoutVersionRef = useRef(layoutVersion);

  const hybridMap = useMemo(
    () => blendMaps(sources, connectedMapIds, options),
    [connectedMapIds, options, sources],
  );

  const existingPatterns = useMemo(() => {
    const fromResults = results.flatMap((result, idx) =>
      Object.entries(result.maps || {})
        .filter(([key]) => !["original"].includes(key))
        .map(([key, path]) => ({
          id: `result-${idx}-${key}`,
          label: `${result.original_name || "Archive"} / ${mapTitle(key)}`,
          url: resolveMapUrl(path, apiBase),
        })),
    );
    const fromGenerated = generatedOutputs.map((item) => ({
      id: item.id,
      label: item.title || "Generated Output",
      url: item.previewUrl,
    }));
    return [...fromGenerated, ...fromResults].slice(0, 18);
  }, [apiBase, generatedOutputs, results]);

  const variants = useMemo(() => {
    const connectedMaps = mapsFromConnections(sources, connectedMapIds);
    const inputMaps = hybridMap ? [hybridMap, ...connectedMaps] : connectedMaps.length ? connectedMaps : mapCanvases;
    if (!inputMaps.length) return [];
    return Array.from({ length: 9 }, (_, index) => {
      const canvas = buildVariantCanvas(inputMaps, options, index);
      return {
        id: `gen-${index + 1}`,
        label: `Gen ${String(index + 1).padStart(2, "0")}`,
        url: canvas.toDataURL("image/png", 0.95),
        canvas,
        recipe: `${inputMaps[index % inputMaps.length]?.label || "Map"} + ${projectionType}`,
      };
    });
  }, [connectedMapIds, hybridMap, mapCanvases, options, projectionType, sources]);

  const selected = variants[selectedVariant] || variants[0] || null;
  const printBase = hybridMap?.canvas || selected?.canvas || mapCanvases[0]?.canvas || null;
  const printVariants = useMemo(() => {
    if (!printBase) return [];
    return Array.from({ length: 9 }, (_, index) => {
      const canvas = buildPrintCanvas(printBase, printOptions, index);
      return {
        id: `print-${index + 1}`,
        label: `Print ${String(index + 1).padStart(2, "0")}`,
        canvas,
        url: canvas.toDataURL("image/png", 0.95),
        recipe: `${printOptions.method} / ${printOptions.palette}`,
      };
    });
  }, [printBase, printOptions]);
  const selectedPrintOutput = printVariants[selectedPrint] || printVariants[0] || null;
  const pixelLoomVariants = useMemo(() => (
    Array.from({ length: 9 }, (_, index) => {
      const canvas = buildPixelLoomCanvas(printBase, pixelLoomOptions, index);
      return {
        id: `pixel-loom-${index + 1}`,
        label: `Loom ${String(index + 1).padStart(2, "0")}`,
        canvas,
        url: canvas.toDataURL("image/png", 0.95),
        recipe: `${pixelLoomOptions.seedType} / ${pixelLoomOptions.palette} / ${pixelLoomOptions.gridSize}px`,
      };
    })
  ), [pixelLoomOptions, printBase]);
  const selectedPixelLoomOutput = pixelLoomVariants[selectedPixelLoom] || pixelLoomVariants[0] || null;
  const connectedMaps = useMemo(
    () => mapsFromConnections(sources, connectedMapIds),
    [connectedMapIds, sources],
  );

  const moveNode = (id, next) => {
    setNodes((prev) => ({ ...prev, [id]: next }));
  };

  const resizeNode = (id, next) => {
    setNodes((prev) => ({ ...prev, [id]: { ...prev[id], ...next } }));
  };

  const toggleMapConnection = (sourceId, key) => {
    const id = connectionId(sourceId, key);
    setConnectedMapIds((prev) => (
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    ));
  };

  const activateSource = (source) => {
    setActiveSourceId(source.id);
    setSourceUrl(source.url);
    setSourceName(source.label);
    setMapCanvases(source.maps);
    setSelectedVariant(0);
  };

  const loadSource = (url, label, shouldStore = true, sourceMeta = {}) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      const base = imageToCanvas(image);
      const preview = base.toDataURL("image/png", 0.95);
      const mapEdits = sourceMeta.mapEdits || [];
      const maps = MAP_TYPES.map((type, index) => {
          const canvas = deriveMapFromCanvas(base, type.mode, index);
          const savedEdit = mapEdits.find((item) => item.key === type.key)?.edit || {};
          const edited = Object.keys(savedEdit).length ? editMapCanvas(canvas, savedEdit) : canvas;
          return { ...type, edit: savedEdit, baseCanvas: canvas, canvas: edited, url: edited.toDataURL("image/png", 0.95) };
        });
      const source = {
        id: sourceMeta.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        label,
        url: preview,
        maps,
        analysis: analyzeCanvas(base),
      };
      if (shouldStore) {
        setSources((prev) => {
          const next = [...prev, source].slice(0, 8);
          const index = next.findIndex((item) => item.id === source.id);
          const x = 80 + index * 410;
          setNodes((old) => ({
            ...old,
            [`source-${source.id}`]: old[`source-${source.id}`] || { x, y: 320, w: 300 },
            [`maps-${source.id}`]: old[`maps-${source.id}`] || { x, y: 640, w: 340 },
          }));
          setConnectedMapIds((old) => (
            old.length ? old : [connectionId(source.id, "density"), connectionId(source.id, "height")]
          ));
          return next;
        });
      }
      activateSource(source);
    };
    image.src = url;
  };

  useEffect(() => {
    if (!sourceUrl && existingPatterns[0]?.url) {
      loadSource(existingPatterns[0].url, existingPatterns[0].label);
    }
  }, [existingPatterns, sourceUrl]);

  const onSourceUpload = (event) => {
    const files = Array.from(event.target.files || []);
    files.forEach((file) => {
      const url = URL.createObjectURL(file);
      loadSource(url, file.name);
    });
    event.target.value = "";
  };

  const onObjUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (objUrl?.startsWith("blob:")) URL.revokeObjectURL(objUrl);
    setObjUrl(URL.createObjectURL(file));
    setMeshName(file.name);
    event.target.value = "";
  };

  const updateOption = (key, value) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
  };

  const updateMeshOption = (key, value) => {
    setMeshOptions((prev) => ({ ...prev, [key]: value }));
  };

  const updateSingleMapEdit = (sourceId, mapKey, key, value) => {
    setSources((prev) => prev.map((source) => {
      if (source.id !== sourceId) return source;
      const maps = source.maps.map((map) => {
        if (map.key !== mapKey) return map;
        const edit = { ...(map.edit || {}), [key]: value };
        const canvas = editMapCanvas(map.baseCanvas || map.canvas, edit);
        const nextMap = { ...map, edit, canvas, url: canvas.toDataURL("image/png", 0.95) };
        setInspectedMap((current) => (
          current?.sourceId === sourceId && current?.key === mapKey ? { ...nextMap, sourceId } : current
        ));
        return nextMap;
      });
      if (source.id === activeSourceId) setMapCanvases(maps);
      return { ...source, maps };
    }));
  };

  const resetSingleMapEdit = (sourceId, mapKey) => {
    setSources((prev) => prev.map((source) => {
      if (source.id !== sourceId) return source;
      const maps = source.maps.map((map) => {
        if (map.key !== mapKey) return map;
        const canvas = map.baseCanvas || map.canvas;
        const nextMap = { ...map, edit: {}, canvas, url: canvas.toDataURL("image/png", 0.95) };
        setInspectedMap((current) => (
          current?.sourceId === sourceId && current?.key === mapKey ? { ...nextMap, sourceId } : current
        ));
        return nextMap;
      });
      if (source.id === activeSourceId) setMapCanvases(maps);
      return { ...source, maps };
    }));
  };

  const exportSelectedPng = () => {
    if (!selected) return;
    downloadDataUrl(`pattern-projection-${selected.label.toLowerCase().replaceAll(" ", "-")}.png`, selected.url);
    registerGeneratedOutput?.({
      kind: "pattern-projection",
      title: `Pattern Projection ${selected.label}`,
      previewUrl: selected.url,
      metadata: {
        lineage: {
          source: sourceName,
          projectionType,
          displacement: options.displacement,
          threshold: options.threshold,
          exportType: "UV map PNG",
        },
      },
    });
  };

  const exportReliefObj = () => {
    if (!selected) return;
    downloadText(
      `pattern-relief-${selected.label.toLowerCase().replaceAll(" ", "-")}.obj`,
      buildReliefObj(selected.canvas, options.displacement, 60),
      "text/plain",
    );
  };

  const exportRecipe = () => {
    const recipe = {
      lab: "Pattern Projection Lab",
      version: 2,
      source: sourceName,
      mesh: meshName,
      projectionType,
      meshPreview: meshOptions,
      nodes,
      settings: options,
      printSettings: printOptions,
      pixelLoomSettings: pixelLoomOptions,
      selectedPrintGeneration: selectedPrintOutput?.label || "None",
      selectedPixelLoomGeneration: selectedPixelLoomOutput?.label || "None",
      selectedGeneration: selected?.label || "None",
      channels: mapCanvases.map((m) => m.label),
      connectedChannels: connectedMaps.map((map) => `${map.sourceLabel} / ${map.label}`),
      connectedMapIds,
      sources: sources.map((source) => ({
        id: source.id,
        label: source.label,
        url: source.url,
        analysis: source.analysis,
        mapEdits: source.maps.map((map) => ({ key: map.key, edit: map.edit || {} })),
      })),
      exportTargets: ["Rhino OBJ", "heightmap PNG", "material zones PNG", "recipe JSON"],
    };
    downloadText("pattern-projection-recipe.json", JSON.stringify(recipe, null, 2), "application/json");
  };

  const importRecipe = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const recipe = JSON.parse(String(reader.result || "{}"));
        if (recipe.nodes) setNodes(recipe.nodes);
        if (recipe.settings) setOptions({ ...DEFAULT_MIXER_OPTIONS, ...recipe.settings });
        if (recipe.meshPreview) setMeshOptions({ ...DEFAULT_MESH_OPTIONS, ...recipe.meshPreview });
        if (recipe.printSettings) {
          const nextPrintSettings = { ...DEFAULT_PRINT_OPTIONS, ...recipe.printSettings };
          setPrintOptions(nextPrintSettings);
        }
        if (recipe.pixelLoomSettings) setPixelLoomOptions({ ...DEFAULT_PIXEL_LOOM_OPTIONS, ...recipe.pixelLoomSettings });
        if (recipe.projectionType) setProjectionType(recipe.projectionType);
        if (Array.isArray(recipe.connectedMapIds)) setConnectedMapIds(recipe.connectedMapIds);
        if (Array.isArray(recipe.sources)) {
          setSources([]);
          recipe.sources.forEach((source) => {
            if (source.url) loadSource(source.url, source.label || "Recipe source", true, source);
          });
        }
      } catch (error) {
        window.alert("This recipe file could not be loaded.");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  const zoomCanvas = (delta, clientX = null, clientY = null) => {
    setView((prev) => {
      const nextScale = Math.max(0.35, Math.min(1.8, prev.scale + delta));
      if (!canvasRef.current || clientX === null || clientY === null || nextScale === prev.scale) {
        return { ...prev, scale: nextScale };
      }
      const rect = canvasRef.current.getBoundingClientRect();
      const localX = clientX - rect.left;
      const localY = clientY - rect.top;
      const graphX = (localX - prev.x) / prev.scale;
      const graphY = (localY - prev.y) / prev.scale;
      return {
        scale: nextScale,
        x: localX - graphX * nextScale,
        y: localY - graphY * nextScale,
      };
    });
  };

  const resetCanvasView = () => {
    setView({ x: 0, y: 0, scale: 1 });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const onWheel = (event) => {
      if (event.target.closest(".react-flow")) return;
      if (event.target.closest(".pattern-mesh-preview")) return;
      event.preventDefault();
      const delta = event.deltaY > 0 ? -0.08 : 0.08;
      zoomCanvas(delta, event.clientX, event.clientY);
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, []);

  const resetBranchMixer = () => {
    setProjectionType("Box / Rhino friendly");
    setOptions((prev) => ({
      ...prev,
      ...DEFAULT_MIXER_OPTIONS,
    }));
  };

  const resetPrintComposer = () => {
    setPrintOptions(DEFAULT_PRINT_OPTIONS);
  };

  const resetPixelLoom = () => {
    setPixelLoomOptions(DEFAULT_PIXEL_LOOM_OPTIONS);
  };

  const exportPrintPng = () => {
    if (!selectedPrintOutput) return;
    downloadDataUrl(`pattern-print-${selectedPrintOutput.label.toLowerCase().replaceAll(" ", "-")}.png`, selectedPrintOutput.url);
    registerGeneratedOutput?.({
      kind: "print-composer",
      title: `Print Composer ${selectedPrintOutput.label}`,
      previewUrl: selectedPrintOutput.url,
      metadata: { lineage: { source: sourceName, printOptions, connectedChannels: connectedMaps.map((map) => `${map.sourceLabel} / ${map.label}`) } },
    });
  };

  const exportPrintSvgOutput = () => {
    if (!selectedPrintOutput) return;
    downloadText(
      `pattern-print-${selectedPrintOutput.label.toLowerCase().replaceAll(" ", "-")}.svg`,
      exportPrintSvg(selectedPrintOutput.canvas, printOptions),
      "image/svg+xml",
    );
  };

  const exportPixelLoomPng = () => {
    if (!selectedPixelLoomOutput) return;
    downloadDataUrl(`pixel-loom-${selectedPixelLoomOutput.label.toLowerCase().replaceAll(" ", "-")}.png`, selectedPixelLoomOutput.url);
    registerGeneratedOutput?.({
      kind: "pixel-loom",
      title: `Pixel Loom ${selectedPixelLoomOutput.label}`,
      previewUrl: selectedPixelLoomOutput.url,
      metadata: {
        lineage: {
          source: sourceName,
          pixelLoomOptions,
          selectedGeneration: selectedPixelLoomOutput.label,
          connectedChannels: connectedMaps.map((map) => `${map.sourceLabel} / ${map.label}`),
          exportType: "Pixel loom PNG",
        },
      },
    });
  };

  const exportPixelLoomRecipe = () => {
    if (!selectedPixelLoomOutput) return;
    downloadText(
      `pixel-loom-${selectedPixelLoomOutput.label.toLowerCase().replaceAll(" ", "-")}.json`,
      JSON.stringify({
        lab: "Pattern Projection Lab",
        tool: "Pixel Loom",
        source: sourceName,
        selectedGeneration: selectedPixelLoomOutput.label,
        settings: pixelLoomOptions,
        recipe: selectedPixelLoomOutput.recipe,
      }, null, 2),
      "application/json",
    );
  };

  const onCanvasPointerDown = (event) => {
    if (event.button !== 2) return;
    event.preventDefault();
    panRef.current = { px: event.clientX, py: event.clientY, x: view.x, y: view.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onCanvasPointerMove = (event) => {
    if (!panRef.current) return;
    setView((prev) => ({
      ...prev,
      x: panRef.current.x + event.clientX - panRef.current.px,
      y: panRef.current.y + event.clientY - panRef.current.py,
    }));
  };

  const onCanvasPointerUp = () => {
    panRef.current = null;
  };

  const flowNodes = useMemo(() => {
    const makeNode = (id, title, kind, content, extra = {}) => ({
      id,
      type: "panel",
      position: { x: nodes[id]?.x || 0, y: nodes[id]?.y || 0 },
      dragHandle: ".pattern-node-head",
      data: {
        title,
        kind,
        content,
        ...extra,
      },
      style: {
        width: nodes[id]?.w || 280,
        height: nodes[id]?.h || undefined,
      },
    });

    const baseNodes = [
      makeNode(
        "database",
        "Image Database",
        "database",
        <>
          <button
            type="button"
            className="node-upload nodrag"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              sourceInputRef.current?.click();
            }}
          >
            Open Image Set
          </button>
          <input ref={sourceInputRef} className="hidden-file-input" type="file" accept="image/*" multiple onChange={onSourceUpload} />
          <div className="database-branch-list nowheel">
            {(sources.length ? sources : existingPatterns.slice(0, 6)).map((source, index) => (
              <button
                key={source.id}
                type="button"
                className={source.id === activeSourceId ? "active" : ""}
                onClick={() => (source.maps ? activateSource(source) : loadSource(source.url, source.label))}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                {source.url ? <img src={source.url} alt={source.label} /> : null}
                <b>{source.label}</b>
              </button>
            ))}
          </div>
        </>,
        { target: false, sourceHandle: "database-out" },
      ),
      makeNode(
        "blend",
        "Hybrid Map Builder",
        "tool blend-builder",
        <div className="node-control-list nowheel">
          <p className="node-help">Drag wires from extracted map sockets into this panel. Connected maps create the hybrid input used by UV and print outputs.</p>
          <div className="blend-input-stack">
            {connectedMaps.length ? connectedMaps.map((map) => (
              <button key={`${map.sourceId}-${map.key}`} type="button" onClick={() => toggleMapConnection(map.sourceId, map.key)}>
                <img src={map.url} alt={map.label} />
                <span>{map.sourceLabel} / {map.label}</span>
                <em>disconnect</em>
              </button>
            )) : <div className="node-empty small">Connect map sockets</div>}
          </div>
          {hybridMap ? <img className="hybrid-map-preview" src={hybridMap.url} alt={hybridMap.label} /> : null}
        </div>,
        { targetHandle: "map-input", sourceHandle: "hybrid-out" },
      ),
      makeNode(
        "branch",
        "Branch Mixer",
        "tool",
        <div className="node-control-list nowheel">
          <p className="node-help">Connected map tiles are blended into UV generations. Drag or delete wires to change the procedural recipe.</p>
          <button type="button" className="tool-reset-btn" onClick={resetBranchMixer}>Reset Mixer Defaults</button>
          <div className="connected-map-list">
            {connectedMaps.length ? connectedMaps.map((map) => (
              <button key={`${map.sourceId}-${map.key}`} type="button" onClick={() => toggleMapConnection(map.sourceId, map.key)}>
                {map.label} x
              </button>
            )) : <span>No connected maps</span>}
          </div>
          <label>
            Projection
            <select value={projectionType} onChange={(e) => setProjectionType(e.target.value)}>
              <option>Box / Rhino friendly</option>
              <option>Planar tile</option>
              <option>Cylindrical wrap</option>
              <option>Triplanar preview</option>
            </select>
          </label>
          <label>
            Blend Mode
            <select value={options.blendMode} onChange={(e) => updateOption("blendMode", e.target.value)}>
              <option value="multiply">Multiply</option>
              <option value="screen">Screen</option>
              <option value="overlay">Overlay</option>
              <option value="difference">Difference</option>
              <option value="source-over">Normal</option>
            </select>
          </label>
          <label>
            Scale {options.scale.toFixed(2)}
            <input type="range" min="0.65" max="1.8" step="0.05" value={options.scale} onChange={(e) => updateOption("scale", Number(e.target.value))} />
          </label>
          <label>
            Rotation {options.rotation} deg
            <input type="range" min="-90" max="90" step="3" value={options.rotation} onChange={(e) => updateOption("rotation", Number(e.target.value))} />
          </label>
          <label>
            Threshold {options.threshold}
            <input type="range" min="10" max="220" step="5" value={options.threshold} onChange={(e) => updateOption("threshold", Number(e.target.value))} />
          </label>
          <label>
            Height Power {options.heightPower.toFixed(2)}
            <input type="range" min="0.55" max="2.8" step="0.05" value={options.heightPower} onChange={(e) => updateOption("heightPower", Number(e.target.value))} />
          </label>
          <label>
            Material Zones {options.zoneCount}
            <input type="range" min="3" max="6" step="1" value={options.zoneCount} onChange={(e) => updateOption("zoneCount", Number(e.target.value))} />
          </label>
        </div>,
        { targetHandle: "hybrid-in", sourceHandle: "mixer-out" },
      ),
      makeNode(
        "print",
        "Print Composer",
        "tool print-composer",
        <PrintComposerControls
          options={printOptions}
          onCommit={setPrintOptions}
          onReset={resetPrintComposer}
          selectedPrintOutput={selectedPrintOutput}
        />,
        { targetHandle: "hybrid-in", sourceHandle: "print-out" },
      ),
      makeNode(
        "printMatrix",
        "Print Matrix",
        "matrix print-matrix",
        <>
          <p className="node-help matrix-help">Printable 2D generations for posters, collages, and plotter-style artwork.</p>
          <div className="uv-matrix-grid nowheel">
            {printVariants.map((variant, index) => (
              <button key={variant.id} type="button" className={index === selectedPrint ? "active" : ""} onClick={() => setSelectedPrint(index)}>
                <img src={variant.url} alt={variant.label} />
                <span>{variant.label}</span>
              </button>
            ))}
          </div>
        </>,
        { targetHandle: "print-in", sourceHandle: "print-matrix-out" },
      ),
      makeNode(
        "printExport",
        "Print Export",
        "export print-export",
        <>
          <div className="export-card-preview">
            {selectedPrintOutput ? <img src={selectedPrintOutput.url} alt={selectedPrintOutput.label} /> : null}
            <div>
              <strong>{selectedPrintOutput?.label || "No print generation"}</strong>
              <span>{selectedPrintOutput?.recipe || "Select a print matrix output"}</span>
            </div>
          </div>
          <div className="node-actions">
            <button type="button" onClick={exportPrintPng} disabled={!selectedPrintOutput}>Export Print PNG</button>
            <button type="button" onClick={exportPrintSvgOutput} disabled={!selectedPrintOutput}>Export Plotter SVG</button>
          </div>
        </>,
        { targetHandle: "print-export-in", source: false },
      ),
      makeNode(
        "pixelLoom",
        "Pixel Loom",
        "tool pixel-loom",
        <PixelLoomControls
          options={pixelLoomOptions}
          onCommit={setPixelLoomOptions}
          onReset={resetPixelLoom}
          selectedOutput={selectedPixelLoomOutput}
        />,
        { targetHandle: "hybrid-in", sourceHandle: "pixel-loom-out" },
      ),
      makeNode(
        "pixelLoomMatrix",
        "Pixel Loom Matrix",
        "matrix pixel-loom-matrix",
        <>
          <p className="node-help matrix-help">Square pixel-rug studies generated from tiny seed grids, micro-rotations, blend modes, and palette quantization.</p>
          <div className="uv-matrix-grid nowheel pixel-loom-grid">
            {pixelLoomVariants.map((variant, index) => (
              <button key={variant.id} type="button" className={index === selectedPixelLoom ? "active" : ""} onClick={() => setSelectedPixelLoom(index)}>
                <img src={variant.url} alt={variant.label} />
                <span>{variant.label}</span>
              </button>
            ))}
          </div>
        </>,
        { targetHandle: "pixel-loom-in", sourceHandle: "pixel-loom-matrix-out" },
      ),
      makeNode(
        "pixelLoomExport",
        "Pixel Loom Export",
        "export pixel-loom-export",
        <>
          <div className="export-card-preview">
            {selectedPixelLoomOutput ? <img src={selectedPixelLoomOutput.url} alt={selectedPixelLoomOutput.label} /> : null}
            <div>
              <strong>{selectedPixelLoomOutput?.label || "No loom generation"}</strong>
              <span>{selectedPixelLoomOutput?.recipe || "Select a loom matrix output"}</span>
            </div>
          </div>
          <div className="node-actions">
            <button type="button" onClick={exportPixelLoomPng} disabled={!selectedPixelLoomOutput}>Export Loom PNG</button>
            <button type="button" onClick={exportPixelLoomRecipe} disabled={!selectedPixelLoomOutput}>Recipe JSON</button>
          </div>
        </>,
        { targetHandle: "pixel-loom-export-in", source: false },
      ),
      makeNode(
        "matrix",
        "UV Matrix",
        "matrix",
        <>
          <p className="node-help matrix-help">Each tile is a possible UV/heightmap generation from the active connected maps plus mixer settings.</p>
          <div className="uv-matrix-grid nowheel">
            {variants.map((variant, index) => (
              <button key={variant.id} type="button" className={index === selectedVariant ? "active" : ""} onClick={() => setSelectedVariant(index)}>
                <img src={variant.url} alt={variant.label} />
                <span>{variant.label}</span>
              </button>
            ))}
          </div>
        </>,
        { targetHandle: "mixer-in", sourceHandle: "matrix-out" },
      ),
      makeNode(
        "mesh",
        "OBJ Mesh Preview",
        "mesh",
        <>
          <button
            type="button"
            className="node-upload nodrag"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              objInputRef.current?.click();
            }}
          >
            Import OBJ
          </button>
          <input ref={objInputRef} className="hidden-file-input" type="file" accept=".obj" onChange={onObjUpload} />
          <div className="mesh-preview-controls nodrag nowheel">
            {selected ? (
              <div className="mesh-active-map">
                <img src={selected.url} alt={selected.label} />
                <span>Active UV matrix<br /><b>{selected.label}</b></span>
              </div>
            ) : null}
            <label>
              Mesh View
              <select value={meshOptions.viewMode} onChange={(e) => updateMeshOption("viewMode", e.target.value)}>
                <option value="solid">Solid geometry</option>
                <option value="texture">UV matrix material</option>
                <option value="relief">UV matrix displacement</option>
                <option value="reliefPlane">Dense relief plane</option>
                <option value="normal">Normal debug</option>
                <option value="wire">Wireframe debug</option>
              </select>
            </label>
            <label>
              UV Projection
              <select value={meshOptions.uvProjection} onChange={(e) => updateMeshOption("uvProjection", e.target.value)}>
                <option value="auto">Auto / generated projection</option>
                <option value="existing">Existing OBJ UVs</option>
                <option value="xy">Planar XY</option>
                <option value="xz">Planar XZ</option>
                <option value="yz">Planar YZ</option>
              </select>
            </label>
            <label>
              Mesh Prep
              <select value={meshOptions.prepMode} onChange={(e) => updateMeshOption("prepMode", e.target.value)}>
                <option value="raw">Raw OBJ</option>
                <option value="clean">Clean / weld</option>
                <option value="remesh">Remesh / smooth</option>
              </select>
            </label>
          </div>
          <MeshPreview objUrl={objUrl} textureUrl={selected?.url} displacement={options.displacement} meshOptions={meshOptions} />
          <label className="mesh-displace-control nodrag">
            UV Scale {meshOptions.textureScale.toFixed(2)}
            <input type="range" min="0.25" max="4" step="0.05" value={meshOptions.textureScale} onChange={(e) => updateMeshOption("textureScale", Number(e.target.value))} />
          </label>
          <label className="mesh-displace-control nodrag">
            UV Rotation {meshOptions.textureRotation} deg
            <input type="range" min="-180" max="180" step="5" value={meshOptions.textureRotation} onChange={(e) => updateMeshOption("textureRotation", Number(e.target.value))} />
          </label>
          <label className="mesh-displace-control nodrag">
            Bump Strength {meshOptions.bumpStrength.toFixed(2)}
            <input type="range" min="0" max="1.2" step="0.05" value={meshOptions.bumpStrength} onChange={(e) => updateMeshOption("bumpStrength", Number(e.target.value))} />
          </label>
          <label className="mesh-displace-control nodrag">
            Height Source
            <select value={meshOptions.heightSource} onChange={(e) => updateMeshOption("heightSource", e.target.value)}>
              <option value="luminance">Light / dark luminance</option>
              <option value="red">Red channel</option>
              <option value="green">Green channel</option>
              <option value="blue">Blue channel</option>
              <option value="saturation">Color saturation</option>
              <option value="targetColor">Selected color range</option>
            </select>
          </label>
          <label className="mesh-displace-control nodrag">
            Dark Cutoff {meshOptions.heightLow.toFixed(2)}
            <input type="range" min="0" max="0.95" step="0.01" value={meshOptions.heightLow} onChange={(e) => updateMeshOption("heightLow", Number(e.target.value))} />
          </label>
          <label className="mesh-displace-control nodrag">
            Light Cutoff {meshOptions.heightHigh.toFixed(2)}
            <input type="range" min="0.05" max="1" step="0.01" value={meshOptions.heightHigh} onChange={(e) => updateMeshOption("heightHigh", Number(e.target.value))} />
          </label>
          <label className="mesh-displace-control nodrag">
            Height Gamma {meshOptions.heightGamma.toFixed(2)}
            <input type="range" min="0.2" max="3" step="0.05" value={meshOptions.heightGamma} onChange={(e) => updateMeshOption("heightGamma", Number(e.target.value))} />
          </label>
          <label className="mesh-displace-control nodrag">
            Target Color
            <input type="color" value={meshOptions.heightColor} onChange={(e) => updateMeshOption("heightColor", e.target.value)} />
          </label>
          <label className="mesh-displace-control nodrag">
            Color Tolerance {meshOptions.heightColorTolerance.toFixed(2)}
            <input type="range" min="0.05" max="1" step="0.01" value={meshOptions.heightColorTolerance} onChange={(e) => updateMeshOption("heightColorTolerance", Number(e.target.value))} />
          </label>
          <label className="mesh-displace-control mesh-check-control nodrag">
            <input type="checkbox" checked={meshOptions.heightInvert} onChange={(e) => updateMeshOption("heightInvert", e.target.checked)} />
            Invert height
          </label>
          <label className="mesh-displace-control nodrag">
            Subdivision {meshOptions.subdivision}
            <input type="range" min="0" max="3" step="1" value={meshOptions.subdivision} onChange={(e) => updateMeshOption("subdivision", Number(e.target.value))} />
          </label>
          <label className="mesh-displace-control nodrag">
            Smooth Iterations {meshOptions.smoothIterations}
            <input type="range" min="0" max="10" step="1" value={meshOptions.smoothIterations} onChange={(e) => updateMeshOption("smoothIterations", Number(e.target.value))} />
          </label>
          <label className="mesh-displace-control nodrag">
            Smooth Strength {meshOptions.smoothStrength.toFixed(2)}
            <input type="range" min="0" max="0.85" step="0.05" value={meshOptions.smoothStrength} onChange={(e) => updateMeshOption("smoothStrength", Number(e.target.value))} />
          </label>
          <label className="mesh-displace-control mesh-check-control nodrag">
            <input type="checkbox" checked={meshOptions.smoothShading} onChange={(e) => updateMeshOption("smoothShading", e.target.checked)} />
            Smooth shading
          </label>
          <label className="mesh-displace-control mesh-check-control nodrag">
            <input type="checkbox" checked={meshOptions.showEdges} onChange={(e) => updateMeshOption("showEdges", e.target.checked)} />
            Edge overlay
          </label>
          <label className="mesh-displace-control nodrag">
            Displacement {options.displacement.toFixed(2)}
            <input type="range" min="0" max="1.1" step="0.02" value={options.displacement} onChange={(e) => updateOption("displacement", Number(e.target.value))} />
          </label>
        </>,
        { targetHandle: "mesh-in", source: false, minWidth: 320, minHeight: 260 },
      ),
      makeNode(
        "export",
        "Rhino Export",
        "export",
        <>
          <div className="export-card-preview">
            {selected ? <img src={selected.url} alt={selected.label} /> : null}
            <div>
              <strong>{selected?.label || "No generation"}</strong>
              <span>{selected?.recipe || "Select a matrix output"}</span>
            </div>
          </div>
          <div className="node-actions">
            <button type="button" onClick={exportSelectedPng} disabled={!selected}>Export UV PNG</button>
            <button type="button" onClick={exportReliefObj} disabled={!selected}>Export Relief OBJ</button>
            <button type="button" onClick={exportRecipe}>Recipe JSON</button>
            <button type="button" onClick={() => recipeInputRef.current?.click()}>Load Recipe</button>
            <input ref={recipeInputRef} className="hidden-file-input" type="file" accept="application/json,.json" onChange={importRecipe} />
          </div>
        </>,
        { targetHandle: "export-in", source: false },
      ),
    ];

    sources.filter((source) => nodes[`source-${source.id}`]).forEach((source) => {
      baseNodes.push(makeNode(
        `source-${source.id}`,
        `Source ${sources.findIndex((item) => item.id === source.id) + 1}`,
        "source branch-source",
        <>
          <img className="node-preview-img" src={source.url} alt={source.label} />
          <p className="node-caption">{source.label}</p>
          {source.analysis ? (
            <div className="source-analysis-card">
              <div className="source-palette-strip">
                {source.analysis.palette.map((color) => <span key={color} style={{ background: color }} />)}
              </div>
              <div className="source-analysis-grid">
                <span>Edge {(source.analysis.edgeDensity * 100).toFixed(0)}%</span>
                <span>Contrast {(source.analysis.contrast * 100).toFixed(0)}%</span>
                <span>{source.analysis.direction}</span>
              </div>
              <div className="source-tag-row">
                {source.analysis.tags.map((tag) => <em key={tag}>{tag}</em>)}
              </div>
            </div>
          ) : null}
        </>,
        { targetHandle: "source-in", sourceHandle: "source-out" },
      ));
      baseNodes.push(makeNode(
        `maps-${source.id}`,
        `Extracted Maps ${sources.findIndex((item) => item.id === source.id) + 1}`,
        "maps branch-maps",
        <div className="node-map-grid nowheel">
          {source.maps.map((map) => {
            const id = connectionId(source.id, map.key);
            return (
              <figure key={map.key}>
                <button type="button" className="map-tile-preview" onClick={() => setInspectedMap({ ...map, sourceId: source.id })}>
                  <img src={map.url} alt={map.label} />
                </button>
                <figcaption>
                  <span>{map.label}</span>
                  <button
                    type="button"
                    className={connectedMapIds.includes(id) ? "wire-port connected" : "wire-port"}
                    onClick={() => toggleMapConnection(source.id, map.key)}
                    title={connectedMapIds.includes(id) ? "Disconnect from Hybrid Builder" : "Connect to Hybrid Builder"}
                  />
                </figcaption>
              </figure>
            );
          })}
        </div>,
        {
          targetHandle: "maps-in",
          source: false,
          mapHandles: source.maps.map((map, index) => ({
            id: `map:${map.key}`,
            label: map.label,
            top: 26 + Math.floor(index / 2) * 27 + (index % 2) * 0,
          })),
        },
      ));
    });

    return baseNodes;
  }, [
    activeSourceId,
    connectedMapIds,
    connectedMaps,
    existingPatterns,
    hybridMap,
    meshName,
    meshOptions,
    nodes,
    objUrl,
    options,
    pixelLoomOptions,
    pixelLoomVariants,
    printOptions,
    printVariants,
    projectionType,
    selected,
    selectedPixelLoom,
    selectedPixelLoomOutput,
    selectedPrint,
    selectedPrintOutput,
    selectedVariant,
    sources,
    variants,
  ]);

  const flowEdges = useMemo(() => {
    const staticEdges = [
      ["blend", "branch", "hybrid-out", "hybrid-in"],
      ["blend", "print", "hybrid-out", "hybrid-in"],
      ["blend", "pixelLoom", "hybrid-out", "hybrid-in"],
      ["print", "printMatrix", "print-out", "print-in"],
      ["printMatrix", "printExport", "print-matrix-out", "print-export-in"],
      ["pixelLoom", "pixelLoomMatrix", "pixel-loom-out", "pixel-loom-in"],
      ["pixelLoomMatrix", "pixelLoomExport", "pixel-loom-matrix-out", "pixel-loom-export-in"],
      ["branch", "matrix", "mixer-out", "mixer-in"],
      ["matrix", "mesh", "matrix-out", "mesh-in"],
      ["matrix", "export", "matrix-out", "export-in"],
    ].map(([source, target, sourceHandle, targetHandle]) => ({
      id: `workflow-${source}-${target}`,
      source,
      target,
      sourceHandle,
      targetHandle,
      type: "smoothstep",
      animated: false,
      className: "workflow-edge",
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
    }));
    const lineageEdges = sources.flatMap((source) => [
      {
        id: `lineage-database-${source.id}`,
        source: "database",
        target: `source-${source.id}`,
        sourceHandle: "database-out",
        targetHandle: "source-in",
        type: "smoothstep",
        className: "lineage-edge",
      },
      {
        id: `lineage-source-${source.id}`,
        source: `source-${source.id}`,
        target: `maps-${source.id}`,
        sourceHandle: "source-out",
        targetHandle: "maps-in",
        type: "smoothstep",
        className: "lineage-edge",
      },
    ]);
    const mapEdges = connectedMapIds.map((id) => {
      const { sourceId, mapKey } = parseConnectionId(id);
      return {
        id: `map-${id}`,
        source: `maps-${sourceId}`,
        target: "blend",
        sourceHandle: `map:${mapKey}`,
        targetHandle: "map-input",
        type: "smoothstep",
        animated: true,
        className: "map-edge",
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
      };
    });
    return [...lineageEdges, ...mapEdges, ...staticEdges];
  }, [connectedMapIds, sources]);

  useEffect(() => {
    setRfNodes((prev) => {
      const forceLayout = layoutVersionRef.current !== layoutVersion;
      layoutVersionRef.current = layoutVersion;
      const prevById = new Map(prev.map((node) => [node.id, node]));
      return flowNodes.map((node) => {
        const current = prevById.get(node.id);
        if (!current || forceLayout) return node;
        return {
          ...node,
          position: current.position,
          selected: current.selected,
          dragging: current.dragging,
          width: current.width,
          height: current.height,
          measured: current.measured,
          style: {
            ...node.style,
            width: current.width || node.style?.width,
            height: current.height || node.style?.height,
          },
        };
      });
    });
  }, [flowNodes, layoutVersion]);

  const onFlowNodesChange = useCallback((changes) => {
    setRfNodes((prev) => applyNodeChanges(changes, prev));
  }, []);

  const onFlowNodeDragStop = useCallback((_, node) => {
    setNodes((prev) => ({
      ...prev,
      [node.id]: {
        ...prev[node.id],
        x: node.position.x,
        y: node.position.y,
      },
    }));
  }, []);

  const syncFlowNodePositions = useCallback(() => {
    setNodes((prev) => {
      const next = { ...prev };
      rfNodes.forEach((node) => {
        if (!next[node.id]) return;
        next[node.id] = {
          ...next[node.id],
          x: node.position.x,
          y: node.position.y,
          ...(node.width ? { w: node.width } : {}),
          ...(node.height ? { h: node.height } : {}),
        };
      });
      return next;
    });
  }, [rfNodes]);

  /*
  const onFlowNodesChangeOld = useCallback((changes) => {
    setNodes((prev) => {
      const next = { ...prev };
      changes.forEach((change) => {
        if (!next[change.id]) return;
        if (change.type === "position" && change.position) {
          next[change.id] = {
            ...next[change.id],
            x: change.position.x,
            y: change.position.y,
          };
        }
        if (change.type === "dimensions" && change.dimensions) {
          next[change.id] = {
            ...next[change.id],
            w: change.dimensions.width || next[change.id].w,
            h: change.dimensions.height || next[change.id].h,
          };
        }
      });
      return next;
    });
  }, []);
  */

  const onFlowConnect = useCallback((connection) => {
    if (connection.target !== "blend" || !connection.source?.startsWith("maps-") || !connection.sourceHandle?.startsWith("map:")) return;
    const sourceId = connection.source.replace("maps-", "");
    const mapKey = connection.sourceHandle.replace("map:", "");
    const id = connectionId(sourceId, mapKey);
    setConnectedMapIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const onFlowEdgesDelete = useCallback((deletedEdges) => {
    const deletedMapIds = deletedEdges
      .map((edge) => (edge.id || "").startsWith("map-") ? edge.id.replace("map-", "") : null)
      .filter(Boolean);
    if (!deletedMapIds.length) return;
    setConnectedMapIds((prev) => prev.filter((id) => !deletedMapIds.includes(id)));
  }, []);

  const resetFlowLayout = () => {
    const sourceLayout = {};
    sources.forEach((source, index) => {
      const x = 80 + index * 410;
      sourceLayout[`source-${source.id}`] = { x, y: 320, w: 300 };
      sourceLayout[`maps-${source.id}`] = { x, y: 640, w: 340 };
    });
    setNodes({ ...INITIAL_NODES, ...sourceLayout });
    setLayoutVersion((value) => value + 1);
  };

  return (
    <section className="tab-panel pattern-projection-tab">
      <section className="glass-panel pattern-lab-shell">
        <div className="pattern-topbar">
          <div>
            <p className="micro-label">Interactive Node Workflow</p>
            <h2>Pattern Projection Lab</h2>
          </div>
          <div className="pattern-stat-row">
            <span>{mapCanvases.length || 0} maps</span>
            <span>{variants.length || 0} UV generations</span>
            <span>{meshName}</span>
            <span>D3 contours</span>
            <span>Paper SVG</span>
            <span>OpenCV {opencvStatus}</span>
            <button type="button" onClick={resetFlowLayout}>Reset layout</button>
          </div>
        </div>

        <div
          className="pattern-canvas pattern-flow-canvas"
          ref={canvasRef}
          onContextMenu={(event) => event.preventDefault()}
        >
          <ReactFlow
            nodes={rfNodes}
            edges={flowEdges}
            nodeTypes={FLOW_NODE_TYPES}
            onNodesChange={onFlowNodesChange}
            onNodeDragStop={onFlowNodeDragStop}
            onConnect={onFlowConnect}
            onEdgesDelete={onFlowEdgesDelete}
            defaultViewport={{ x: 44, y: 54, zoom: 0.78 }}
            minZoom={0.18}
            maxZoom={2.2}
            nodesDraggable
            nodesConnectable
            elementsSelectable
            nodeDragThreshold={1}
            panOnDrag={[1, 2]}
            zoomOnScroll
            zoomOnPinch
            panOnScroll={false}
            selectionOnDrag={false}
            nodeDragHandle=".pattern-node-head"
            deleteKeyCode={["Backspace", "Delete"]}
            multiSelectionKeyCode={["Meta", "Control", "Shift"]}
            connectionLineType="smoothstep"
            defaultEdgeOptions={{
              type: "smoothstep",
              markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
            }}
          >
            <Background color="rgba(35, 39, 43, 0.16)" gap={34} size={1} />
            <MiniMap pannable zoomable nodeStrokeWidth={2} className="pattern-minimap" />
            <Controls showInteractive={false} position="bottom-right" />
          </ReactFlow>
          {false ? (<>
          <div className="pattern-view-controls">
            <button type="button" onClick={() => zoomCanvas(0.12)}>+</button>
            <button type="button" onClick={() => zoomCanvas(-0.12)}>-</button>
            <button type="button" onClick={resetCanvasView}>{Math.round(view.scale * 100)}%</button>
            <span>Wheel zoom / right-drag pan</span>
          </div>
          <div
            className="pattern-graph-layer"
            style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
          >
          <ConnectorLayer nodes={nodes} sources={sources} connectedMapIds={connectedMapIds} />

          <DraggableNode id="database" node={nodes.database} title="Image Database" type="database" onMove={moveNode} onResize={resizeNode}>
            <label className="node-upload">
              <input type="file" accept="image/*" multiple onChange={onSourceUpload} />
              <span>Open Image Set</span>
            </label>
            <div className="database-branch-list">
              {(sources.length ? sources : existingPatterns.slice(0, 6)).map((source, index) => (
                <button
                  key={source.id}
                  type="button"
                  className={source.id === activeSourceId ? "active" : ""}
                  onClick={() => (source.maps ? activateSource(source) : loadSource(source.url, source.label))}
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  {source.url ? <img src={source.url} alt={source.label} /> : null}
                  <b>{source.label}</b>
                </button>
              ))}
            </div>
          </DraggableNode>

          {sources.filter((source) => nodes[`source-${source.id}`]).map((source) => (
            <DraggableNode
              key={`source-${source.id}`}
              id={`source-${source.id}`}
              node={nodes[`source-${source.id}`]}
              title={`Source ${sources.findIndex((item) => item.id === source.id) + 1}`}
              type="source branch-source"
              onMove={moveNode}
              onResize={resizeNode}
            >
              <img className="node-preview-img" src={source.url} alt={source.label} />
              <p className="node-caption">{source.label}</p>
              {source.analysis ? (
                <div className="source-analysis-card">
                  <div className="source-palette-strip">
                    {source.analysis.palette.map((color) => <span key={color} style={{ background: color }} />)}
                  </div>
                  <div className="source-analysis-grid">
                    <span>Edge {(source.analysis.edgeDensity * 100).toFixed(0)}%</span>
                    <span>Contrast {(source.analysis.contrast * 100).toFixed(0)}%</span>
                    <span>{source.analysis.direction}</span>
                  </div>
                  <div className="source-tag-row">
                    {source.analysis.tags.map((tag) => <em key={tag}>{tag}</em>)}
                  </div>
                </div>
              ) : null}
            </DraggableNode>
          ))}

          {sources.filter((source) => nodes[`maps-${source.id}`]).map((source) => (
            <DraggableNode
              key={`maps-${source.id}`}
              id={`maps-${source.id}`}
              node={nodes[`maps-${source.id}`]}
              title={`Extracted Maps ${sources.findIndex((item) => item.id === source.id) + 1}`}
              type="maps branch-maps"
              onMove={moveNode}
              onResize={resizeNode}
            >
              <div className="node-map-grid">
                {source.maps.map((map) => {
                  const id = connectionId(source.id, map.key);
                  return (
                    <figure key={map.key}>
                      <button type="button" className="map-tile-preview" onClick={() => setInspectedMap({ ...map, sourceId: source.id })}>
                        <img src={map.url} alt={map.label} />
                      </button>
                      <figcaption>
                        <span>{map.label}</span>
                        <button
                          type="button"
                          className={connectedMapIds.includes(id) ? "wire-port connected" : "wire-port"}
                          onClick={() => toggleMapConnection(source.id, map.key)}
                          title={connectedMapIds.includes(id) ? "Disconnect from Hybrid Builder" : "Connect to Hybrid Builder"}
                        />
                      </figcaption>
                    </figure>
                  );
                })}
              </div>
            </DraggableNode>
          ))}

          <DraggableNode id="blend" node={nodes.blend} title="Hybrid Map Builder" type="tool blend-builder" onMove={moveNode} onResize={resizeNode}>
            <div className="node-control-list">
              <p className="node-help">Connect sockets from one or more extracted maps. This panel creates a new hybrid map used by the UV Matrix.</p>
              <div className="blend-input-stack">
                {connectedMaps.length ? connectedMaps.map((map) => (
                    <button key={`${map.sourceId}-${map.key}`} type="button" onClick={() => toggleMapConnection(map.sourceId, map.key)}>
                      <img src={map.url} alt={map.label} />
                      <span>{map.sourceLabel} / {map.label}</span>
                      <em>disconnect</em>
                    </button>
                )) : <div className="node-empty small">Connect map sockets</div>}
              </div>
              {hybridMap ? <img className="hybrid-map-preview" src={hybridMap.url} alt={hybridMap.label} /> : null}
            </div>
          </DraggableNode>

          <DraggableNode id="branch" node={nodes.branch} title="Branch Mixer" type="tool" onMove={moveNode} onResize={resizeNode}>
            <div className="node-control-list">
              <p className="node-help">Connected map tiles are blended into the UV generations. Disconnect a tile by clicking its socket.</p>
              <button type="button" className="tool-reset-btn" onClick={resetBranchMixer}>Reset Mixer Defaults</button>
              <div className="connected-map-list">
                {connectedMaps.length ? connectedMaps.map((map) => (
                  <button key={`${map.sourceId}-${map.key}`} type="button" onClick={() => toggleMapConnection(map.sourceId, map.key)}>
                    {map.label} x
                  </button>
                )) : <span>No connected maps</span>}
              </div>
              <label>
                Projection
                <select value={projectionType} onChange={(e) => setProjectionType(e.target.value)}>
                  <option>Box / Rhino friendly</option>
                  <option>Planar tile</option>
                  <option>Cylindrical wrap</option>
                  <option>Triplanar preview</option>
                </select>
              </label>
              <label>
                Blend Mode
                <select value={options.blendMode} onChange={(e) => updateOption("blendMode", e.target.value)}>
                  <option value="multiply">Multiply</option>
                  <option value="screen">Screen</option>
                  <option value="overlay">Overlay</option>
                  <option value="difference">Difference</option>
                  <option value="source-over">Normal</option>
                </select>
              </label>
              <label>
                Scale {options.scale.toFixed(2)}
                <input type="range" min="0.65" max="1.8" step="0.05" value={options.scale} onChange={(e) => updateOption("scale", Number(e.target.value))} />
              </label>
              <label>
                Rotation {options.rotation} deg
                <input type="range" min="-90" max="90" step="3" value={options.rotation} onChange={(e) => updateOption("rotation", Number(e.target.value))} />
              </label>
              <label>
                Threshold {options.threshold}
                <input type="range" min="10" max="220" step="5" value={options.threshold} onChange={(e) => updateOption("threshold", Number(e.target.value))} />
              </label>
              <label>
                Height Power {options.heightPower.toFixed(2)}
                <input type="range" min="0.55" max="2.8" step="0.05" value={options.heightPower} onChange={(e) => updateOption("heightPower", Number(e.target.value))} />
              </label>
              <label>
                Material Zones {options.zoneCount}
                <input type="range" min="3" max="6" step="1" value={options.zoneCount} onChange={(e) => updateOption("zoneCount", Number(e.target.value))} />
              </label>
            </div>
          </DraggableNode>

          <DraggableNode id="print" node={nodes.print} title="Print Composer" type="tool print-composer" onMove={moveNode} onResize={resizeNode}>
            <div className="node-control-list">
              <p className="node-help">Build 2D print/collage outputs from the active hybrid map. This path is independent of the 3D mesh output.</p>
              <button type="button" className="tool-reset-btn" onClick={resetPrintComposer}>Reset Print Defaults</button>
              <label>
                Graphic Method
                <select value={printOptions.method} onChange={(e) => updatePrintOption("method", e.target.value)}>
                  <option>layered collage</option>
                  <option>line field</option>
                  <option>dot matrix</option>
                  <option>strip collage</option>
                  <option>weave</option>
                </select>
              </label>
              <label>
                Palette
                <select value={printOptions.palette} onChange={(e) => updatePrintOption("palette", e.target.value)}>
                  <option value="atlas">Atlas color</option>
                  <option value="circuit">Circuit red/cyan</option>
                  <option value="pastel">Pastel architectural</option>
                  <option value="mono">Monochrome</option>
                </select>
              </label>
              <label>
                Line Spacing {printOptions.lineSpacing}
                <input type="range" min="5" max="38" step="1" value={printOptions.lineSpacing} onChange={(e) => updatePrintOption("lineSpacing", Number(e.target.value))} />
              </label>
              <label>
                Dot Spacing {printOptions.dotSpacing}
                <input type="range" min="6" max="42" step="1" value={printOptions.dotSpacing} onChange={(e) => updatePrintOption("dotSpacing", Number(e.target.value))} />
              </label>
              <label>
                Strip Count {printOptions.stripCount}
                <input type="range" min="8" max="72" step="1" value={printOptions.stripCount} onChange={(e) => updatePrintOption("stripCount", Number(e.target.value))} />
              </label>
              <label>
                Rotation {printOptions.rotation} deg
                <input type="range" min="-90" max="90" step="3" value={printOptions.rotation} onChange={(e) => updatePrintOption("rotation", Number(e.target.value))} />
              </label>
              <label>
                Edge Overlay {printOptions.edgeOverlay.toFixed(2)}
                <input type="range" min="0" max="0.55" step="0.01" value={printOptions.edgeOverlay} onChange={(e) => updatePrintOption("edgeOverlay", Number(e.target.value))} />
              </label>
              <label className="map-edit-toggle">
                <input type="checkbox" checked={printOptions.contourOverlay} onChange={(e) => updatePrintOption("contourOverlay", e.target.checked)} />
                Vector contour overlay
              </label>
              <label>
                Contour Threshold {printOptions.contourThreshold.toFixed(2)}
                <input type="range" min="0.12" max="0.88" step="0.02" value={printOptions.contourThreshold} onChange={(e) => updatePrintOption("contourThreshold", Number(e.target.value))} />
              </label>
              <label>
                Contour Levels {printOptions.contourLevels}
                <input type="range" min="1" max="7" step="1" value={printOptions.contourLevels} onChange={(e) => updatePrintOption("contourLevels", Number(e.target.value))} />
              </label>
              <label className="map-edit-toggle">
                <input type="checkbox" checked={printOptions.darkGround} onChange={(e) => updatePrintOption("darkGround", e.target.checked)} />
                Dark ground
              </label>
              {selectedPrintOutput ? <img className="print-composer-preview" src={selectedPrintOutput.url} alt={selectedPrintOutput.label} /> : <div className="node-empty small">Connect maps to preview print output</div>}
            </div>
          </DraggableNode>

          <DraggableNode id="printMatrix" node={nodes.printMatrix} title="Print Matrix" type="matrix print-matrix" onMove={moveNode} onResize={resizeNode}>
            <p className="node-help matrix-help">Printable 2D generations for posters, collages, and plotter-style artwork.</p>
            <div className="uv-matrix-grid">
              {printVariants.map((variant, index) => (
                <button
                  key={variant.id}
                  type="button"
                  className={index === selectedPrint ? "active" : ""}
                  onClick={() => setSelectedPrint(index)}
                >
                  <img src={variant.url} alt={variant.label} />
                  <span>{variant.label}</span>
                </button>
              ))}
            </div>
          </DraggableNode>

          <DraggableNode id="printExport" node={nodes.printExport} title="Print Export" type="export print-export" onMove={moveNode} onResize={resizeNode}>
            <div className="export-card-preview">
              {selectedPrintOutput ? <img src={selectedPrintOutput.url} alt={selectedPrintOutput.label} /> : null}
              <div>
                <strong>{selectedPrintOutput?.label || "No print generation"}</strong>
                <span>{selectedPrintOutput?.recipe || "Select a print matrix output"}</span>
              </div>
            </div>
            <div className="node-actions">
              <button type="button" onClick={exportPrintPng} disabled={!selectedPrintOutput}>Export Print PNG</button>
              <button type="button" onClick={exportPrintSvgOutput} disabled={!selectedPrintOutput}>Export Plotter SVG</button>
            </div>
          </DraggableNode>

          <DraggableNode id="matrix" node={nodes.matrix} title="UV Matrix" type="matrix" onMove={moveNode} onResize={resizeNode}>
            <p className="node-help matrix-help">Each tile is a possible UV/heightmap generation from the active connected maps plus mixer settings.</p>
            <div className="uv-matrix-grid">
              {variants.map((variant, index) => (
                <button
                  key={variant.id}
                  type="button"
                  className={index === selectedVariant ? "active" : ""}
                  onClick={() => setSelectedVariant(index)}
                >
                  <img src={variant.url} alt={variant.label} />
                  <span>{variant.label}</span>
                </button>
              ))}
            </div>
          </DraggableNode>

          <DraggableNode id="mesh" node={nodes.mesh} title="OBJ Mesh Preview" type="mesh" onMove={moveNode} onResize={resizeNode}>
            <label className="node-upload">
              <input type="file" accept=".obj" onChange={onObjUpload} />
              <span>Import OBJ</span>
            </label>
            <div className="mesh-preview-controls">
              {selected ? (
                <div className="mesh-active-map">
                  <img src={selected.url} alt={selected.label} />
                  <span>Active UV matrix<br /><b>{selected.label}</b></span>
                </div>
              ) : null}
              <label>
                Mesh View
                <select value={meshOptions.viewMode} onChange={(e) => updateMeshOption("viewMode", e.target.value)}>
                  <option value="solid">Solid geometry</option>
                  <option value="texture">UV matrix material</option>
                  <option value="relief">UV matrix displacement</option>
                  <option value="reliefPlane">Dense relief plane</option>
                  <option value="normal">Normal debug</option>
                  <option value="wire">Wireframe debug</option>
                </select>
              </label>
              <label>
                UV Projection
                <select value={meshOptions.uvProjection} onChange={(e) => updateMeshOption("uvProjection", e.target.value)}>
                  <option value="auto">Auto / generated projection</option>
                  <option value="existing">Existing OBJ UVs</option>
                  <option value="xy">Planar XY</option>
                  <option value="xz">Planar XZ</option>
                  <option value="yz">Planar YZ</option>
                </select>
              </label>
              <label>
                Mesh Prep
                <select value={meshOptions.prepMode} onChange={(e) => updateMeshOption("prepMode", e.target.value)}>
                  <option value="raw">Raw OBJ</option>
                  <option value="clean">Clean / weld</option>
                  <option value="remesh">Remesh / smooth</option>
                </select>
              </label>
            </div>
            <MeshPreview objUrl={objUrl} textureUrl={selected?.url} displacement={options.displacement} meshOptions={meshOptions} />
            <label className="mesh-displace-control">
              UV Scale {meshOptions.textureScale.toFixed(2)}
              <input type="range" min="0.25" max="4" step="0.05" value={meshOptions.textureScale} onChange={(e) => updateMeshOption("textureScale", Number(e.target.value))} />
            </label>
            <label className="mesh-displace-control">
              UV Rotation {meshOptions.textureRotation} deg
              <input type="range" min="-180" max="180" step="5" value={meshOptions.textureRotation} onChange={(e) => updateMeshOption("textureRotation", Number(e.target.value))} />
            </label>
            <label className="mesh-displace-control">
              Bump Strength {meshOptions.bumpStrength.toFixed(2)}
              <input type="range" min="0" max="1.2" step="0.05" value={meshOptions.bumpStrength} onChange={(e) => updateMeshOption("bumpStrength", Number(e.target.value))} />
            </label>
            <label className="mesh-displace-control">
              Height Source
              <select value={meshOptions.heightSource} onChange={(e) => updateMeshOption("heightSource", e.target.value)}>
                <option value="luminance">Light / dark luminance</option>
                <option value="red">Red channel</option>
                <option value="green">Green channel</option>
                <option value="blue">Blue channel</option>
                <option value="saturation">Color saturation</option>
                <option value="targetColor">Selected color range</option>
              </select>
            </label>
            <label className="mesh-displace-control">
              Dark Cutoff {meshOptions.heightLow.toFixed(2)}
              <input type="range" min="0" max="0.95" step="0.01" value={meshOptions.heightLow} onChange={(e) => updateMeshOption("heightLow", Number(e.target.value))} />
            </label>
            <label className="mesh-displace-control">
              Light Cutoff {meshOptions.heightHigh.toFixed(2)}
              <input type="range" min="0.05" max="1" step="0.01" value={meshOptions.heightHigh} onChange={(e) => updateMeshOption("heightHigh", Number(e.target.value))} />
            </label>
            <label className="mesh-displace-control">
              Height Gamma {meshOptions.heightGamma.toFixed(2)}
              <input type="range" min="0.2" max="3" step="0.05" value={meshOptions.heightGamma} onChange={(e) => updateMeshOption("heightGamma", Number(e.target.value))} />
            </label>
            <label className="mesh-displace-control">
              Target Color
              <input type="color" value={meshOptions.heightColor} onChange={(e) => updateMeshOption("heightColor", e.target.value)} />
            </label>
            <label className="mesh-displace-control">
              Color Tolerance {meshOptions.heightColorTolerance.toFixed(2)}
              <input type="range" min="0.05" max="1" step="0.01" value={meshOptions.heightColorTolerance} onChange={(e) => updateMeshOption("heightColorTolerance", Number(e.target.value))} />
            </label>
            <label className="mesh-displace-control mesh-check-control">
              <input type="checkbox" checked={meshOptions.heightInvert} onChange={(e) => updateMeshOption("heightInvert", e.target.checked)} />
              Invert height
            </label>
            <label className="mesh-displace-control">
              Subdivision {meshOptions.subdivision}
              <input type="range" min="0" max="3" step="1" value={meshOptions.subdivision} onChange={(e) => updateMeshOption("subdivision", Number(e.target.value))} />
            </label>
            <label className="mesh-displace-control">
              Smooth Iterations {meshOptions.smoothIterations}
              <input type="range" min="0" max="10" step="1" value={meshOptions.smoothIterations} onChange={(e) => updateMeshOption("smoothIterations", Number(e.target.value))} />
            </label>
            <label className="mesh-displace-control">
              Smooth Strength {meshOptions.smoothStrength.toFixed(2)}
              <input type="range" min="0" max="0.85" step="0.05" value={meshOptions.smoothStrength} onChange={(e) => updateMeshOption("smoothStrength", Number(e.target.value))} />
            </label>
            <label className="mesh-displace-control mesh-check-control">
              <input type="checkbox" checked={meshOptions.smoothShading} onChange={(e) => updateMeshOption("smoothShading", e.target.checked)} />
              Smooth shading
            </label>
            <label className="mesh-displace-control mesh-check-control">
              <input type="checkbox" checked={meshOptions.showEdges} onChange={(e) => updateMeshOption("showEdges", e.target.checked)} />
              Edge overlay
            </label>
            <label className="mesh-displace-control">
              Displacement {options.displacement.toFixed(2)}
              <input type="range" min="0" max="1.1" step="0.02" value={options.displacement} onChange={(e) => updateOption("displacement", Number(e.target.value))} />
            </label>
          </DraggableNode>

          <DraggableNode id="export" node={nodes.export} title="Rhino Export" type="export" onMove={moveNode} onResize={resizeNode}>
            <div className="export-card-preview">
              {selected ? <img src={selected.url} alt={selected.label} /> : null}
              <div>
                <strong>{selected?.label || "No generation"}</strong>
                <span>{selected?.recipe || "Select a matrix output"}</span>
              </div>
            </div>
            <div className="node-actions">
              <button type="button" onClick={exportSelectedPng} disabled={!selected}>Export UV PNG</button>
              <button type="button" onClick={exportReliefObj} disabled={!selected}>Export Relief OBJ</button>
              <button type="button" onClick={exportRecipe}>Recipe JSON</button>
              <button type="button" onClick={() => recipeInputRef.current?.click()}>Load Recipe</button>
              <input ref={recipeInputRef} className="hidden-file-input" type="file" accept="application/json,.json" onChange={importRecipe} />
            </div>
          </DraggableNode>
          </div>
          </>) : null}
        </div>
      </section>
      {inspectedMap ? (
        <div className="map-inspector-backdrop" onClick={() => setInspectedMap(null)}>
          <section className="map-inspector-modal" onClick={(event) => event.stopPropagation()}>
            <header>
              <h3>{inspectedMap.label}</h3>
              <button type="button" onClick={() => setInspectedMap(null)}>Close</button>
            </header>
            <img src={inspectedMap.url} alt={inspectedMap.label} />
            <div className="selected-map-editor">
              <label>
                Resolution {inspectedMap.edit?.pixelSize || 1}
                <input
                  type="range"
                  min="1"
                  max="32"
                  step="1"
                  value={inspectedMap.edit?.pixelSize || 1}
                  onChange={(e) => updateSingleMapEdit(inspectedMap.sourceId || activeSourceId, inspectedMap.key, "pixelSize", Number(e.target.value))}
                />
              </label>
              <label>
                Zones {inspectedMap.edit?.zones || 6}
                <input
                  type="range"
                  min="2"
                  max="6"
                  step="1"
                  value={inspectedMap.edit?.zones || 6}
                  onChange={(e) => updateSingleMapEdit(inspectedMap.sourceId || activeSourceId, inspectedMap.key, "zones", Number(e.target.value))}
                />
              </label>
              <label>
                Threshold {inspectedMap.edit?.threshold || 0}
                <input
                  type="range"
                  min="0"
                  max="220"
                  step="5"
                  value={inspectedMap.edit?.threshold || 0}
                  onChange={(e) => updateSingleMapEdit(inspectedMap.sourceId || activeSourceId, inspectedMap.key, "threshold", Number(e.target.value))}
                />
              </label>
              <label>
                Contrast {(inspectedMap.edit?.contrast || 1).toFixed(2)}
                <input
                  type="range"
                  min="0.5"
                  max="2.6"
                  step="0.05"
                  value={inspectedMap.edit?.contrast || 1}
                  onChange={(e) => updateSingleMapEdit(inspectedMap.sourceId || activeSourceId, inspectedMap.key, "contrast", Number(e.target.value))}
                />
              </label>
              <label>
                Blur {inspectedMap.edit?.blur || 0}px
                <input
                  type="range"
                  min="0"
                  max="8"
                  step="0.5"
                  value={inspectedMap.edit?.blur || 0}
                  onChange={(e) => updateSingleMapEdit(inspectedMap.sourceId || activeSourceId, inspectedMap.key, "blur", Number(e.target.value))}
                />
              </label>
              <label className="map-edit-toggle">
                <input
                  type="checkbox"
                  checked={Boolean(inspectedMap.edit?.smooth)}
                  onChange={(e) => updateSingleMapEdit(inspectedMap.sourceId || activeSourceId, inspectedMap.key, "smooth", e.target.checked)}
                />
                Smooth before pixelating
              </label>
              <label className="map-edit-toggle">
                <input
                  type="checkbox"
                  checked={Boolean(inspectedMap.edit?.invert)}
                  onChange={(e) => updateSingleMapEdit(inspectedMap.sourceId || activeSourceId, inspectedMap.key, "invert", e.target.checked)}
                />
                Invert map values
              </label>
              <button
                type="button"
                className="tool-reset-btn"
                onClick={() => resetSingleMapEdit(inspectedMap.sourceId || activeSourceId, inspectedMap.key)}
              >
                Reset Map Defaults
              </button>
            </div>
            <div className="node-actions">
              <button type="button" onClick={() => toggleMapConnection(inspectedMap.sourceId || activeSourceId, inspectedMap.key)}>
                {connectedMapIds.includes(connectionId(inspectedMap.sourceId || activeSourceId, inspectedMap.key)) ? "Disconnect from Hybrid Builder" : "Connect to Hybrid Builder"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
