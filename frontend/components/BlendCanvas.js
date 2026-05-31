import { useEffect, useMemo, useRef, useState } from "react";
import { blendFeatures, extractFeatureChannels } from "../lib/featureBlendUtils";
import { createMaskCanvas, invertMask, clearMask, paintMask, polygonMask, rectMask } from "../lib/maskUtils";
import { blendImageData, imageDataFromImage, maskFromAlpha } from "../lib/regionBlendUtils";
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

export default function BlendCanvas({
  sourceA,
  sourceB,
  selectionTool,
  selectionTarget,
  feather,
  blendMode,
  opacity,
  roleAssignment,
  featureWeights,
  transform,
  onHybridReady,
  clearTick,
  invertTick,
  polygonUndoTick,
  polygonCloseTick,
}) {
  const canvasRef = useRef(null);
  const maskARef = useRef(null);
  const maskBRef = useRef(null);
  const imgARef = useRef(null);
  const imgBRef = useRef(null);

  const [isDown, setIsDown] = useState(false);
  const [pointsA, setPointsA] = useState([]);
  const [pointsB, setPointsB] = useState([]);
  const [start, setStart] = useState(null);
  const [dragNodeIdx, setDragNodeIdx] = useState(-1);
  const [hoverNodeIdx, setHoverNodeIdx] = useState(-1);

  const points = selectionTarget === "A" ? pointsA : pointsB;
  const setPoints = selectionTarget === "A" ? setPointsA : setPointsB;
  const activeMaskRef = selectionTarget === "A" ? maskARef : maskBRef;

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
    const baseA = imageDataFromImage(imgARef.current, W, H);
    const baseB = imageDataFromImage(imgBRef.current, W, H);

    const maskA = maskFromAlpha(maskARef.current);
    const maskB = maskFromAlpha(maskBRef.current);

    const regionA = applyMaskToImageData(baseA, maskA);
    const regionBRaw = applyMaskToImageData(baseB, maskB);
    const regionB = transformRegionImageData(regionBRaw, transform);

    const isFeatureMode = ["edge-transfer", "density-transfer", "contour fusion", "pattern crossbreed", "field merge", "palette transfer"].includes(blendMode);
    const blendedRegion = isFeatureMode
      ? blendFeatures(extractFeatureChannels(regionA), extractFeatureChannels(regionB), roleAssignment, featureWeights)
      : blendImageData(regionA, regionB, mergeMasks(maskA, maskB), blendMode, opacity);

    const finalOut = cloneImageData(baseA);
    const unionMask = mergeMasks(maskA, maskB);
    for (let i = 0; i < finalOut.data.length; i += 4) {
      if (unionMask.data[i] > 0) {
        finalOut.data[i] = blendedRegion.data[i];
        finalOut.data[i + 1] = blendedRegion.data[i + 1];
        finalOut.data[i + 2] = blendedRegion.data[i + 2];
        finalOut.data[i + 3] = 255;
      }
    }

    const abstracted = applyAbstraction(finalOut, "Projection Texture");
    const ctx = canvasRef.current.getContext("2d");
    ctx.putImageData(abstracted, 0, 0);
    ctx.globalAlpha = 0.24;
    ctx.drawImage(maskARef.current, 0, 0);
    ctx.globalAlpha = 0.2;
    ctx.drawImage(maskBRef.current, 0, 0);
    ctx.globalAlpha = 1;
    drawPolygonOverlay(ctx, pointsA, "rgba(10,132,255,0.95)");
    drawPolygonOverlay(ctx, pointsB, "rgba(255,120,20,0.95)");

    onHybridReady?.({ imageData: finalOut, preview: canvasRef.current.toDataURL("image/png", 0.95) });
  };

  useEffect(() => {
    let cancelled = false;
    if (!sourceA?.url || !sourceB?.url) return;
    Promise.all([loadImage(sourceA.url), loadImage(sourceB.url)]).then(([a, b]) => {
      if (cancelled) return;
      imgARef.current = a;
      imgBRef.current = b;
      rebuild();
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [sourceA?.url, sourceB?.url]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    rebuild();
  }, [blendMode, opacity, feather, transform, roleAssignment, featureWeights, pointsA, pointsB, hoverNodeIdx, selectionTarget]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!activeMaskRef.current) return;
    clearMask(activeMaskRef.current);
    if (selectionTarget === "A") setPointsA([]);
    else setPointsB([]);
    rebuild();
  }, [clearTick]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!activeMaskRef.current) return;
    invertMask(activeMaskRef.current);
    rebuild();
  }, [invertTick]); // eslint-disable-line react-hooks/exhaustive-deps

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

  useEffect(() => {
    if (!activeMaskRef.current || points.length < 3) return;
    polygonMask(activeMaskRef.current, points);
    rebuild();
  }, [polygonCloseTick]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (selectionTool === "polygon" && nodeIdx !== -1) {
      setDragNodeIdx(nodeIdx);
      setIsDown(true);
      return;
    }

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
    if (selectionTool === "polygon") {
      setPoints((prev) => [...prev, p]);
      return;
    }
    if (selectionTool === "brush mask") paintMask(activeMaskRef.current, [p], 18, false, feather);
    if (selectionTool === "erase mask") paintMask(activeMaskRef.current, [p], 18, true, feather);
    if (selectionTool === "lasso") setPoints([p]);
    rebuild();
  };

  const onMove = (event) => {
    if (!activeMaskRef.current) return;
    const p = toPoint(event);
    setHoverNodeIdx(hitNode(p));
    if (!isDown) return;

    if (selectionTool === "polygon" && dragNodeIdx !== -1) {
      setPoints((prev) => prev.map((pt, idx) => (idx === dragNodeIdx ? p : pt)));
      return;
    }

    if (selectionTool === "brush mask") paintMask(activeMaskRef.current, [p], 18, false, feather);
    if (selectionTool === "erase mask") paintMask(activeMaskRef.current, [p], 18, true, feather);
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
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        onMouseDown={onDown}
        onMouseMove={onMove}
        onMouseUp={onUp}
        onMouseLeave={() => { setIsDown(false); setDragNodeIdx(-1); }}
      />
      <div className="card-actions">
        <button type="button" onClick={() => { if (activeMaskRef.current) { clearMask(activeMaskRef.current); setPoints([]); rebuild(); } }}>Clear active mask</button>
        <button type="button" onClick={() => { if (activeMaskRef.current) { invertMask(activeMaskRef.current); rebuild(); } }}>Invert active mask</button>
      </div>
    </div>
  );
}
