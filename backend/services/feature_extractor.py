import os
from dataclasses import dataclass
from typing import Dict, Any

import cv2
import numpy as np

from utils.io_helpers import save_array_image


@dataclass
class FeatureStats:
    edge_ratio: float
    node_count: int
    density_mean: float
    symmetry_score: float
    flow_strength: float


class FeatureExtractor:
    def process_image(
        self,
        image_bytes: bytes,
        out_dir: str,
        edge_threshold_low: int,
        edge_threshold_high: int,
        density_kernel: int,
        tag: str,
        original_name: str,
    ) -> Dict[str, Any]:
        arr = np.frombuffer(image_bytes, dtype=np.uint8)
        bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if bgr is None:
            raise ValueError("Could not decode image")

        gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
        gray_blur = cv2.GaussianBlur(gray, (5, 5), 0)

        edge = cv2.Canny(gray_blur, edge_threshold_low, edge_threshold_high)

        grad_x = cv2.Sobel(gray_blur, cv2.CV_32F, 1, 0, ksize=3)
        grad_y = cv2.Sobel(gray_blur, cv2.CV_32F, 0, 1, ksize=3)
        mag = cv2.magnitude(grad_x, grad_y)
        angle = cv2.phase(grad_x, grad_y, angleInDegrees=True)
        flow = self._build_flow_map(mag, angle)

        depth = self._local_variance(gray_blur, window=15)

        node_map, node_count = self._node_map(edge)

        density_map = self._density_map(edge, density_kernel)

        composite = self._composite_map(edge, depth, flow, density_map)

        symmetry_score = self._symmetry(gray_blur)

        stats = FeatureStats(
            edge_ratio=float(np.mean(edge > 0)),
            node_count=node_count,
            density_mean=float(np.mean(density_map) / 255.0),
            symmetry_score=symmetry_score,
            flow_strength=float(np.mean(mag) / 255.0),
        )

        paths = {
            "original": save_array_image(bgr, os.path.join(out_dir, "original.png")),
            "edge_map": save_array_image(edge, os.path.join(out_dir, "edge_map.png")),
            "shadow_depth_map": save_array_image(depth, os.path.join(out_dir, "shadow_depth_map.png")),
            "flow_map": save_array_image(flow, os.path.join(out_dir, "flow_map.png")),
            "node_map": save_array_image(node_map, os.path.join(out_dir, "node_map.png")),
            "density_map": save_array_image(density_map, os.path.join(out_dir, "density_map.png")),
            "composite_map": save_array_image(composite, os.path.join(out_dir, "composite_map.png")),
        }

        description = self._description(stats, tag)

        return {
            "original_name": original_name,
            "tag": tag,
            "maps": paths,
            "description": description,
            "metrics": {
                "edge_ratio": round(stats.edge_ratio, 4),
                "node_count": stats.node_count,
                "density_mean": round(stats.density_mean, 4),
                "symmetry_score": round(stats.symmetry_score, 4),
                "flow_strength": round(stats.flow_strength, 4),
            },
        }

    def _local_variance(self, gray: np.ndarray, window: int = 15) -> np.ndarray:
        gray_f = gray.astype(np.float32)
        mean = cv2.blur(gray_f, (window, window))
        mean_sq = cv2.blur(gray_f ** 2, (window, window))
        variance = np.clip(mean_sq - mean ** 2, 0, None)
        variance = cv2.normalize(variance, None, 0, 255, cv2.NORM_MINMAX)
        return variance.astype(np.uint8)

    def _build_flow_map(self, magnitude: np.ndarray, angle: np.ndarray) -> np.ndarray:
        mag_norm = cv2.normalize(magnitude, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
        hue = ((angle / 2) % 180).astype(np.uint8)
        sat = np.full_like(hue, 180)
        val = np.clip(mag_norm, 0, 255)
        hsv = cv2.merge([hue, sat, val])
        return cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)

    def _node_map(self, edge: np.ndarray):
        intersections = cv2.dilate(edge, np.ones((3, 3), np.uint8), iterations=1)
        intersections = cv2.erode(intersections, np.ones((3, 3), np.uint8), iterations=1)
        corners = cv2.goodFeaturesToTrack(intersections, maxCorners=800, qualityLevel=0.01, minDistance=4)

        canvas = np.zeros_like(edge)
        count = 0
        if corners is not None:
            for pt in corners:
                x, y = pt.ravel().astype(int)
                cv2.circle(canvas, (x, y), 2, 255, -1)
                count += 1
        return canvas, count

    def _density_map(self, edge: np.ndarray, kernel: int) -> np.ndarray:
        kernel_mat = np.ones((kernel, kernel), np.uint8)
        density = cv2.filter2D((edge > 0).astype(np.float32), -1, kernel_mat)
        density = cv2.normalize(density, None, 0, 255, cv2.NORM_MINMAX)
        return density.astype(np.uint8)

    def _composite_map(self, edge: np.ndarray, depth: np.ndarray, flow: np.ndarray, density: np.ndarray) -> np.ndarray:
        edge_col = cv2.cvtColor(edge, cv2.COLOR_GRAY2BGR)
        depth_col = cv2.cvtColor(depth, cv2.COLOR_GRAY2BGR)
        density_col = cv2.cvtColor(density, cv2.COLOR_GRAY2BGR)
        composite = cv2.addWeighted(edge_col, 0.40, depth_col, 0.25, 0)
        composite = cv2.addWeighted(composite, 0.75, flow, 0.45, 0)
        composite = cv2.addWeighted(composite, 0.80, density_col, 0.25, 0)
        return composite

    def _symmetry(self, gray: np.ndarray) -> float:
        h, w = gray.shape
        mid = w // 2
        left = gray[:, :mid]
        right = gray[:, w - mid :]
        right_mirror = cv2.flip(right, 1)
        if left.shape != right_mirror.shape:
            min_w = min(left.shape[1], right_mirror.shape[1])
            left = left[:, :min_w]
            right_mirror = right_mirror[:, :min_w]
        diff = cv2.absdiff(left, right_mirror)
        return float(1.0 - (np.mean(diff) / 255.0))

    def _description(self, stats: FeatureStats, tag: str) -> str:
        verticality = "high" if stats.edge_ratio > 0.14 else "moderate"
        complexity = "dense" if stats.density_mean > 0.26 else "restrained"
        convergence = "strong" if stats.node_count > 120 else "moderate"
        symmetry = "pronounced" if stats.symmetry_score > 0.7 else "asymmetric"
        motion = "dynamic curvature" if stats.flow_strength > 0.22 else "measured directional flow"
        return (
            f"{tag} reference with {verticality} linear thrust, {complexity} ornament concentration, "
            f"{convergence} node intersections, {symmetry} bilateral symmetry, and {motion}."
        )
