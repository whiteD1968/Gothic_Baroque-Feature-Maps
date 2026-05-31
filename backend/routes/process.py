import io
import os
import zipfile
from datetime import datetime
from typing import List

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

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


@router.post("/process")
async def process_images(
    files: List[UploadFile] = File(...),
    tags: List[str] = Form(...),
    edge_threshold_low: int = Form(70),
    edge_threshold_high: int = Form(180),
    density_kernel: int = Form(9),
    preset: str = Form("custom"),
    export_format: str = Form("png"),
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

    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    batch_dir = os.path.join(OUTPUT_DIR, f"batch_{timestamp}")
    ensure_dir(batch_dir)

    results = []
    for idx, file in enumerate(files):
        ext = os.path.splitext(file.filename or "")[1].lower()
        if ext not in [".jpg", ".jpeg", ".png", ".webp"]:
            raise HTTPException(status_code=400, detail=f"Unsupported file: {file.filename}")

        raw = await file.read()
        name = safe_filename(os.path.splitext(file.filename or f"image_{idx}")[0])
        input_name = f"{name}_{idx}{ext}"
        input_path = os.path.join(UPLOAD_DIR, input_name)

        with open(input_path, "wb") as f:
            f.write(raw)

        image_output_dir = os.path.join(batch_dir, f"{name}_{idx}")
        ensure_dir(image_output_dir)

        processed = extractor.process_image(
            image_bytes=raw,
            out_dir=image_output_dir,
            edge_threshold_low=edge_threshold_low,
            edge_threshold_high=edge_threshold_high,
            density_kernel=max(3, density_kernel | 1),
            tag=tags[idx],
            original_name=file.filename or input_name,
            export_format=export_format,
        )
        results.append(processed)

    zip_name = f"maps_{timestamp}.zip"
    zip_path = os.path.join(OUTPUT_DIR, zip_name)
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, _, filenames in os.walk(batch_dir):
            for fname in filenames:
                full_path = os.path.join(root, fname)
                arcname = os.path.relpath(full_path, batch_dir)
                zf.write(full_path, arcname=arcname)

    return {
        "results": results,
        "batch_zip": f"/api/download/zip/{zip_name}",
        "preset_used": preset_key,
        "controls_used": {
            "edge_threshold_low": edge_threshold_low,
            "edge_threshold_high": edge_threshold_high,
            "density_kernel": density_kernel,
        },
        "export_format": "jpg" if export_format in ["jpg", "jpeg"] else "png",
    }


@router.get("/download/file")
def download_file(path: str):
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
    export_format = (export_format or "png").strip().lower()
    if export_format not in ["png", "jpg", "jpeg"]:
        raise HTTPException(status_code=400, detail="Invalid export_format. Use png or jpg.")
