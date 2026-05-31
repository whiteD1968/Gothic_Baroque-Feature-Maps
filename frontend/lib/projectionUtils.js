export const PROJECTION_GEOMETRIES = [
  "flat tile",
  "folded tile",
  "vault patch",
  "column fragment",
  "stereotomic block",
  "minimal surface patch placeholder",
];

export function projectionSettings(values = {}) {
  return {
    uv_scale: values.uvScale ?? 1,
    uv_rotation: values.uvRotation ?? 0,
    mirror_x: Boolean(values.mirrorX),
    mirror_y: Boolean(values.mirrorY),
    repeat_count: values.repeatCount ?? 2,
    opacity: values.opacity ?? 1,
    perspective_distortion: values.perspectiveDistortion ?? 0,
    color_quantization: values.colorQuantization ?? 6,
    smoothing: values.smoothing ?? true,
  };
}

function ensureCanvasFromImage(mapImage, fallback = 900) {
  const canvas = document.createElement("canvas");
  if (mapImage instanceof HTMLCanvasElement) {
    canvas.width = mapImage.width;
    canvas.height = mapImage.height;
    canvas.getContext("2d").drawImage(mapImage, 0, 0);
    return canvas;
  }
  canvas.width = mapImage?.width || fallback;
  canvas.height = mapImage?.height || fallback;
  const ctx = canvas.getContext("2d");
  if (mapImage) ctx.drawImage(mapImage, 0, 0, canvas.width, canvas.height);
  return canvas;
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

function prepareProjectionCanvas(mapImage, options = {}) {
  const size = options.size || 900;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = options.background || "#efeee9";
  ctx.fillRect(0, 0, size, size);
  const texture = ensureCanvasFromImage(mapImage, size);
  return { canvas, ctx, texture, size, d: (options.perspectiveDistortion || 0.4) * 180 };
}

export function projectMapToTile(mapImage, options = {}) {
  const { canvas, ctx, texture, size } = prepareProjectionCanvas(mapImage, options);
  ctx.globalAlpha = options.opacity ?? 1;
  ctx.drawImage(texture, size * 0.15, size * 0.15, size * 0.7, size * 0.7);
  return canvas;
}

export function projectMapToVaultPatch(mapImage, options = {}) {
  const { canvas, ctx, texture, size, d } = prepareProjectionCanvas(mapImage, options);
  ctx.globalAlpha = options.opacity ?? 1;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(size * 0.12, size * 0.84);
  ctx.quadraticCurveTo(size * 0.5, size * (0.06 + d * 0.0007), size * 0.88, size * 0.84);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(texture, size * 0.12, size * 0.1, size * 0.76, size * 0.76);
  ctx.restore();
  return canvas;
}

export function projectMapToBlock(mapImage, options = {}) {
  const { canvas, ctx, texture, d } = prepareProjectionCanvas(mapImage, options);
  ctx.globalAlpha = options.opacity ?? 1;
  drawWarpedStrip(ctx, texture, { tl: { x: 220, y: 300 }, tr: { x: 560, y: 300 }, bl: { x: 220, y: 720 }, br: { x: 560, y: 720 } });
  drawWarpedStrip(ctx, texture, { tl: { x: 220, y: 300 }, tr: { x: 330 + d * 0.4, y: 220 - d * 0.3 }, bl: { x: 560, y: 300 }, br: { x: 670 + d * 0.4, y: 220 - d * 0.3 } });
  drawWarpedStrip(ctx, texture, { tl: { x: 560, y: 300 }, tr: { x: 670 + d * 0.4, y: 220 - d * 0.3 }, bl: { x: 560, y: 720 }, br: { x: 670 + d * 0.4, y: 640 - d * 0.3 } });
  return canvas;
}

export function projectMapToColumnFragment(mapImage, options = {}) {
  const { canvas, ctx, texture, d } = prepareProjectionCanvas(mapImage, options);
  ctx.globalAlpha = options.opacity ?? 1;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(450, 420, 240, 320, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(texture, 210 - d * 0.25, 110, 490 + d * 0.45, 660);
  ctx.restore();
  const grad = ctx.createLinearGradient(210, 0, 690, 0);
  grad.addColorStop(0, "rgba(0,0,0,0.30)");
  grad.addColorStop(0.32, "rgba(255,255,255,0.14)");
  grad.addColorStop(0.67, "rgba(0,0,0,0.08)");
  grad.addColorStop(1, "rgba(0,0,0,0.32)");
  ctx.fillStyle = grad;
  ctx.fillRect(210, 110, 490, 660);
  return canvas;
}

export function projectMapToMinimalSurfacePatch(mapImage, options = {}) {
  const { canvas, ctx, texture, d } = prepareProjectionCanvas(mapImage, options);
  ctx.globalAlpha = options.opacity ?? 1;
  for (let i = 0; i < 24; i += 1) {
    const t = i / 24;
    const y = 120 + t * 620;
    const wave = Math.sin(t * Math.PI * 2) * (44 + d * 0.25);
    drawWarpedStrip(ctx, texture, {
      tl: { x: 130 + wave * 0.3, y },
      tr: { x: 770 - wave * 0.3, y: y + wave * 0.2 },
      bl: { x: 160 - wave * 0.2, y: y + 24 },
      br: { x: 740 + wave * 0.2, y: y + 24 },
    }, 7);
  }
  return canvas;
}
