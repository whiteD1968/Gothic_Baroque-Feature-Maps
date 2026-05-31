import io
import os
import random
import zipfile
from datetime import datetime
from typing import List, Dict, Any

import cv2
import numpy as np
from fastapi import APIRouter, File, Form, HTTPException, UploadFile, Body
from fastapi.responses import FileResponse
from pydantic import BaseModel

from services.feature_extractor import FeatureExtractor
from utils.io_helpers import safe_filename, ensure_dir

router = APIRouter()
extractor = FeatureExtractor()

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
UPLOAD_DIR = os.path.join(BASE_DIR, "public", "uploads")
OUTPUT_DIR = os.path.join(BASE_DIR, "public", "outputs")
ensure_dir(UPLOAD_DIR)
ensure_dir(OUTPUT_DIR)

PRESETS = {
    "gothic_sensitive": {"edge_threshold_low": 45, "edge_threshold_high": 150, "density_kernel": 7},
    "baroque_dense": {"edge_threshold_low": 85, "edge_threshold_high": 220, "density_kernel": 13},
    "balanced_mixed": {"edge_threshold_low": 70, "edge_threshold_high": 180, "density_kernel": 9},
    "custom": None,
}


class CrossBlendRequest(BaseModel):
    sources: List[Dict[str, Any]]
    palette_colors: int = 4
    tile_repeat: int = 2
    export_format: str = "png"


def _ensure_color(arr: np.ndarray) -> np.ndarray:
    if len(arr.shape) == 2:
        return cv2.cvtColor(arr, cv2.COLOR_GRAY2BGR)
    return arr


def _quantize_bgr(image_bgr: np.ndarray, colors: int) -> np.ndarray:
    count = max(3, min(8, int(colors)))
    pixels = image_bgr.reshape((-1, 3)).astype(np.float32)
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 24, 0.8)
    _, labels, centers = cv2.kmeans(pixels, count, None, criteria, 8, cv2.KMEANS_PP_CENTERS)
    centers_u8 = np.uint8(centers)
    return centers_u8[labels.flatten()].reshape(image_bgr.shape)


def _tile_bgr(image_bgr: np.ndarray, repeat: int) -> np.ndarray:
    r = max(2, min(4, int(repeat)))
    return np.tile(image_bgr, (r, r, 1))


def _score_variant(metrics: dict) -> dict:
    edge = float(metrics.get("edge_ratio", 0.0))
    density = float(metrics.get("density_mean", 0.0))
    symmetry = float(metrics.get("symmetry_score", 0.0))
    nodes = float(metrics.get("node_count", 0.0))
    flow = float(metrics.get("flow_strength", 0.0))

    contrast_score = max(0.0, min(1.0, edge / 0.2))
    complexity_score = max(0.0, min(1.0, density / 0.35))
    symmetry_balance_score = max(0.0, min(1.0, 1.0 - abs(symmetry - 0.68) / 0.68))
    node_score = max(0.0, min(1.0, nodes / 500.0))
    flow_score = max(0.0, min(1.0, flow / 0.3))

    total = (
        (contrast_score * 0.24)
        + (complexity_score * 0.24)
        + (symmetry_balance_score * 0.20)
        + (node_score * 0.16)
        + (flow_score * 0.16)
    )
    return {
        "total": round(total, 4),
        "contrast": round(contrast_score, 4),
        "complexity": round(complexity_score, 4),
        "symmetry_balance": round(symmetry_balance_score, 4),
        "node_density": round(node_score, 4),
        "flow": round(flow_score, 4),
    }


@router.post("/process")
async def process_images(
    files: List[UploadFile] = File(...),
    tags: List[str] = Form(...),
    edge_threshold_low: int = Form(70),
    edge_threshold_high: int = Form(180),
    density_kernel: int = Form(9),
    preset: str = Form("custom"),
    export_format: str = Form("png"),
    palette_colors: int = Form(4),
    blend_a: str = Form("edge_map"),
    blend_b: str = Form("density_map"),
    blend_c: str = Form("flow_map"),
    blend_weight_a: float = Form(0.5),
    blend_weight_b: float = Form(0.3),
    blend_weight_c: float = Form(0.2),
    mutation_count: int = Form(1),
    mutation_jitter: float = Form(0.2),
):
    if len(files) != len(tags):
        raise HTTPException(status_code=400, detail="files and tags length must match")

    preset_key = (preset or "custom").strip().lower()
    if preset_key not in PRESETS:
        raise HTTPException(status_code=400, detail="Invalid preset")
    chosen = PRESETS[preset_key]
    if chosen is not None:
        edge_threshold_low = chosen["edge_threshold_low"]
        edge_threshold_high = chosen["edge_threshold_high"]
        density_kernel = chosen["density_kernel"]

    export_format = (export_format or "png").strip().lower()
    if export_format not in ["png", "jpg", "jpeg"]:
        raise HTTPException(status_code=400, detail="Invalid export_format. Use png or jpg.")
    palette_colors = max(3, min(8, int(palette_colors)))
    mutation_count = max(1, min(30, int(mutation_count)))
    mutation_jitter = max(0.0, min(1.0, float(mutation_jitter)))

    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    batch_dir = os.path.join(OUTPUT_DIR, f"batch_{timestamp}")
    ensure_dir(batch_dir)

    results = []
    top_variant_dirs = []
    def clamp_int(value: float, lo: int, hi: int) -> int:
        return max(lo, min(hi, int(round(value))))

    for idx, file in enumerate(files):
        image_variants = []
        ext = os.path.splitext(file.filename or "")[1].lower()
        if ext not in [".jpg", ".jpeg", ".png", ".webp"]:
            raise HTTPException(status_code=400, detail=f"Unsupported file: {file.filename}")

        raw = await file.read()
        name = safe_filename(os.path.splitext(file.filename or f"image_{idx}")[0])
        input_name = f"{name}_{idx}{ext}"
        input_path = os.path.join(UPLOAD_DIR, input_name)

        with open(input_path, "wb") as f:
            f.write(raw)

        for variant_idx in range(mutation_count):
            rng = random.Random(f"{timestamp}-{idx}-{variant_idx}")

            if variant_idx == 0:
                v_edge_low = edge_threshold_low
                v_edge_high = edge_threshold_high
                v_density = max(3, density_kernel | 1)
                v_palette = palette_colors
                v_wa = float(blend_weight_a)
                v_wb = float(blend_weight_b)
                v_wc = float(blend_weight_c)
            else:
                edge_swing = 80 * mutation_jitter
                high_swing = 110 * mutation_jitter
                density_swing = 6 * mutation_jitter

                v_edge_low = clamp_int(edge_threshold_low + rng.uniform(-edge_swing, edge_swing), 10, 200)
                v_edge_high = clamp_int(edge_threshold_high + rng.uniform(-high_swing, high_swing), 50, 300)
                if v_edge_high <= v_edge_low:
                    v_edge_high = min(300, v_edge_low + 20)
                v_density = clamp_int(density_kernel + rng.uniform(-density_swing, density_swing), 3, 21) | 1
                v_palette = clamp_int(palette_colors + rng.uniform(-2 * mutation_jitter, 2 * mutation_jitter), 3, 8)

                weight_swing = 0.55 * mutation_jitter
                v_wa = max(0.0, float(blend_weight_a) + rng.uniform(-weight_swing, weight_swing))
                v_wb = max(0.0, float(blend_weight_b) + rng.uniform(-weight_swing, weight_swing))
                v_wc = max(0.0, float(blend_weight_c) + rng.uniform(-weight_swing, weight_swing))

            image_output_dir = os.path.join(batch_dir, f"{name}_{idx}_v{variant_idx + 1:02d}")
            ensure_dir(image_output_dir)

            try:
                processed = extractor.process_image(
                    image_bytes=raw,
                    out_dir=image_output_dir,
                    edge_threshold_low=v_edge_low,
                    edge_threshold_high=v_edge_high,
                    density_kernel=v_density,
                    tag=tags[idx],
                    original_name=f"{file.filename or input_name} [v{variant_idx + 1:02d}]",
                    export_format=export_format,
                    palette_colors=v_palette,
                    blend_a=blend_a,
                    blend_b=blend_b,
                    blend_c=blend_c,
                    blend_weight_a=v_wa,
                    blend_weight_b=v_wb,
                    blend_weight_c=v_wc,
                )
            except Exception as exc:
                raise HTTPException(
                    status_code=500,
                    detail=f"Processing failed for '{file.filename}' variant {variant_idx + 1}: {exc}",
                ) from exc
            score = _score_variant(processed.get("metrics", {}))
            processed["variant"] = {
                "index": variant_idx + 1,
                "is_base": variant_idx == 0,
                "edge_threshold_low": v_edge_low,
                "edge_threshold_high": v_edge_high,
                "density_kernel": v_density,
                "palette_colors": v_palette,
                "blend_weight_a": round(v_wa, 4),
                "blend_weight_b": round(v_wb, 4),
                "blend_weight_c": round(v_wc, 4),
                "fitness_score": score["total"],
                "fitness_components": score,
            }
            image_variants.append(processed)

        image_variants.sort(
            key=lambda item: float(item.get("variant", {}).get("fitness_score", 0.0)),
            reverse=True,
        )
        for rank, variant in enumerate(image_variants, start=1):
            variant["variant"]["rank"] = rank
            variant["variant"]["is_top3"] = rank <= 3
            variant["variant"]["variant_count"] = len(image_variants)
            if rank <= 3:
                first_map_path = next(iter((variant.get("maps") or {}).values()), None)
                if first_map_path:
                    top_variant_dirs.append(os.path.dirname(first_map_path))
        results.extend(image_variants)

    zip_name = f"maps_{timestamp}.zip"
    zip_path = os.path.join(OUTPUT_DIR, zip_name)
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, _, filenames in os.walk(batch_dir):
            for fname in filenames:
                full_path = os.path.join(root, fname)
                arcname = os.path.relpath(full_path, batch_dir)
                zf.write(full_path, arcname=arcname)

    top3_zip_name = f"maps_top3_{timestamp}.zip"
    top3_zip_path = os.path.join(OUTPUT_DIR, top3_zip_name)
    with zipfile.ZipFile(top3_zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for variant_dir in top_variant_dirs:
            if not os.path.isdir(variant_dir):
                continue
            for fname in os.listdir(variant_dir):
                full_path = os.path.join(variant_dir, fname)
                if not os.path.isfile(full_path):
                    continue
                rel = os.path.relpath(full_path, batch_dir)
                zf.write(full_path, arcname=rel)

    return {
        "results": results,
        "batch_zip": f"/api/download/zip/{zip_name}",
        "top3_zip": f"/api/download/zip/{top3_zip_name}",
        "preset_used": preset_key,
        "controls_used": {
            "edge_threshold_low": edge_threshold_low,
            "edge_threshold_high": edge_threshold_high,
            "density_kernel": density_kernel,
            "palette_colors": palette_colors,
            "blend_a": blend_a,
            "blend_b": blend_b,
            "blend_c": blend_c,
            "blend_weight_a": blend_weight_a,
            "blend_weight_b": blend_weight_b,
            "blend_weight_c": blend_weight_c,
            "mutation_count": mutation_count,
            "mutation_jitter": mutation_jitter,
        },
        "export_format": "jpg" if export_format in ["jpg", "jpeg"] else "png",
    }


@router.get("/download/file")
def download_file(path: str):
    if not path:
        raise HTTPException(status_code=400, detail="Missing path")
    full_path = os.path.abspath(path)
    if not full_path.startswith(OUTPUT_DIR):
        raise HTTPException(status_code=400, detail="Invalid path")
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(full_path, filename=os.path.basename(full_path))


@router.get("/download/zip/{zip_name}")
def download_zip(zip_name: str):
    zip_path = os.path.join(OUTPUT_DIR, safe_filename(zip_name, keep_dots=True))
    if not os.path.exists(zip_path):
        raise HTTPException(status_code=404, detail="Zip not found")
    return FileResponse(zip_path, filename=os.path.basename(zip_path), media_type="application/zip")


@router.post("/cross-blend")
async def cross_blend(payload: CrossBlendRequest = Body(...)):
    if len(payload.sources) < 2 or len(payload.sources) > 3:
        raise HTTPException(status_code=400, detail="Select 2 or 3 sources")

    export_format = (payload.export_format or "png").strip().lower()
    if export_format not in ["png", "jpg", "jpeg"]:
        raise HTTPException(status_code=400, detail="Invalid export_format. Use png or jpg.")
    ext = "jpg" if export_format in ["jpg", "jpeg"] else "png"

    prepared = []
    for idx, src in enumerate(payload.sources):
        path = str(src.get("path", ""))
        label = str(src.get("label", f"source_{idx+1}"))
        weight = float(src.get("weight", 1.0))
        if not path:
            raise HTTPException(status_code=400, detail=f"Missing path for source {idx + 1}")
        full_path = os.path.abspath(path)
        if not full_path.startswith(OUTPUT_DIR):
            raise HTTPException(status_code=400, detail=f"Invalid path for source {idx + 1}")
        if not os.path.exists(full_path):
            raise HTTPException(status_code=404, detail=f"Source file not found for source {idx + 1}")
        img = cv2.imread(full_path, cv2.IMREAD_UNCHANGED)
        if img is None:
            raise HTTPException(status_code=400, detail=f"Could not decode source {idx + 1}")
        prepared.append({"img": _ensure_color(img), "weight": max(0.0, weight), "label": label})

    base_h, base_w = prepared[0]["img"].shape[:2]
    blended = np.zeros((base_h, base_w, 3), dtype=np.float32)
    total = 0.0
    for src in prepared:
        resized = cv2.resize(src["img"], (base_w, base_h), interpolation=cv2.INTER_LINEAR).astype(np.float32)
        w = src["weight"]
        blended += (resized * w)
        total += w
    if total <= 0:
        total = float(len(prepared))
        blended = sum(cv2.resize(s["img"], (base_w, base_h)).astype(np.float32) for s in prepared)
    blended = np.clip(blended / total, 0, 255).astype(np.uint8)

    quantized = _quantize_bgr(blended, payload.palette_colors)
    tiled = _tile_bgr(quantized, payload.tile_repeat)

    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    out_dir = os.path.join(OUTPUT_DIR, f"cross_blend_{timestamp}")
    ensure_dir(out_dir)
    blended_path = os.path.join(out_dir, f"cross_blend.{ext}")
    quantized_path = os.path.join(out_dir, f"cross_quantized.{ext}")
    tiled_path = os.path.join(out_dir, f"cross_tiled.{ext}")
    cv2.imwrite(blended_path, blended)
    cv2.imwrite(quantized_path, quantized)
    cv2.imwrite(tiled_path, tiled)

    zip_name = f"cross_blend_{timestamp}.zip"
    zip_path = os.path.join(OUTPUT_DIR, zip_name)
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for p in [blended_path, quantized_path, tiled_path]:
            zf.write(p, arcname=os.path.relpath(p, out_dir))

    labels = [s["label"] for s in prepared]
    prompt_short = f"cross-referenced architectural pattern synthesis from {', '.join(labels)}"
    prompt_long = (
        f"Blend structural maps from {', '.join(labels)} into one emergent reference image, "
        f"use {max(3, min(8, payload.palette_colors))}-tone quantized abstraction and tiled pattern logic, "
        "prioritize geometric behavior transfer over stylistic imitation."
    )
    params = "--ar 1:1 --stylize 300 --chaos 20 --iw 1.4 --quality 1"
    full_prompt = f"{prompt_short}. {prompt_long} {params}"

    return {
        "maps": {
            "cross_blend_map": blended_path,
            "cross_quantized_map": quantized_path,
            "cross_tiled_pattern_map": tiled_path,
        },
        "zip": f"/api/download/zip/{zip_name}",
        "midjourney": {
            "short_prompt": prompt_short,
            "long_prompt": prompt_long,
            "params": params,
            "full_prompt": full_prompt,
        },
    }
