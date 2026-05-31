export function imageDataToCanvas(imageData) {
  const canvas = document.createElement("canvas");
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  canvas.getContext("2d").putImageData(imageData, 0, 0);
  return canvas;
}

export function downloadDataUrl(filename, dataUrl) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

function grayAt(data, width, x, y) {
  const i = (y * width + x) * 4;
  return (data[i] + data[i + 1] + data[i + 2]) / 3;
}

function isBoundary(binary, width, height, x, y) {
  if (!binary[y * width + x]) return false;
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const [dx, dy] of dirs) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) return true;
    if (!binary[ny * width + nx]) return true;
  }
  return false;
}

function traceBoundary(binary, visited, width, height, sx, sy) {
  const path = [];
  const queue = [[sx, sy]];
  visited[sy * width + sx] = 1;
  while (queue.length) {
    const [x, y] = queue.shift();
    path.push([x, y]);
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const id = ny * width + nx;
      if (visited[id]) continue;
      if (!isBoundary(binary, width, height, nx, ny)) continue;
      visited[id] = 1;
      queue.push([nx, ny]);
    }
  }
  return path;
}

function perpendicularDistance(p, a, b) {
  const num = Math.abs((b.y - a.y) * p.x - (b.x - a.x) * p.y + b.x * a.y - b.y * a.x);
  const den = Math.hypot(b.y - a.y, b.x - a.x) || 1;
  return num / den;
}

function simplifyPolyline(points, epsilon) {
  if (points.length <= 2) return points;
  let maxDist = 0;
  let index = 0;
  const a = points[0];
  const b = points[points.length - 1];
  for (let i = 1; i < points.length - 1; i += 1) {
    const d = perpendicularDistance(points[i], a, b);
    if (d > maxDist) {
      index = i;
      maxDist = d;
    }
  }
  if (maxDist > epsilon) {
    const left = simplifyPolyline(points.slice(0, index + 1), epsilon);
    const right = simplifyPolyline(points.slice(index), epsilon);
    return [...left.slice(0, -1), ...right];
  }
  return [a, b];
}

export function exportContourSvg(imageData, threshold = 128, simplify = 3) {
  const { width, height, data } = imageData;
  const binary = new Uint8Array(width * height);
  const visited = new Uint8Array(width * height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      binary[y * width + x] = grayAt(data, width, x, y) > threshold ? 1 : 0;
    }
  }

  const paths = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const id = y * width + x;
      if (visited[id] || !isBoundary(binary, width, height, x, y)) continue;
      const pts = traceBoundary(binary, visited, width, height, x, y);
      if (pts.length < 12) continue;
      const sampled = pts.filter((_, i) => i % Math.max(1, Math.floor(simplify / 2)) === 0).map(([xv, yv]) => ({ x: xv, y: yv }));
      const simplified = simplifyPolyline(sampled, simplify);
      const d = simplified.map((pt, i) => `${i === 0 ? "M" : "L"}${pt.x} ${pt.y}`).join(" ");
      paths.push(`<path d="${d}" fill="none" stroke="black" stroke-width="1" stroke-linejoin="round" stroke-linecap="round" />`);
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${paths.join("")}</svg>`;
}

export function exportRegionSvg(imageData, levels = 5) {
  const { width, height, data } = imageData;
  const step = Math.max(1, Math.floor(255 / levels));
  const rects = [];
  for (let y = 0; y < height; y += 8) {
    for (let x = 0; x < width; x += 8) {
      const i = (y * width + x) * 4;
      const g = (data[i] + data[i + 1] + data[i + 2]) / 3;
      const l = Math.floor(g / step);
      const fill = Math.floor((l / levels) * 255);
      rects.push(`<rect x="${x}" y="${y}" width="8" height="8" fill="rgb(${fill},${fill},${fill})" />`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${rects.join("")}</svg>`;
}

export function exportNodeCsv(imageData) {
  const { width, data } = imageData;
  const rows = ["x,y,intensity"];
  for (let i = 0; i < data.length; i += 4) {
    const g = (data[i] + data[i + 1] + data[i + 2]) / 3;
    if (g > 180) {
      const p = i / 4;
      rows.push(`${p % width},${Math.floor(p / width)},${Math.round(g)}`);
    }
  }
  return rows.join("\n");
}

export function exportDensityCsv(imageData, cell = 16) {
  const { width, height, data } = imageData;
  const rows = ["cell_x,cell_y,density"];
  for (let y = 0; y < height; y += cell) {
    for (let x = 0; x < width; x += cell) {
      let sum = 0;
      let count = 0;
      for (let oy = 0; oy < cell && y + oy < height; oy += 1) {
        for (let ox = 0; ox < cell && x + ox < width; ox += 1) {
          const i = (((y + oy) * width) + x + ox) * 4;
          sum += (data[i] + data[i + 1] + data[i + 2]) / 3;
          count += 1;
        }
      }
      rows.push(`${x},${y},${(sum / count).toFixed(2)}`);
    }
  }
  return rows.join("\n");
}

export function exportPaletteJson(imageData, bins = 8) {
  const palette = {};
  for (let i = 0; i < imageData.data.length; i += 4) {
    const r = Math.round(imageData.data[i] / bins) * bins;
    const g = Math.round(imageData.data[i + 1] / bins) * bins;
    const b = Math.round(imageData.data[i + 2] / bins) * bins;
    const key = `${r},${g},${b}`;
    palette[key] = (palette[key] || 0) + 1;
  }
  return JSON.stringify({ palette }, null, 2);
}

export function downloadText(filename, text, mime = "text/plain") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
