"use client";

import React, { useRef, useEffect, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ThreeSceneProps {
  /** URL of the GLB model to load. Null = show empty scene. */
  modelUrl: string | null;
}

// ---------------------------------------------------------------------------
// Component: ThreeScene
// Initializes a Three.js canvas with lighting, orbit controls, and GLB loading.
// Uses raw Three.js (not R3F) for full lifecycle control and DOM compatibility.
// ---------------------------------------------------------------------------
export default function ThreeScene({ modelUrl }: ThreeSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    animationId: number;
    currentModel: THREE.Group | null;
  } | null>(null);

  // -------------------------------------------------------------------------
  // Initialize Three.js scene (runs once on mount)
  // -------------------------------------------------------------------------
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // --- Renderer ---
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // --- Scene ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0f);

    // --- Camera ---
    const aspect = container.clientWidth / container.clientHeight;
    const camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
    camera.position.set(0, 1.5, 4);

    // --- Lighting ---
    // Ambient fill
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    // Key light (directional)
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(5, 8, 5);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // Rim light from behind
    const rimLight = new THREE.DirectionalLight(0x8888ff, 0.6);
    rimLight.position.set(-3, 2, -5);
    scene.add(rimLight);

    // --- Grid helper for visual grounding ---
    const grid = new THREE.GridHelper(10, 20, 0x222233, 0x111122);
    scene.add(grid);

    // --- OrbitControls ---
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 0.5, 0);
    controls.update();

    // --- Animation loop ---
    const animate = () => {
      const id = requestAnimationFrame(animate);
      if (sceneRef.current) {
        sceneRef.current.animationId = id;
      }
      controls.update();
      renderer.render(scene, camera);
    };
    const animationId = requestAnimationFrame(animate);

    // --- Resize handler ---
    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    // Store refs for cleanup and model loading
    sceneRef.current = {
      renderer,
      scene,
      camera,
      controls,
      animationId,
      currentModel: null,
    };

    // --- Cleanup on unmount ---
    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(sceneRef.current?.animationId ?? animationId);
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      sceneRef.current = null;
    };
  }, []);

  // -------------------------------------------------------------------------
  // Load / swap GLB model when modelUrl changes
  // -------------------------------------------------------------------------
  const loadModel = useCallback((url: string) => {
    const ctx = sceneRef.current;
    if (!ctx) return;

    const loader = new GLTFLoader();
    loader.load(
      url,
      (gltf) => {
        // Remove previous model if any
        if (ctx.currentModel) {
          ctx.scene.remove(ctx.currentModel);
          // Dispose geometries and materials to free GPU memory
          ctx.currentModel.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.geometry.dispose();
              if (Array.isArray(child.material)) {
                child.material.forEach((m) => m.dispose());
              } else {
                child.material.dispose();
              }
            }
          });
        }

        const model = gltf.scene;

        // Auto-center and scale model to fit view
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 2 / maxDim;
        model.scale.setScalar(scale);
        model.position.sub(center.multiplyScalar(scale));

        ctx.scene.add(model);
        ctx.currentModel = model;

        // Reset camera target to model center
        ctx.controls.target.set(0, size.y * scale * 0.5, 0);
        ctx.controls.update();
      },
      undefined, // progress callback (unused)
      (error) => {
        console.error("[ThreeScene] GLB load error:", error);
      }
    );
  }, []);

  // React to modelUrl prop changes
  useEffect(() => {
    if (modelUrl) {
      loadModel(modelUrl);
    }
  }, [modelUrl, loadModel]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full min-h-[400px] rounded-xl overflow-hidden bg-[var(--bg-secondary)]"
      aria-label="3D model viewer"
    />
  );
}
