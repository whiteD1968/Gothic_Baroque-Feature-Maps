import os
import re

import cv2
import numpy as np


def ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def safe_filename(name: str, keep_dots: bool = False) -> str:
    pattern = r"[^A-Za-z0-9._-]" if keep_dots else r"[^A-Za-z0-9_-]"
    cleaned = re.sub(pattern, "_", name)
    return cleaned.strip("._") or "file"


def save_array_image(arr: np.ndarray, output_path: str) -> str:
    ensure_dir(os.path.dirname(output_path))
    cv2.imwrite(output_path, arr)
    return output_path
