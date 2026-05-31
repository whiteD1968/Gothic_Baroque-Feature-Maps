import { useEffect, useMemo, useRef, useState } from "react";
import { blendFeatures, extractFeatureChannels } from "../lib/featureBlendUtils";
import { createMaskCanvas, invertMask, clearMask, paintMask, polygonMask, rectMask } from "../lib/maskUtils";
import { blendImageData, imageDataFromImageRegion, maskFromAlpha } from "../lib/regionBlendUtils";
import { applyAbstraction } from "../lib/hybridAbstractionUtils";

const W = 880;
const H = 600;
const HANDLE_RADIUS = 8;

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed loading ${url}`));
    img.src = url;
  });
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function pointToSegmentDistance(p, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = p.x - a.x;
  const apy = p.y - a.y;
  const ab2 = abx * abx + aby * aby || 1;
  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / ab2));
  const proj = { x: a.x + abx * t, y: a.y + aby * t };
  return { d: dist(p, proj), proj };
}

function cloneImageData(imageData) {
  return new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
}

function applyMaskToImageData(imageData, maskData) {
  const out = cloneImageData(imageData);
  for (let i = 0; i < out.data.length; i += 4) {
    const m = maskData.data[i] / 255;
    out.data[i + 3] = Math.round(255 * m);
    if (m === 0) {
      out.data[i] = 0;
      out.data[i + 1] = 0;
      out.data[i + 2] = 0;
    }
  }
  return out;
}

function transformRegionImageData(regionData, transform) {
  const src = document.createElement("canvas");
  src.width = regionData.width;
  src.height = regionData.height;
  src.getContext("2d").putImageData(regionData, 0, 0);

  const out = document.createElement("canvas");
  out.width = regionData.width;
  out.height = regionData.height;
  const ctx = out.getContext("2d");
  ctx.clearRect(0, 0, out.width, out.height);
  ctx.translate(out.width / 2 + (transform.x || 0), out.height / 2 + (transform.y || 0));
  ctx.rotate(((transform.rotation || 0) * Math.PI) / 180);
  const s = transform.scale || 1;
  ctx.scale(s, s);
  ctx.translate(-out.width / 2, -out.height / 2);
  ctx.drawImage(src, 0, 0);
  return ctx.getImageData(0, 0, out.width, out.height);
}

function maskCount(maskData) {
  let n = 0;
  for (let i = 0; i < maskData.data.length; i += 4) if (maskData.data[i] > 0) n += 1;
  return n;
}

function applyMaskedPatch(base, patch, mask) {
  const out = cloneImageData(base);
  for (let i = 0; i < out.data.length; i += 4) {
    const m = mask.data[i] / 255;
    if (m <= 0) continue;
    out.data[i] = patch.data[i];
    out.data[i + 1] = patch.data[i + 1];
    out.data[i + 2] = patch.data[i + 2];
    out.data[i + 3] = 255;
  }
  return out;
}

function mergeMasks(maskA, maskB) {
  const out = new ImageData(maskA.width, maskA.height);
  for (let i = 0; i < out.data.length; i += 4) {
    const v = Math.max(maskA.data[i], maskB.data[i]);
    out.data[i] = v;
    out.data[i + 1] = v;
    out.data[i + 2] = v;
    out.data[i + 3] = 255;
  }
  return out;
}

function hexToRgb(hex) {
  const cleaned = String(hex || "").replace("#", "");
  if (cleaned.length !== 6) return [255, 255, 255];
  const v = parseInt(cleaned, 16);
  if (Number.isNaN(v)) return [255, 255, 255];
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

export default function BlendCanvas({
  sourceA,
  sourceB,
  sourceCropA,
  sourceCropB,
  selectionTool,
  selectionTarget,
  feather,
  brushSize,
  eraseTransparency,
  blendMode,
  opacity,
  roleAssignment,
  featureWeights,
  transform,
  regionFx,
  onHybridReady,
  clearTick,
  invertTick,
  polygonUndoTick,
  polygonCloseTick,
  applyTick,
  deselectTick,
  deleteTick,
  abstractionMode,
  undoTick,
  redoTick,
  resetTick,
}) {
  const canvasRef = useRef(null);
  const maskARef = useRef(null);
  const maskBRef = useRef(null);
  const imgARef = useRef(null);
  const imgBRef = useRef(null);
  const workingBaseRef = useRef(null);
  const lastPreviewRef = useRef(null);
  const historyRef = useRef([]);
  const redoRef = useRef([]);

  const [isDown, setIsDown] = useState(false);
  const [pointsA, setPointsA] = useState([]);
  const [pointsB, setPointsB] = useState([]);
  const [start, setStart] = useState(null);
  const [dragNodeIdx, setDragNodeIdx] = useState(-1);
  const [hoverNodeIdx, setHoverNodeIdx] = useState(-1);
  const [cursorUi, setCursorUi] = useState({ x: 16, y: 16, visible: false });

  const points = selectionTarget === "A" ? pointsA : pointsB;
  const setPoints = selectionTarget === "A" ? setPointsA : setPointsB;
  const activeMaskRef = selectionTarget === "A" ? maskARef : maskBRef;

  const applyRegionFx = (regionData, fx) => {
    const safeFx = fx || { blur: 0, pixelate: 1, glitch: 0, smudge: 0, gloom: 0, fragmentJitter: 0, colorMode: "preserve", colorShift: 0 };
    const canvas = document.createElement("canvas");
    canvas.width = regionData.width;
    canvas.height = regionData.height;
    const ctx = canvas.getContext("2d");
    ctx.putImageData(regionData, 0, 0);

    if (safeFx.blur > 0.01) {
      const temp = document.createElement("canvas");
      temp.width = canvas.width;
      temp.height = canvas.height;
      const tctx = temp.getContext("2d");
      tctx.filter = `blur(${safeFx.blur}px)`;
      tctx.drawImage(canvas, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(temp, 0, 0);
    }

    if (safeFx.pixelate > 1) {
      const step = Math.max(1, Math.floor(safeFx.pixelate));
      const small = document.createElement("canvas");
      small.width = Math.max(1, Math.floor(canvas.width / step));
      small.height = Math.max(1, Math.floor(canvas.height / step));
      const sctx = small.getContext("2d");
      sctx.imageSmoothingEnabled = false;
      sctx.drawImage(canvas, 0, 0, small.width, small.height);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(small, 0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = true;
    }

    if (safeFx.glitch > 0.01) {
      const temp = document.createElement("canvas");
      temp.width = canvas.width;
      temp.height = canvas.height;
      temp.getContext("2d").drawImage(canvas, 0, 0);
      const bands = Math.floor(12 + safeFx.glitch * 45);
      for (let i = 0; i < bands; i += 1) {
        const y = Math.floor(Math.random() * canvas.height);
        const h = Math.max(1, Math.floor(2 + Math.random() * 12));
        const shift = Math.floor((Math.random() - 0.5) * safeFx.glitch * 90);
        ctx.drawImage(temp, 0, y, canvas.width, h, shift, y, canvas.width, h);
      }
    }

    if (safeFx.smudge > 0.01) {
      const passes = Math.floor(2 + safeFx.smudge * 10);
      for (let i = 0; i < passes; i += 1) {
        const offX = Math.floor((Math.random() - 0.5) * safeFx.smudge * 22);
        const offY = Math.floor((Math.random() - 0.5) * safeFx.smudge * 12);
        ctx.globalAlpha = 0.08 + safeFx.smudge * 0.12;
        ctx.drawImage(canvas, offX, offY);
      }
      ctx.globalAlpha = 1;
    }

    if (safeFx.fragmentJitter > 0.01) {
      const temp = document.createElement("canvas");
      temp.width = canvas.width;
      temp.height = canvas.height;
      temp.getContext("2d").drawImage(canvas, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const tile = 20;
      for (let y = 0; y < canvas.height; y += tile) {
        for (let x = 0; x < canvas.width; x += tile) {
          const jx = Math.floor((Math.random() - 0.5) * safeFx.fragmentJitter * 38);
          const jy = Math.floor((Math.random() - 0.5) * safeFx.fragmentJitter * 38);
          ctx.drawImage(temp, x, y, tile, tile, x + jx, y + jy, tile, tile);
        }
      }
    }

    const out = ctx.getImageData(0, 0, canvas.width, canvas.height);

    if (safeFx.colorMode === "shift" && safeFx.colorShift > 0.01) {
      for (let i = 0; i < out.data.length; i += 4) {
        out.data[i] = Math.max(0, Math.min(255, out.data[i] + 70 * safeFx.colorShift));
        out.data[i + 1] = Math.max(0, Math.min(255, out.data[i + 1] - 20 * safeFx.colorShift));
        out.data[i + 2] = Math.max(0, Math.min(255, out.data[i + 2] + 55 * safeFx.colorShift));
      }
    }

    if (safeFx.colorMode === "gradient" && safeFx.colorShift > 0.01) {
      const stops = (safeFx.gradientStops || ["#ff8a00", "#ffd400", "#7ed321", "#35c759", "#0a84ff"]).map(hexToRgb);
      const lower = Math.max(0, Math.min(0.99, Number.isFinite(safeFx.gradientLower) ? safeFx.gradientLower : 0.1));
      const upper = Math.max(lower + 0.01, Math.min(1, Number.isFinite(safeFx.gradientUpper) ? safeFx.gradientUpper : 0.9));
      for (let i = 0; i < out.data.length; i += 4) {
        const g = (out.data[i] + out.data[i + 1] + out.data[i + 2]) / 3 / 255;
        const tNorm = Math.max(0, Math.min(1, (g - lower) / (upper - lower)));
        const p = tNorm * (stops.length - 1);
        const i0 = Math.floor(p);
        const i1 = Math.min(stops.length - 1, i0 + 1);
        const t = p - i0;
        const r = stops[i0][0] * (1 - t) + stops[i1][0] * t;
        const gg = stops[i0][1] * (1 - t) + stops[i1][1] * t;
        const b = stops[i0][2] * (1 - t) + stops[i1][2] * t;
        out.data[i] = Math.round(out.data[i] * (1 - safeFx.colorShift) + r * safeFx.colorShift);
        out.data[i + 1] = Math.round(out.data[i + 1] * (1 - safeFx.colorShift) + gg * safeFx.colorShift);
        out.data[i + 2] = Math.round(out.data[i + 2] * (1 - safeFx.colorShift) + b * safeFx.colorShift);
      }
    }

    if (safeFx.gloom > 0.01) {
      for (let i = 0; i < out.data.length; i += 4) {
        const lum = (out.data[i] + out.data[i + 1] + out.data[i + 2]) / 3;
        const d = 1 - safeFx.gloom * 0.72;
        const contrast = 1 + safeFx.gloom * 0.45;
        out.data[i] = Math.max(0, Math.min(255, ((out.data[i] - lum) * contrast + lum) * d));
        out.data[i + 1] = Math.max(0, Math.min(255, ((out.data[i + 1] - lum) * contrast + lum) * d));
        out.data[i + 2] = Math.max(0, Math.min(255, ((out.data[i + 2] - lum) * contrast + lum) * d));
      }
    }

    return out;
  };

  useEffect(() => {
    maskARef.current = createMaskCanvas(W, H);
    maskBRef.current = createMaskCanvas(W, H);
  }, []);

  const canBlend = useMemo(() => sourceA?.url && sourceB?.url, [sourceA, sourceB]);

  const toPoint = (event) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * W,
      y: ((event.clientY - rect.top) / rect.height) * H,
    };
  };

  const drawPolygonOverlay = (ctx, pts, color) => {
    if (!pts.length) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i].x, pts[i].y);
    if (pts.length > 2) ctx.lineTo(pts[0].x, pts[0].y);
    ctx.stroke();
    for (let i = 0; i < pts.length; i += 1) {
      const p = pts[i];
      ctx.fillStyle = i === hoverNodeIdx && selectionTarget === (color.includes("255,120") ? "B" : "A") ? "#fff" : color;
      ctx.strokeStyle = "rgba(15,35,65,0.9)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, HANDLE_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  };

  const rebuild = () => {
    if (!canBlend || !canvasRef.current || !maskARef.current || !maskBRef.current || !imgARef.current || !imgBRef.current) return;

    const sourceAImg = imageDataFromImageRegion(imgARef.current, sourceCropA, W, H);
    const sourceBImg = imageDataFromImageRegion(imgBRef.current, sourceCropB, W, H);
    if (!workingBaseRef.current) workingBaseRef.current = cloneImageData(sourceAImg);

    const base = cloneImageData(workingBaseRef.current);
    const maskA = maskFromAlpha(maskARef.current);
    const maskB = maskFromAlpha(maskBRef.current);
    const countA = maskCount(maskA);
    const countB = maskCount(maskB);

    let regionA = applyMaskToImageData(base, maskA);
    let regionB = applyMaskToImageData(sourceBImg, countB > 0 ? maskB : maskA);

    if (selectionTarget === "A") regionA = transformRegionImageData(regionA, transform);
    if (selectionTarget === "B") regionB = transformRegionImageData(regionB, transform);

    regionA = applyRegionFx(regionA, regionFx);
    regionB = applyRegionFx(regionB, regionFx);

    let patch = regionA;
    let patchMask = maskA;
    const bInfluence = regionFx?.sourceBInfluence ?? 0.55;
    const useSourceBPatch = Boolean(regionFx?.useSourceBPatch);

    if (countA > 0 && countB > 0) {
      const isFeatureMode = ["edge-transfer", "density-transfer", "contour fusion", "pattern crossbreed", "field merge", "palette transfer", "mj blend"].includes(blendMode);
      patch = isFeatureMode
        ? blendFeatures(extractFeatureChannels(regionA), extractFeatureChannels(regionB), roleAssignment, featureWeights)
        : blendImageData(regionA, regionB, mergeMasks(maskA, maskB), blendMode, opacity);
      patchMask = mergeMasks(maskA, maskB);
    } else if (countA > 0) {
      patch = useSourceBPatch
        ? blendImageData(regionA, regionB, maskA, blendMode, opacity * bInfluence)
        : regionA;
      patchMask = maskA;
    } else if (countB > 0) {
      patch = useSourceBPatch
        ? blendImageData(regionA, regionB, maskB, blendMode, opacity * bInfluence)
        : regionB;
      patchMask = maskB;
    }

    const preview = applyMaskedPatch(base, patch, patchMask);
    lastPreviewRef.current = preview;

    const abstracted = regionFx?.enableAbstractionPreview ? applyAbstraction(preview, abstractionMode) : preview;
    const ctx = canvasRef.current.getContext("2d");
    ctx.putImageData(abstracted, 0, 0);
    ctx.globalAlpha = 0.24;
    ctx.drawImage(maskARef.current, 0, 0);
    ctx.globalAlpha = 0.2;
    ctx.drawImage(maskBRef.current, 0, 0);
    ctx.globalAlpha = 1;
    drawPolygonOverlay(ctx, pointsA, "rgba(10,132,255,0.95)");
    drawPolygonOverlay(ctx, pointsB, "rgba(255,120,20,0.95)");

    onHybridReady?.({ imageData: preview, preview: canvasRef.current.toDataURL("image/png", 0.95) });
  };

  const pushHistory = () => {
    if (!workingBaseRef.current) return;
    historyRef.current = [...historyRef.current.slice(-19), cloneImageData(workingBaseRef.current)];
    redoRef.current = [];
  };

  const clearActiveSelection = () => {
    if (!activeMaskRef.current) return;
    clearMask(activeMaskRef.current);
    if (selectionTarget === "A") setPointsA([]);
    else setPointsB([]);
  };

  useEffect(() => {
    let cancelled = false;
    if (!sourceA?.url || !sourceB?.url) return;
    Promise.all([loadImage(sourceA.url), loadImage(sourceB.url)]).then(([a, b]) => {
      if (cancelled) return;
      imgARef.current = a;
      imgBRef.current = b;
      workingBaseRef.current = imageDataFromImageRegion(a, sourceCropA, W, H);
      historyRef.current = [];
      redoRef.current = [];
      clearMask(maskARef.current);
      clearMask(maskBRef.current);
      setPointsA([]);
      setPointsB([]);
      rebuild();
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [sourceA?.url, sourceB?.url, sourceCropA?.x, sourceCropA?.y, sourceCropA?.w, sourceCropA?.h, sourceCropB?.x, sourceCropB?.y, sourceCropB?.w, sourceCropB?.h]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    rebuild();
  }, [blendMode, opacity, feather, brushSize, transform, roleAssignment, featureWeights, pointsA, pointsB, hoverNodeIdx, selectionTarget, regionFx, abstractionMode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!maskARef.current || !maskBRef.current || selectionTool !== "polygon") return;
    if (selectionTarget === "A") {
      clearMask(maskARef.current);
      if (pointsA.length > 2) polygonMask(maskARef.current, pointsA);
    } else {
      clearMask(maskBRef.current);
      if (pointsB.length > 2) polygonMask(maskBRef.current, pointsB);
    }
    rebuild();
  }, [pointsA, pointsB, selectionTool, selectionTarget]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { clearActiveSelection(); rebuild(); }, [clearTick]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (activeMaskRef.current) { invertMask(activeMaskRef.current); rebuild(); } }, [invertTick]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!points.length) return;
    const next = points.slice(0, -1);
    setPoints(next);
    if (activeMaskRef.current) {
      clearMask(activeMaskRef.current);
      if (next.length > 2) polygonMask(activeMaskRef.current, next);
    }
    rebuild();
  }, [polygonUndoTick]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (activeMaskRef.current && points.length >= 3) { polygonMask(activeMaskRef.current, points); rebuild(); } }, [polygonCloseTick]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!lastPreviewRef.current) return;
    pushHistory();
    workingBaseRef.current = cloneImageData(lastPreviewRef.current);
    clearActiveSelection();
    setStart(null);
    setDragNodeIdx(-1);
    rebuild();
  }, [applyTick]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    clearActiveSelection();
    setStart(null);
    setDragNodeIdx(-1);
    rebuild();
  }, [deselectTick]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!workingBaseRef.current || !maskARef.current || !maskBRef.current) return;
    pushHistory();
    const base = cloneImageData(workingBaseRef.current);
    const sourceBImg = imgBRef.current ? imageDataFromImageRegion(imgBRef.current, sourceCropB, W, H) : base;
    const sourceAImg = imgARef.current ? imageDataFromImageRegion(imgARef.current, sourceCropA, W, H) : base;
    const maskToUse = selectionTarget === "A" ? maskARef.current : maskBRef.current;
    const m = maskFromAlpha(maskToUse);
    const fillFrom = selectionTarget === "A" ? sourceBImg : sourceAImg;
    for (let i = 0; i < base.data.length; i += 4) {
      const w = m.data[i] / 255;
      if (w <= 0) continue;
      base.data[i] = fillFrom.data[i];
      base.data[i + 1] = fillFrom.data[i + 1];
      base.data[i + 2] = fillFrom.data[i + 2];
      base.data[i + 3] = 255;
    }
    workingBaseRef.current = base;
    clearActiveSelection();
    rebuild();
  }, [deleteTick]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const prev = historyRef.current[historyRef.current.length - 1];
    if (!prev || !workingBaseRef.current) return;
    redoRef.current = [...redoRef.current.slice(-19), cloneImageData(workingBaseRef.current)];
    workingBaseRef.current = cloneImageData(prev);
    historyRef.current = historyRef.current.slice(0, -1);
    clearActiveSelection();
    setStart(null);
    setDragNodeIdx(-1);
    rebuild();
  }, [undoTick]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const next = redoRef.current[redoRef.current.length - 1];
    if (!next || !workingBaseRef.current) return;
    historyRef.current = [...historyRef.current.slice(-19), cloneImageData(workingBaseRef.current)];
    workingBaseRef.current = cloneImageData(next);
    redoRef.current = redoRef.current.slice(0, -1);
    clearActiveSelection();
    setStart(null);
    setDragNodeIdx(-1);
    rebuild();
  }, [redoTick]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!imgARef.current) return;
    workingBaseRef.current = imageDataFromImageRegion(imgARef.current, sourceCropA, W, H);
    historyRef.current = [];
    redoRef.current = [];
    clearMask(maskARef.current);
    clearMask(maskBRef.current);
    setPointsA([]);
    setPointsB([]);
    setStart(null);
    setDragNodeIdx(-1);
    rebuild();
  }, [resetTick]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKeyDown = (event) => {
      if (selectionTool !== "polygon") return;
      if (event.key === "Backspace") {
        event.preventDefault();
        if (!points.length) return;
        const next = points.slice(0, -1);
        setPoints(next);
        if (activeMaskRef.current) {
          clearMask(activeMaskRef.current);
          if (next.length > 2) polygonMask(activeMaskRef.current, next);
        }
        rebuild();
      }
      if (event.key === "Enter") {
        event.preventDefault();
        if (!activeMaskRef.current || points.length < 3) return;
        polygonMask(activeMaskRef.current, points);
        rebuild();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectionTool, points, selectionTarget]); // eslint-disable-line react-hooks/exhaustive-deps

  const hitNode = (p) => points.findIndex((n) => dist(n, p) <= HANDLE_RADIUS + 2);
  const hitSegment = (p) => {
    if (points.length < 2) return { idx: -1, proj: null, d: Infinity };
    let best = { idx: -1, proj: null, d: Infinity };
    for (let i = 0; i < points.length - 1; i += 1) {
      const res = pointToSegmentDistance(p, points[i], points[i + 1]);
      if (res.d < best.d) best = { idx: i, proj: res.proj, d: res.d };
    }
    if (points.length > 2) {
      const res = pointToSegmentDistance(p, points[points.length - 1], points[0]);
      if (res.d < best.d) best = { idx: points.length - 1, proj: res.proj, d: res.d };
    }
    return best;
  };

  const onDown = (event) => {
    if (!activeMaskRef.current) return;
    const p = toPoint(event);
    const nodeIdx = hitNode(p);
    if (selectionTool === "polygon" && nodeIdx !== -1) { setDragNodeIdx(nodeIdx); setIsDown(true); return; }

    if (selectionTool === "polygon" && points.length > 1) {
      const seg = hitSegment(p);
      if (seg.idx !== -1 && seg.d <= HANDLE_RADIUS + 4) {
        const insertAt = seg.idx === points.length - 1 ? points.length : seg.idx + 1;
        setPoints((prev) => [...prev.slice(0, insertAt), seg.proj, ...prev.slice(insertAt)]);
        return;
      }
    }

    setIsDown(true);
    setStart(p);
    if (selectionTool === "polygon") { setPoints((prev) => [...prev, p]); return; }
    if (selectionTool === "brush mask") paintMask(activeMaskRef.current, [p], brushSize / 2, false, feather);
    if (selectionTool === "erase mask") paintMask(activeMaskRef.current, [p], brushSize / 2, true, feather, eraseTransparency / 100);
    if (selectionTool === "lasso") setPoints([p]);
    rebuild();
  };

  const onMove = (event) => {
    if (!activeMaskRef.current) return;
    const p = toPoint(event);
    setCursorUi({
      x: event.nativeEvent.offsetX + 16,
      y: event.nativeEvent.offsetY - 16,
      visible: true,
    });
    setHoverNodeIdx(hitNode(p));
    if (!isDown) return;

    if (selectionTool === "polygon" && dragNodeIdx !== -1) {
      setPoints((prev) => prev.map((pt, idx) => (idx === dragNodeIdx ? p : pt)));
      return;
    }

    if (selectionTool === "brush mask") paintMask(activeMaskRef.current, [p], brushSize / 2, false, feather);
    if (selectionTool === "erase mask") paintMask(activeMaskRef.current, [p], brushSize / 2, true, feather, eraseTransparency / 100);
    if (selectionTool === "lasso") {
      setPoints((prev) => {
        const next = [...prev, p];
        polygonMask(activeMaskRef.current, next);
        return next;
      });
    }
    rebuild();
  };

  const onUp = (event) => {
    if (!activeMaskRef.current) return;
    const p = toPoint(event);
    setIsDown(false);
    setDragNodeIdx(-1);
    if (selectionTool === "rectangular" && start) rectMask(activeMaskRef.current, start, p);
    if (selectionTool === "lasso") setPoints([]);
    setStart(null);
    rebuild();
  };

  return (
    <div className="blend-canvas-wrap">
      <div
        className={`blend-target-badge ${cursorUi.visible ? "visible" : ""} ${selectionTarget === "A" ? "target-a" : "target-b"}`}
        style={{ left: cursorUi.x, top: cursorUi.y }}
      >
        {selectionTarget === "A" ? "Editing A" : "Editing B"}
      </div>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        onMouseDown={onDown}
        onMouseMove={onMove}
        onMouseUp={onUp}
        onMouseEnter={() => setCursorUi((prev) => ({ ...prev, visible: true }))}
        onMouseLeave={() => {
          setIsDown(false);
          setDragNodeIdx(-1);
          setCursorUi((prev) => ({ ...prev, visible: false }));
        }}
      />
      <div className="card-actions">
        <button type="button" onClick={() => { clearActiveSelection(); rebuild(); }}>Clear active mask</button>
        <button type="button" onClick={() => { if (activeMaskRef.current) { invertMask(activeMaskRef.current); rebuild(); } }}>Invert active mask</button>
      </div>
    </div>
  );
}
