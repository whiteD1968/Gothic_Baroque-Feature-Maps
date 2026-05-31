function clamp(v) { return Math.max(0, Math.min(255, v)); }

function gray(data, i) {
  return (data[i] + data[i + 1] + data[i + 2]) / 3;
}

export function extractFeatureChannels(imageData) {
  const { width, height, data } = imageData;
  const edge = new Float32Array(width * height);
  const density = new Float32Array(width * height);
  const flow = new Float32Array(width * height);
  const shadow = new Float32Array(width * height);
  const node = new Float32Array(width * height);
  const symmetry = new Float32Array(width * height);
  const texture = new Float32Array(width * height);

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = (y * width + x) * 4;
      const idx = y * width + x;
      const gx = gray(data, ((y * width + (x + 1)) * 4)) - gray(data, ((y * width + (x - 1)) * 4));
      const gy = gray(data, ((((y + 1) * width) + x) * 4)) - gray(data, ((((y - 1) * width) + x) * 4));
      edge[idx] = Math.min(255, Math.abs(gx) + Math.abs(gy));
      density[idx] = gray(data, i);
      flow[idx] = Math.min(255, Math.sqrt(gx * gx + gy * gy));
      shadow[idx] = 255 - density[idx];
      node[idx] = edge[idx] > 140 ? 255 : 0;
      const mx = width - x - 1;
      const mirror = gray(data, (y * width + mx) * 4);
      symmetry[idx] = 255 - Math.abs(density[idx] - mirror);
      texture[idx] = Math.abs(gray(data, i) - gray(data, (((y - 1) * width + x - 1) * 4)));
    }
  }
  return { edge, density, flow, shadow, node, symmetry, texture, width, height };
}

export function blendFeatures(featuresA, featuresB, roleAssignment, weights) {
  const out = new ImageData(featuresA.width, featuresA.height);
  const channels = {
    edge: roleAssignment.edge === "A" ? featuresA.edge : featuresB.edge,
    density: roleAssignment.density === "A" ? featuresA.density : featuresB.density,
    flow: roleAssignment.flow === "A" ? featuresA.flow : featuresB.flow,
    shadow: roleAssignment.shadow === "A" ? featuresA.shadow : featuresB.shadow,
    node: roleAssignment.node === "A" ? featuresA.node : featuresB.node,
    symmetry: roleAssignment.symmetry === "A" ? featuresA.symmetry : featuresB.symmetry,
    texture: roleAssignment.texture === "A" ? featuresA.texture : featuresB.texture,
  };

  for (let i = 0; i < out.data.length; i += 4) {
    const p = i / 4;
    const v =
      channels.edge[p] * (weights.edge || 0) +
      channels.density[p] * (weights.density || 0) +
      channels.flow[p] * (weights.flow || 0) +
      channels.shadow[p] * (weights.shadow || 0) +
      channels.node[p] * (weights.node || 0) +
      channels.symmetry[p] * (weights.symmetry || 0) +
      channels.texture[p] * (weights.texture || 0);
    const n = clamp(v / Math.max(0.001, Object.values(weights).reduce((a, b) => a + b, 0)));
    out.data[i] = n;
    out.data[i + 1] = clamp(n * 0.88);
    out.data[i + 2] = clamp(255 - n * 0.64);
    out.data[i + 3] = 255;
  }
  return out;
}
