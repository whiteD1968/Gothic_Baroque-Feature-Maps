export const MAP_KEYS = [
  "original",
  "edge_map",
  "shadow_depth_map",
  "flow_map",
  "node_map",
  "density_map",
  "symmetry_asymmetry_map",
  "deformation_map",
  "composite_map",
  "palette_quantized_map",
  "combinator_map",
];

export const BLENDABLE_MAP_KEYS = [
  "edge_map",
  "shadow_depth_map",
  "flow_map",
  "node_map",
  "density_map",
  "symmetry_asymmetry_map",
  "deformation_map",
  "composite_map",
  "palette_quantized_map",
];

export const TAGS = ["Gothic", "Baroque", "Mixed", "Custom"];

export const PRESETS = {
  gothic_sensitive: { label: "Gothic Sensitive", edgeLow: 45, edgeHigh: 150, densityKernel: 7 },
  baroque_dense: { label: "Baroque Dense", edgeLow: 85, edgeHigh: 220, densityKernel: 13 },
  balanced_mixed: { label: "Balanced Mixed", edgeLow: 70, edgeHigh: 180, densityKernel: 9 },
  custom: { label: "Custom", edgeLow: null, edgeHigh: null, densityKernel: null },
};

export function mapLabel(key) {
  return key.replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

export function fileToPreview(file) {
  return {
    id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`,
    file,
    tag: "Gothic",
    previewUrl: URL.createObjectURL(file),
  };
}

export function resultKey(result, idx) {
  return `${result.original_name}-${idx}`;
}
