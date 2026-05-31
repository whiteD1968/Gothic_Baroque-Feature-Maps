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
        export_format: str = "png",
        palette_colors: int = 4,
        blend_a: str = "edge_map",
        blend_b: str = "density_map",
        blend_c: str = "flow_map",
        blend_weight_a: float = 0.5,
        blend_weight_b: float = 0.3,
        blend_weight_c: float = 0.2,
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
        quantized_map = self._quantized_palette_map(composite, palette_colors)

        symmetry_score, symmetry_map = self._symmetry_map(gray_blur)
        deformation_map = self._deformation_map(gray_blur, edge, flow)

        stats = FeatureStats(
            edge_ratio=float(np.mean(edge > 0)),
            node_count=node_count,
            density_mean=float(np.mean(density_map) / 255.0),
            symmetry_score=symmetry_score,
            flow_strength=float(np.mean(mag) / 255.0),
        )

        ext = "jpg" if export_format.lower() in ["jpg", "jpeg"] else "png"
        map_arrays: Dict[str, np.ndarray] = {
            "original": bgr,
            "edge_map": edge,
            "shadow_depth_map": depth,
            "flow_map": flow,
            "node_map": node_map,
            "density_map": density_map,
            "symmetry_asymmetry_map": symmetry_map,
            "deformation_map": deformation_map,
            "composite_map": composite,
            "palette_quantized_map": quantized_map,
        }
        combinator_map = self._combinator_map(
            map_arrays,
            blend_a,
            blend_b,
            blend_c,
            blend_weight_a,
            blend_weight_b,
            blend_weight_c,
        )
        map_arrays["combinator_map"] = combinator_map
        paths = {key: save_array_image(value, os.path.join(out_dir, f"{key}.{ext}")) for key, value in map_arrays.items()}

        description = self._description(stats, tag)
        prompt_pack = self._midjourney_prompt_pack(
            tag=tag,
            description=description,
            blend_a=blend_a,
            blend_b=blend_b,
            blend_c=blend_c,
            blend_weight_a=blend_weight_a,
            blend_weight_b=blend_weight_b,
            blend_weight_c=blend_weight_c,
            palette_colors=palette_colors,
        )

        return {
            "original_name": original_name,
            "tag": tag,
            "maps": paths,
            "description": description,
            "midjourney": prompt_pack,
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

    def _symmetry_map(self, gray: np.ndarray):
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
        diff_norm = cv2.normalize(diff, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)

        map_canvas = np.zeros_like(gray, dtype=np.uint8)
        map_canvas[:, : left.shape[1]] = diff_norm
        map_canvas[:, w - left.shape[1] :] = cv2.flip(diff_norm, 1)

        score = float(1.0 - (np.mean(diff) / 255.0))
        return score, map_canvas

    def _deformation_map(self, gray: np.ndarray, edge: np.ndarray, flow: np.ndarray) -> np.ndarray:
        blur_large = cv2.GaussianBlur(gray, (0, 0), 5)
        high_pass = cv2.absdiff(gray, blur_large)
        flow_gray = cv2.cvtColor(flow, cv2.COLOR_BGR2GRAY)
        edge_soft = cv2.GaussianBlur(edge, (7, 7), 0)
        mixed = cv2.addWeighted(high_pass, 0.5, flow_gray, 0.35, 0)
        mixed = cv2.addWeighted(mixed, 0.85, edge_soft, 0.25, 0)
        return cv2.normalize(mixed, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)

    def _description(self, stats: FeatureStats, tag: str) -> str:
        verticality = "high" if stats.edge_ratio > 0.14 else "moderate"
        complexity = "dense" if stats.density_mean > 0.26 else "restrained"
        convergence = "strong" if stats.node_count > 120 else "moderate"
        symmetry = "pronounced" if stats.symmetry_score > 0.7 else "asymmetric"
        motion = "dynamic curvature" if stats.flow_strength > 0.22 else "measured directional flow"
        return (
            f"Behavioral extraction (not style imitation): {tag} source with {verticality} vertical thrust, "
            f"{convergence} node intersections, {complexity} ornament density shifts, {symmetry} symmetry behavior, "
            f"and {motion}."
        )

    def _quantized_palette_map(self, image_bgr: np.ndarray, palette_colors: int) -> np.ndarray:
        color_count = max(3, min(8, int(palette_colors)))
        pixels = image_bgr.reshape((-1, 3)).astype(np.float32)
        criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 24, 0.8)
        _, labels, centers = cv2.kmeans(
            pixels,
            color_count,
            None,
            criteria,
            8,
            cv2.KMEANS_PP_CENTERS,
        )
        centers_u8 = np.uint8(centers)
        reduced = centers_u8[labels.flatten()].reshape(image_bgr.shape)
        return reduced

    def _ensure_color(self, arr: np.ndarray) -> np.ndarray:
        if len(arr.shape) == 2:
            return cv2.cvtColor(arr, cv2.COLOR_GRAY2BGR)
        return arr

    def _combinator_map(
        self,
        maps: Dict[str, np.ndarray],
        blend_a: str,
        blend_b: str,
        blend_c: str,
        blend_weight_a: float,
        blend_weight_b: float,
        blend_weight_c: float,
    ) -> np.ndarray:
        keys = list(maps.keys())
        key_a = blend_a if blend_a in maps else "edge_map"
        key_b = blend_b if blend_b in maps else "density_map"
        key_c = blend_c if blend_c in maps else "flow_map"

        a = self._ensure_color(maps[key_a]).astype(np.float32)
        b = self._ensure_color(maps[key_b]).astype(np.float32)
        c = self._ensure_color(maps[key_c]).astype(np.float32)

        wa = max(0.0, float(blend_weight_a))
        wb = max(0.0, float(blend_weight_b))
        wc = max(0.0, float(blend_weight_c))
        total = wa + wb + wc
        if total <= 0.0:
            wa, wb, wc, total = 1.0, 1.0, 1.0, 3.0
        wa, wb, wc = wa / total, wb / total, wc / total

        combined = (a * wa) + (b * wb) + (c * wc)
        return np.clip(combined, 0, 255).astype(np.uint8)

    def _midjourney_prompt_pack(
        self,
        tag: str,
        description: str,
        blend_a: str,
        blend_b: str,
        blend_c: str,
        blend_weight_a: float,
        blend_weight_b: float,
        blend_weight_c: float,
        palette_colors: int,
    ) -> Dict[str, str]:
        short_prompt = (
            f"{tag} architectural behavior abstraction, non-literal form transfer, "
            f"{palette_colors}-tone structural palette, high spatial rhythm"
        )
        long_prompt = (
            f"{description} Use abstract geometry from {blend_a}, {blend_b}, and {blend_c} with weight balance "
            f"{blend_weight_a:.2f}/{blend_weight_b:.2f}/{blend_weight_c:.2f}. Prioritize emergent composition over "
            "historical imitation, material ambiguity, and tectonic depth."
        )
        params = "--ar 4:5 --stylize 275 --chaos 18 --iw 1.35 --quality 1"
        full_prompt = f"{short_prompt}. {long_prompt} {params}"
        return {
            "short_prompt": short_prompt,
            "long_prompt": long_prompt,
            "params": params,
            "full_prompt": full_prompt,
        }
