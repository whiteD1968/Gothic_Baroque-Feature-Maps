export function createSeededRandom(seed = 1) {
  let s = Number(seed) || 1;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function clampValue(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function mutationGridCount(gridSize) {
  return gridSize === "4x4" ? 16 : 9;
}

function grayAt(data, idx) {
  return (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
}

function writeGray(data, idx, v) {
  const value = clampValue(Math.round(v), 0, 255);
  data[idx] = value;
  data[idx + 1] = value;
  data[idx + 2] = value;
  data[idx + 3] = 255;
}

function copyImageData(imageData) {
  return new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
}

function morph(imageData, radius, useMax) {
  const r = Math.max(1, Math.floor(radius || 1));
  const { width, height, data } = imageData;
  const out = new Uint8ClampedArray(data.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let acc = useMax ? 0 : 255;
      for (let oy = -r; oy <= r; oy += 1) {
        for (let ox = -r; ox <= r; ox += 1) {
          const nx = clampValue(x + ox, 0, width - 1);
          const ny = clampValue(y + oy, 0, height - 1);
          const idxN = (ny * width + nx) * 4;
          const g = grayAt(data, idxN);
          acc = useMax ? Math.max(acc, g) : Math.min(acc, g);
        }
      }
      const idx = (y * width + x) * 4;
      writeGray(out, idx, acc);
    }
  }
  return new ImageData(out, width, height);
}

export function applyThresholdShift(imageData, amount = 0) {
  const out = copyImageData(imageData);
  const threshold = clampValue(128 + amount, 0, 255);
  for (let i = 0; i < out.data.length; i += 4) {
    const v = grayAt(out.data, i) >= threshold ? 255 : 0;
    writeGray(out.data, i, v);
  }
  return out;
}

export function applyLineThickening(imageData, radius = 1) {
  return applyDilation(imageData, radius);
}

export function applyErosion(imageData, radius = 1) {
  return morph(imageData, radius, false);
}

export function applyDilation(imageData, radius = 1) {
  return morph(imageData, radius, true);
}

export function applyMirror(imageData, axis = "x") {
  const out = copyImageData(imageData);
  const { width, height, data } = imageData;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sx = axis === "y" ? x : width - 1 - x;
      const sy = axis === "y" ? height - 1 - y : y;
      const src = (sy * width + sx) * 4;
      const dst = (y * width + x) * 4;
      out.data[dst] = data[src];
      out.data[dst + 1] = data[src + 1];
      out.data[dst + 2] = data[src + 2];
      out.data[dst + 3] = data[src + 3];
    }
  }
  return out;
}

export function applyTileRepeat(imageData, repeatX = 2, repeatY = 2) {
  const rx = Math.max(1, Math.floor(repeatX));
  const ry = Math.max(1, Math.floor(repeatY));
  const canvas = document.createElement("canvas");
  canvas.width = imageData.width * rx;
  canvas.height = imageData.height * ry;
  const ctx = canvas.getContext("2d");
  const src = document.createElement("canvas");
  src.width = imageData.width;
  src.height = imageData.height;
  src.getContext("2d").putImageData(imageData, 0, 0);
  for (let y = 0; y < ry; y += 1) {
    for (let x = 0; x < rx; x += 1) {
      ctx.drawImage(src, x * imageData.width, y * imageData.height);
    }
  }
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

export function applyRadialRepeat(imageData, segments = 6) {
  const seg = Math.max(2, Math.floor(segments));
  const size = Math.max(imageData.width, imageData.height);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const src = document.createElement("canvas");
  src.width = imageData.width;
  src.height = imageData.height;
  src.getContext("2d").putImageData(imageData, 0, 0);
  ctx.translate(size / 2, size / 2);
  for (let i = 0; i < seg; i += 1) {
    ctx.save();
    ctx.rotate((Math.PI * 2 * i) / seg);
    if (i % 2 === 1) ctx.scale(-1, 1);
    ctx.drawImage(src, -size / 2, -size / 2, size, size);
    ctx.restore();
  }
  return ctx.getImageData(0, 0, size, size);
}

export function applyContourBanding(imageData, levels = 8) {
  const out = copyImageData(imageData);
  const lv = Math.max(2, Math.floor(levels));
  const step = 255 / (lv - 1);
  for (let i = 0; i < out.data.length; i += 4) {
    const g = grayAt(out.data, i);
    const v = Math.round(g / step) * step;
    writeGray(out.data, i, v);
  }
  return out;
}

export function applyRegionSegmentation(imageData, colors = 5) {
  const out = copyImageData(imageData);
  const c = Math.max(2, Math.floor(colors));
  const step = 255 / c;
  for (let i = 0; i < out.data.length; i += 4) {
    const g = grayAt(out.data, i);
    const band = Math.floor(g / step);
    out.data[i] = clampValue(40 + band * (190 / c), 0, 255);
    out.data[i + 1] = clampValue(80 + band * (140 / c), 0, 255);
    out.data[i + 2] = clampValue(200 - band * (160 / c), 0, 255);
    out.data[i + 3] = 255;
  }
  return out;
}

export function applyNoiseDistortion(imageData, strength = 0.2, seed = 1) {
  const out = copyImageData(imageData);
  const rand = createSeededRandom(seed);
  const amp = clampValue(strength, 0, 1) * 100;
  for (let i = 0; i < out.data.length; i += 4) {
    const n = (rand() - 0.5) * amp;
    out.data[i] = clampValue(out.data[i] + n, 0, 255);
    out.data[i + 1] = clampValue(out.data[i + 1] + n, 0, 255);
    out.data[i + 2] = clampValue(out.data[i + 2] + n, 0, 255);
  }
  return out;
}

export function applyPaletteReduction(imageData, colorCount = 6) {
  const out = copyImageData(imageData);
  const c = Math.max(2, Math.floor(colorCount));
  const step = 255 / (c - 1);
  for (let i = 0; i < out.data.length; i += 4) {
    out.data[i] = Math.round(out.data[i] / step) * step;
    out.data[i + 1] = Math.round(out.data[i + 1] / step) * step;
    out.data[i + 2] = Math.round(out.data[i + 2] / step) * step;
  }
  return out;
}
