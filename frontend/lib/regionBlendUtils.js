export function createCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function drawCover(ctx, img, width, height, transform = null) {
  ctx.save();
  const ratio = Math.max(width / img.width, height / img.height);
  const dw = img.width * ratio;
  const dh = img.height * ratio;
  const dx = (width - dw) / 2;
  const dy = (height - dh) / 2;
  if (transform) {
    ctx.translate(width / 2 + (transform.x || 0), height / 2 + (transform.y || 0));
    ctx.rotate(((transform.rotation || 0) * Math.PI) / 180);
    const s = transform.scale || 1;
    ctx.scale(s, s);
    ctx.translate(-width / 2, -height / 2);
  }
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

export function imageDataFromImage(img, width = 1024, height = 1024, transform = null) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  drawCover(ctx, img, width, height, transform);
  return ctx.getImageData(0, 0, width, height);
}

export function imageDataFromImageRegion(img, crop, width = 1024, height = 1024) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  const safeCrop = crop || { x: 0, y: 0, w: 1, h: 1 };
  const sx = Math.max(0, Math.min(img.width - 1, Math.floor((safeCrop.x || 0) * img.width)));
  const sy = Math.max(0, Math.min(img.height - 1, Math.floor((safeCrop.y || 0) * img.height)));
  const sw = Math.max(1, Math.min(img.width - sx, Math.floor((safeCrop.w || 1) * img.width)));
  const sh = Math.max(1, Math.min(img.height - sy, Math.floor((safeCrop.h || 1) * img.height)));
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

export function blendImageData(a, b, mask, mode = "opacity blend", opacity = 0.5) {
  const out = new ImageData(a.width, a.height);
  const da = a.data;
  const db = b.data;
  const dm = mask?.data;
  const d = out.data;

  const applyMode = (av, bv, m) => {
    const alpha = m * opacity;
    let mixed = bv;
    if (mode === "overlay" || mode === "region overlay") {
      mixed = av < 128 ? (2 * av * bv) / 255 : 255 - (2 * (255 - av) * (255 - bv)) / 255;
    } else if (mode === "multiply") {
      mixed = (av * bv) / 255;
    } else if (mode === "difference") {
      mixed = Math.abs(av - bv);
    } else if (mode === "soft merge") {
      mixed = av * 0.4 + bv * 0.6;
    }
    return av * (1 - alpha) + mixed * alpha;
  };

  for (let i = 0; i < da.length; i += 4) {
    const m = dm ? dm[i] / 255 : 0.5;
    const r = applyMode(da[i], db[i], m);
    const g = applyMode(da[i + 1], db[i + 1], m);
    const bl = applyMode(da[i + 2], db[i + 2], m);
    d[i] = Math.max(0, Math.min(255, r));
    d[i + 1] = Math.max(0, Math.min(255, g));
    d[i + 2] = Math.max(0, Math.min(255, bl));
    d[i + 3] = 255;
  }
  return out;
}

export function maskFromAlpha(maskCanvas) {
  const ctx = maskCanvas.getContext("2d");
  const imageData = ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = d[i + 3];
    d[i] = v;
    d[i + 1] = v;
    d[i + 2] = v;
    d[i + 3] = 255;
  }
  return imageData;
}

export function toDataUrl(imageData, type = "image/png") {
  const canvas = createCanvas(imageData.width, imageData.height);
  canvas.getContext("2d").putImageData(imageData, 0, 0);
  return canvas.toDataURL(type, 0.95);
}
