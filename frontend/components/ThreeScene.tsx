"use client";

import React, { useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface LightingSettings {
  posX: number;
  posY: number;
  posZ: number;
  intensity: number;
  shadowEnabled: boolean;
}

export interface AnimationSettings {
  autoRotate: boolean;
  rotationSpeed: number; // radians per second
}

interface ThreeSceneProps {
  /** URL of the GLB model to load. Null = show empty scene. */
  modelUrl: string | null;
  /** Lighting configuration */
  lighting: LightingSettings;
  /** Animation configuration */
  animation: AnimationSettings;
  onModelLoad?: () => void;
  onModelError?: (message: string) => void;
}

/** Methods exposed to parent via ref */
export interface ThreeSceneHandle {
  /** Get the underlying canvas element for video capture */
  getCanvas: () => HTMLCanvasElement | null;
  /** Export current model as OBJ text. Returns null if no model loaded. */
  exportOBJ: () => string | null;
}

function disposeModel(model: THREE.Object3D) {
  model.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;

    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      Object.values(material).forEach((value) => {
        if (value instanceof THREE.Texture) value.dispose();
      });
      material.dispose();
    });
  });
}

// ---------------------------------------------------------------------------
// Component: ThreeScene
// Initializes a Three.js canvas with lighting, orbit controls, and GLB loading.
// Uses raw Three.js (not R3F) for full lifecycle control and DOM compatibility.
// ---------------------------------------------------------------------------
const ThreeScene = forwardRef<ThreeSceneHandle, ThreeSceneProps>(
  function ThreeScene({ modelUrl, lighting, animation, onModelLoad, onModelError }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<{
      renderer: THREE.WebGLRenderer;
      scene: THREE.Scene;
      camera: THREE.PerspectiveCamera;
      controls: OrbitControls;
      animationId: number;
      currentModel: THREE.Group | null;
      dirLight: THREE.DirectionalLight;
      shadowPlane: THREE.Mesh;
      clock: THREE.Clock;
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
    // Shadow mapping
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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

    // Key light (directional) — configurable via props
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(5, 8, 5);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 50;
    dirLight.shadow.camera.left = -5;
    dirLight.shadow.camera.right = 5;
    dirLight.shadow.camera.top = 5;
    dirLight.shadow.camera.bottom = -5;
    scene.add(dirLight);

    // Rim light from behind
    const rimLight = new THREE.DirectionalLight(0x8888ff, 0.6);
    rimLight.position.set(-3, 2, -5);
    scene.add(rimLight);

    // --- Shadow-receiving floor plane ---
    const shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.ShadowMaterial({ opacity: 0.35 })
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = 0;
    shadowPlane.receiveShadow = true;
    shadowPlane.visible = false; // hidden until shadow toggle is on
    scene.add(shadowPlane);

    // --- Grid helper for visual grounding ---
    const grid = new THREE.GridHelper(10, 20, 0x222233, 0x111122);
    scene.add(grid);

    // --- OrbitControls ---
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 0.5, 0);
    controls.update();

    // --- Clock for delta time ---
    const clock = new THREE.Clock();

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
      dirLight,
      shadowPlane,
      clock,
    };

    // --- Cleanup on unmount ---
    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(sceneRef.current?.animationId ?? animationId);
      if (sceneRef.current?.currentModel) {
        disposeModel(sceneRef.current.currentModel);
      }
      controls.dispose();
      shadowPlane.geometry.dispose();
      (shadowPlane.material as THREE.Material).dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      sceneRef.current = null;
    };
  }, []);

  // -------------------------------------------------------------------------
  // Auto-rotate: apply rotation each frame based on animation settings
  // -------------------------------------------------------------------------
  useEffect(() => {
    const ctx = sceneRef.current;
    if (!ctx) return;

    let rafId: number;
    const rotateLoop = () => {
      rafId = requestAnimationFrame(rotateLoop);
      if (animation.autoRotate && ctx.currentModel) {
        const delta = ctx.clock.getDelta();
        ctx.currentModel.rotation.y += animation.rotationSpeed * delta;
      } else {
        // Reset clock so delta doesn't accumulate while paused
        ctx.clock.getDelta();
      }
    };
    rotateLoop();

    return () => cancelAnimationFrame(rafId);
  }, [animation.autoRotate, animation.rotationSpeed]);

  // -------------------------------------------------------------------------
  // Lighting: update directional light position & intensity from props
  // -------------------------------------------------------------------------
  useEffect(() => {
    const ctx = sceneRef.current;
    if (!ctx) return;

    ctx.dirLight.position.set(lighting.posX, lighting.posY, lighting.posZ);
    ctx.dirLight.intensity = lighting.intensity;
    ctx.dirLight.castShadow = lighting.shadowEnabled;
    ctx.shadowPlane.visible = lighting.shadowEnabled;
  }, [lighting.posX, lighting.posY, lighting.posZ, lighting.intensity, lighting.shadowEnabled]);

  // Load / swap GLB model when modelUrl changes
  useEffect(() => {
    const ctx = sceneRef.current;
    if (!ctx || !modelUrl) return;

    let cancelled = false;

    const loader = new GLTFLoader();
    loader.load(
      modelUrl,
      (gltf) => {
        if (cancelled) {
          disposeModel(gltf.scene);
          return;
        }

        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);

        if (box.isEmpty() || !Number.isFinite(maxDim) || maxDim <= 0) {
          disposeModel(model);
          onModelError?.("Model GLB tidak memiliki geometri yang dapat ditampilkan.");
          return;
        }

        if (ctx.currentModel) {
          ctx.scene.remove(ctx.currentModel);
          disposeModel(ctx.currentModel);
        }

        const scale = 2 / maxDim;
        model.scale.setScalar(scale);
        model.position.sub(center.multiplyScalar(scale));

        // Enable shadow casting on all meshes
        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        ctx.scene.add(model);
        ctx.currentModel = model;

        // Reset camera target to model center
        ctx.controls.target.set(0, size.y * scale * 0.5, 0);
        ctx.controls.update();
        onModelLoad?.();
      },
      undefined,
      (error) => {
        if (cancelled) return;
        console.error("[ThreeScene] GLB load error:", error);
        onModelError?.("Model GLB gagal dibaca. Pastikan file tidak rusak.");
      }
    );

    return () => {
      cancelled = true;
    };
  }, [modelUrl, onModelError, onModelLoad]);

    // Expose canvas element and OBJ exporter to parent
    useImperativeHandle(ref, () => ({
      getCanvas: () => sceneRef.current?.renderer.domElement ?? null,
      exportOBJ: (): string | null => {
        const ctx = sceneRef.current;
        if (!ctx?.currentModel) return null;

        const lines: string[] = ["# SnapTo3D OBJ Export", `# Generated: ${new Date().toISOString()}`, ""];
        let vertexOffset = 0;

        ctx.currentModel.traverse((child) => {
          if (!(child instanceof THREE.Mesh)) return;
          const geo = child.geometry;
          const pos = geo.getAttribute("position");
          const idx = geo.index;

          if (!pos) return;

          // Apply world transform to vertices
          const matrix = child.matrixWorld;
          const vertex = new THREE.Vector3();

          lines.push(`o ${child.name || "mesh"}`);

          // Write vertices
          for (let i = 0; i < pos.count; i++) {
            vertex.fromBufferAttribute(pos, i);
            vertex.applyMatrix4(matrix);
            lines.push(`v ${vertex.x.toFixed(6)} ${vertex.y.toFixed(6)} ${vertex.z.toFixed(6)}`);
          }

          // Write faces
          if (idx) {
            for (let i = 0; i < idx.count; i += 3) {
              const a = idx.getX(i) + 1 + vertexOffset;
              const b = idx.getX(i + 1) + 1 + vertexOffset;
              const c = idx.getX(i + 2) + 1 + vertexOffset;
              lines.push(`f ${a} ${b} ${c}`);
            }
          } else {
            for (let i = 0; i < pos.count; i += 3) {
              const a = i + 1 + vertexOffset;
              const b = i + 2 + vertexOffset;
              const c = i + 3 + vertexOffset;
              lines.push(`f ${a} ${b} ${c}`);
            }
          }

          vertexOffset += pos.count;
          lines.push("");
        });

        return lines.join("\n");
      },
    }));

    return (
      <div
        ref={containerRef}
        className="w-full h-full min-h-[400px] rounded-xl overflow-hidden bg-[var(--bg-secondary)]"
        aria-label="3D model viewer"
      />
    );
  }
);

export default ThreeScene;
