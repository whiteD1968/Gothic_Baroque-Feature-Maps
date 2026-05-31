function clamp(v) { return Math.max(0, Math.min(255, v)); }

export function applyAbstraction(imageData, mode) {
  const out = new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
  const d = out.data;
  if (mode === "Hybrid Linework Plate" || mode === "Contour / Hatch Drawing") {
    for (let i = 0; i < d.length; i += 4) {
      const g = (d[i] + d[i + 1] + d[i + 2]) / 3;
      const bw = g > 128 ? 255 : 0;
      d[i] = d[i + 1] = d[i + 2] = bw;
    }
  }
  if (mode === "Field Condition Map") {
    for (let i = 0; i < d.length; i += 4) {
      const g = (d[i] + d[i + 1] + d[i + 2]) / 3;
      d[i] = g;
      d[i + 1] = clamp(140 - g * 0.2);
      d[i + 2] = clamp(255 - g * 0.75);
    }
  }
  if (mode === "Palette Region Diagram") {
    for (let i = 0; i < d.length; i += 4) {
      d[i] = Math.round(d[i] / 48) * 48;
      d[i + 1] = Math.round(d[i + 1] / 48) * 48;
      d[i + 2] = Math.round(d[i + 2] / 48) * 48;
    }
  }
  if (mode === "Pattern Mutation Sheet" || mode === "Tile / UV Study") {
    for (let i = 0; i < d.length; i += 4) {
      const g = (d[i] + d[i + 1] + d[i + 2]) / 3;
      const band = Math.round(g / 32) * 32;
      d[i] = band;
      d[i + 1] = band;
      d[i + 2] = band;
    }
  }
  return out;
}

export function generateMutations(imageData, count = 9) {
  const out = [];
  for (let k = 0; k < count; k += 1) {
    const img = new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      let g = (d[i] + d[i + 1] + d[i + 2]) / 3;
      if (k % 3 === 0) g = g > 100 + (k % 5) * 20 ? 255 : 0;
      if (k % 3 === 1) g = Math.round(g / 40) * 40;
      if (k % 3 === 2) g = clamp(g + (Math.random() - 0.5) * 60);
      d[i] = d[i + 1] = d[i + 2] = g;
    }
    out.push(img);
  }
  return out;
}
