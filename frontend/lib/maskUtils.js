export function createMaskCanvas(width = 1024, height = 1024) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, width, height);
  return canvas;
}

export function paintMask(canvas, points, radius, erase = false, feather = 0) {
  const ctx = canvas.getContext("2d");
  ctx.save();
  ctx.globalCompositeOperation = erase ? "destination-out" : "source-over";
  for (const p of points) {
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius + feather * 20);
    const a0 = erase ? 1 : 0.95;
    g.addColorStop(0, `rgba(255,255,255,${a0})`);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius + feather * 20, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function clearMask(canvas) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

export function invertMask(canvas) {
  const ctx = canvas.getContext("2d");
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3];
    d[i + 3] = 255 - a;
    d[i] = d[i + 1] = d[i + 2] = d[i + 3];
  }
  ctx.putImageData(imageData, 0, 0);
}

export function rectMask(canvas, start, end) {
  const ctx = canvas.getContext("2d");
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const w = Math.abs(end.x - start.x);
  const h = Math.abs(end.y - start.y);
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.fillRect(x, y, w, h);
}

export function polygonMask(canvas, points) {
  if (!points.length) return;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
  ctx.fill();
}
