export function buildOutputRecord(payload = {}) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    ...payload,
  };
}

export function pickSelectedOutput(outputs = [], selectedId = "") {
  return outputs.find((item) => item.id === selectedId) || outputs[0] || null;
}

export function buildDesignPromptSummary(metadata = {}, fallback = "") {
  const tag = metadata?.source_tag || "hybrid";
  const maps = Array.isArray(metadata?.selected_feature_maps) ? metadata.selected_feature_maps : [];
  const mapPhrase = maps.length
    ? maps.map((m) => String(m).replaceAll("_", " ")).join(", ")
    : "rib convergence, ornamental density, shadow relief, curvature flow, and node clustering";
  const mode = metadata?.translation_mode || "graphic translation";
  return (
    `A ${tag} architectural reference image derived from ${mapPhrase}. ` +
    `Abstract linework, scalar fields, and tectonic segmentation are translated through ${mode} ` +
    "into a new digital spolia composition for AI-assisted architectural design."
  ) || fallback;
}

export function downloadJsonFile(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function copyTextToClipboard(text) {
  if (!text) return false;
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
  return true;
}
