import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const MAP_KEYS = [
  "original",
  "edge_map",
  "shadow_depth_map",
  "flow_map",
  "node_map",
  "density_map",
  "symmetry_asymmetry_map",
  "deformation_map",
  "composite_map",
];

function mapLabel(key) {
  return key.replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

export default function ThreeMapViewer({ maps, apiBase }) {
  const mountRef = useRef(null);

  useEffect(() => {
    if (!mountRef.current || !maps) return;

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#f6f2e6");

    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 100);
    camera.position.set(0, 1.5, 4.8);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mountRef.current.innerHTML = "";
    mountRef.current.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0.8, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const light = new THREE.DirectionalLight(0xfff7e0, 0.8);
    light.position.set(3, 5, 4);
    scene.add(light);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 10),
      new THREE.MeshStandardMaterial({ color: "#ddd5c1", roughness: 1.0 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    scene.add(ground);

    const loader = new THREE.TextureLoader();
    const group = new THREE.Group();
    scene.add(group);

    const radius = 1.85;
    const availableKeys = MAP_KEYS.filter((key) => Boolean(maps[key]));
    availableKeys.forEach((key, idx) => {
      const url = `${apiBase}/api/download/file?path=${encodeURIComponent(maps[key])}`;
      const theta = (idx / availableKeys.length) * Math.PI * 2;
      const x = Math.cos(theta) * radius;
      const z = Math.sin(theta) * radius;
      const y = 1.0;

      const texture = loader.load(url);
      texture.colorSpace = THREE.SRGBColorSpace;
      const panel = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshStandardMaterial({ map: texture, side: THREE.DoubleSide, roughness: 0.92, metalness: 0.02 })
      );
      panel.position.set(x, y, z);
      panel.lookAt(0, y, 0);
      group.add(panel);

      const labelCanvas = document.createElement("canvas");
      labelCanvas.width = 512;
      labelCanvas.height = 96;
      const ctx = labelCanvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#f9f6ee";
        ctx.fillRect(0, 0, labelCanvas.width, labelCanvas.height);
        ctx.fillStyle = "#222";
        ctx.font = "600 34px 'Segoe UI'";
        ctx.fillText(mapLabel(key), 20, 58);
      }

      const labelTex = new THREE.CanvasTexture(labelCanvas);
      const label = new THREE.Mesh(
        new THREE.PlaneGeometry(0.9, 0.16),
        new THREE.MeshBasicMaterial({ map: labelTex, transparent: false })
      );
      label.position.set(x, y - 0.66, z);
      label.lookAt(0, y - 0.66, 0);
      group.add(label);
    });

    let stopped = false;
    const animate = () => {
      if (stopped) return;
      controls.update();
      group.rotation.y += 0.0016;
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };
    animate();

    const onResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      stopped = true;
      window.removeEventListener("resize", onResize);
      controls.dispose();
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj.isMesh) {
          obj.geometry?.dispose?.();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose?.());
          } else {
            obj.material?.dispose?.();
          }
        }
      });
    };
  }, [maps, apiBase]);

  return <div className="threeCanvas" ref={mountRef} />;
}
