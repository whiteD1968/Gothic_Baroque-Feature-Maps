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

export default function BlendCanvas({
  sourceA,
  sourceB,
  selectionTool,
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
  const maskRef = useRef(null);
  const imgARef = useRef(null);
  const imgBRef = useRef(null);
  const renderSeq = useRef(0);

  const [isDown, setIsDown] = useState(false);
  const [points, setPoints] = useState([]);
  const [start, setStart] = useState(null);
  const [dragNodeIdx, setDragNodeIdx] = useState(-1);
  const [hoverNodeIdx, setHoverNodeIdx] = useState(-1);

  useEffect(() => {
    maskRef.current = createMaskCanvas(W, H);
  }, []);

  const canBlend = useMemo(() => sourceA?.url && sourceB?.url, [sourceA, sourceB]);

  const toPoint = (event) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * W,
      y: ((event.clientY - rect.top) / rect.height) * H,
    };
  };

  const drawPolygonOverlay = (ctx) => {
    if (!points.length) return;
    ctx.save();
    ctx.strokeStyle = "rgba(10,132,255,0.95)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
    if (selectionTool === "polygon" && points.length > 2) ctx.lineTo(points[0].x, points[0].y);
    ctx.stroke();

    for (let i = 0; i < points.length; i += 1) {
      const p = points[i];
      ctx.fillStyle = i === hoverNodeIdx ? "rgba(255,255,255,1)" : "rgba(10,132,255,0.95)";
      ctx.strokeStyle = "rgba(15,35,65,0.9)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, HANDLE_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  };

  const rebuild = () => {
    if (!canBlend || !canvasRef.current || !maskRef.current || !imgARef.current || !imgBRef.current) return;
    const seq = ++renderSeq.current;

    const baseA = imageDataFromImage(imgARef.current, W, H);
    const baseB = imageDataFromImage(imgBRef.current, W, H, transform);
    const mask = maskFromAlpha(maskRef.current);

    const isFeatureMode = ["edge-transfer", "density-transfer", "contour fusion", "pattern crossbreed", "field merge", "palette transfer"].includes(blendMode);
    const blended = isFeatureMode
      ? blendFeatures(extractFeatureChannels(baseA), extractFeatureChannels(baseB), roleAssignment, featureWeights)
      : blendImageData(baseA, baseB, mask, blendMode, opacity);

    const abstracted = applyAbstraction(blended, "Projection Texture");

    if (seq !== renderSeq.current) return;
    const ctx = canvasRef.current.getContext("2d");
    ctx.putImageData(abstracted, 0, 0);
    ctx.globalAlpha = 0.36;
    ctx.drawImage(maskRef.current, 0, 0);
    ctx.globalAlpha = 1;
    drawPolygonOverlay(ctx);

    onHybridReady?.({ imageData: blended, preview: canvasRef.current.toDataURL("image/png", 0.95) });
  };

  useEffect(() => {
    let cancelled = false;
    if (!sourceA?.url || !sourceB?.url) {
      imgARef.current = null;
      imgBRef.current = null;
      return;
    }
    Promise.all([loadImage(sourceA.url), loadImage(sourceB.url)])
      .then(([a, b]) => {
        if (cancelled) return;
        imgARef.current = a;
        imgBRef.current = b;
        rebuild();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [sourceA?.url, sourceB?.url]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    rebuild();
  }, [blendMode, opacity, feather, transform, roleAssignment, featureWeights, points, hoverNodeIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!maskRef.current) return;
    clearMask(maskRef.current);
    setPoints([]);
    rebuild();
  }, [clearTick]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!maskRef.current) return;
    invertMask(maskRef.current);
    rebuild();
  }, [invertTick]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!points.length) return;
    const next = points.slice(0, -1);
    setPoints(next);
    if (maskRef.current) {
      clearMask(maskRef.current);
      if (next.length > 2) polygonMask(maskRef.current, next);
    }
    rebuild();
  }, [polygonUndoTick]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!maskRef.current || points.length < 3) return;
    polygonMask(maskRef.current, points);
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
        if (maskRef.current) {
          clearMask(maskRef.current);
          if (next.length > 2) polygonMask(maskRef.current, next);
        }
        rebuild();
      }
      if (event.key === "Enter") {
        event.preventDefault();
        if (!maskRef.current || points.length < 3) return;
        polygonMask(maskRef.current, points);
        rebuild();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectionTool, points]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (!maskRef.current) return;
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
    setPoints([p]);
    if (selectionTool === "brush mask") paintMask(maskRef.current, [p], 18, false, feather);
    if (selectionTool === "erase mask") paintMask(maskRef.current, [p], 18, true, feather);
    rebuild();
  };

  const onMove = (event) => {
    if (!maskRef.current) return;
    const p = toPoint(event);
    setHoverNodeIdx(hitNode(p));
    if (!isDown) return;

    if (selectionTool === "polygon" && dragNodeIdx !== -1) {
      setPoints((prev) => prev.map((pt, idx) => (idx === dragNodeIdx ? p : pt)));
      return;
    }

    setPoints((prev) => [...prev, p]);
    if (selectionTool === "brush mask") paintMask(maskRef.current, [p], 18, false, feather);
    if (selectionTool === "erase mask") paintMask(maskRef.current, [p], 18, true, feather);
    if (selectionTool === "lasso") polygonMask(maskRef.current, [...points, p]);
    rebuild();
  };

  const onUp = (event) => {
    if (!maskRef.current) return;
    const p = toPoint(event);
    setIsDown(false);
    setDragNodeIdx(-1);
    if (selectionTool === "rectangular" && start) rectMask(maskRef.current, start, p);
    if (selectionTool === "lasso") polygonMask(maskRef.current, [...points, p]);
    setStart(null);
    if (selectionTool !== "polygon") setPoints([]);
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
        <button type="button" onClick={() => { if (maskRef.current) { clearMask(maskRef.current); setPoints([]); rebuild(); } }}>Clear mask</button>
        <button type="button" onClick={() => { if (maskRef.current) { invertMask(maskRef.current); rebuild(); } }}>Invert mask</button>
      </div>
    </div>
  );
}
