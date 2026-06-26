"use client";

import React, { useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

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
  backgroundColor: string;
  previewAspectRatio: number;
  onModelLoad?: () => void;
  onModelError?: (message: string) => void;
}

/** Methods exposed to parent via ref */
export interface ThreeSceneHandle {
  /** Get the underlying canvas element for video capture */
  getCanvas: () => HTMLCanvasElement | null;
  /** Export current model as OBJ text. Returns null if no model loaded. */
  exportOBJ: () => string | null;
  prepareVideoCapture: (width: number, height: number) => void;
  restoreViewerSize: () => void;
}

interface SceneContext {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  currentModel: THREE.Group | null;
  dirLight: THREE.DirectionalLight;
  shadowPlane: THREE.Mesh;
  isCapturing: boolean;
  animation: AnimationSettings;
  modelSize: THREE.Vector3 | null;
  captureCameraState: {
    position: THREE.Vector3;
    target: THREE.Vector3;
    near: number;
    far: number;
  } | null;
}

function fitCameraToModel(ctx: SceneContext, padding = 1.28) {
  if (!ctx.modelSize) return;

  const halfVerticalFov = THREE.MathUtils.degToRad(ctx.camera.fov / 2);
  const halfHorizontalFov = Math.atan(Math.tan(halfVerticalFov) * ctx.camera.aspect);
  const halfRotatingWidth = Math.hypot(ctx.modelSize.x, ctx.modelSize.z) / 2;
  const halfHeight = ctx.modelSize.y / 2;
  const fitWidth = halfRotatingWidth / Math.tan(halfHorizontalFov);
  const fitHeight = halfHeight / Math.tan(halfVerticalFov);
  const distance = Math.max(fitWidth, fitHeight) * padding;
  const direction = ctx.camera.position.clone().sub(ctx.controls.target).normalize();

  ctx.camera.position.copy(ctx.controls.target).add(direction.multiplyScalar(distance));
  ctx.camera.near = Math.max(distance / 100, 0.01);
  ctx.camera.far = distance * 100;
  ctx.camera.updateProjectionMatrix();
  ctx.controls.update();
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
  function ThreeScene({ modelUrl, lighting, animation, backgroundColor, previewAspectRatio, onModelLoad, onModelError }, ref) {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<SceneContext | null>(null);
    const handleResizeRef = useRef<(() => void) | null>(null);
    const previewAspectRatioRef = useRef(previewAspectRatio);

    useEffect(() => {
      previewAspectRatioRef.current = previewAspectRatio;
    }, [previewAspectRatio]);

  // -------------------------------------------------------------------------
  // Initialize Three.js scene (runs once on mount)
  // -------------------------------------------------------------------------
  useEffect(() => {
    const container = containerRef.current;
    const wrapper = wrapperRef.current;
    if (!container || !wrapper) return;

    // --- Renderer ---
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Determine initial dimensions
    const W_wrapper = wrapper.clientWidth;
    const H_wrapper = wrapper.clientHeight;
    let initW = W_wrapper || 300;
    let initH = H_wrapper || 300;
    if (W_wrapper && H_wrapper) {
      if (W_wrapper / H_wrapper > previewAspectRatioRef.current) {
        initH = H_wrapper;
        initW = H_wrapper * previewAspectRatioRef.current;
      } else {
        initW = W_wrapper;
        initH = W_wrapper / previewAspectRatioRef.current;
      }
    }
    container.style.width = `${initW}px`;
    container.style.height = `${initH}px`;
    renderer.setSize(initW, initH);

    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    // Shadow mapping
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // --- Scene ---
    const scene = new THREE.Scene();
    scene.background = backgroundColor === "transparent" ? null : new THREE.Color(backgroundColor);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const environmentTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = environmentTarget.texture;
    scene.environmentIntensity = 1.1;
    pmremGenerator.dispose();

    // --- Camera ---
    const aspect = initW / initH;
    const camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
    camera.position.set(0, 1.5, 4);

    // --- Lighting ---
    const ambientLight = new THREE.HemisphereLight(0xffffff, 0x64748b, 1.4);
    scene.add(ambientLight);

    // Key light (directional) — configurable via props
    const dirLight = new THREE.DirectionalLight(0xffffff, 3);
    dirLight.position.set(5, 8, 5);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 50;
    dirLight.shadow.camera.left = -5;
    dirLight.shadow.camera.right = 5;
    dirLight.shadow.camera.top = 5;
    dirLight.shadow.camera.bottom = -5;
    dirLight.shadow.bias = -0.0005;
    dirLight.shadow.normalBias = 0.03;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0xc7d2fe, 1.6);
    fillLight.position.set(-5, 4, 4);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 2);
    rimLight.position.set(3, 5, -5);
    scene.add(rimLight);

    // --- Shadow-receiving floor plane ---
    const shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.ShadowMaterial({ opacity: 0.16, depthWrite: false })
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -0.002;
    shadowPlane.receiveShadow = true;
    shadowPlane.visible = false; // hidden until shadow toggle is on
    scene.add(shadowPlane);

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
      const ctx = sceneRef.current;
      const delta = clock.getDelta();
      if (ctx?.animation.autoRotate && ctx.currentModel) {
        ctx.currentModel.rotation.y += ctx.animation.rotationSpeed * delta;
      }
      controls.update();
      renderer.render(scene, camera);
    };
    renderer.setAnimationLoop(animate);

    const handleResize = () => {
      const ctx = sceneRef.current;
      if (!ctx || ctx.isCapturing) return;
      const currentWrapper = wrapperRef.current;
      const currentContainer = containerRef.current;
      if (!currentWrapper || !currentContainer) return;

      const W_wrap = currentWrapper.clientWidth;
      const H_wrap = currentWrapper.clientHeight;
      if (!W_wrap || !H_wrap) return;

      const ratio = previewAspectRatioRef.current;
      let w = W_wrap;
      let h = H_wrap;

      if (W_wrap / H_wrap > ratio) {
        h = H_wrap;
        w = H_wrap * ratio;
      } else {
        w = W_wrap;
        h = W_wrap / ratio;
      }

      currentContainer.style.width = `${w}px`;
      currentContainer.style.height = `${h}px`;

      ctx.camera.aspect = w / h;
      ctx.camera.updateProjectionMatrix();
      ctx.renderer.setSize(w, h);
      fitCameraToModel(ctx);
    };

    handleResizeRef.current = handleResize;

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(wrapper);

    // Store refs for cleanup and model loading
    sceneRef.current = {
      renderer,
      scene,
      camera,
      controls,
      currentModel: null,
      dirLight,
      shadowPlane,
      isCapturing: false,
      animation,
      modelSize: null,
      captureCameraState: null,
    };

    // --- Cleanup on unmount ---
    return () => {
      resizeObserver.disconnect();
      renderer.setAnimationLoop(null);
      if (sceneRef.current?.currentModel) {
        disposeModel(sceneRef.current.currentModel);
      }
      controls.dispose();
      shadowPlane.geometry.dispose();
      (shadowPlane.material as THREE.Material).dispose();
      environmentTarget.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      sceneRef.current = null;
      handleResizeRef.current = null;
    };
  }, []);

  useEffect(() => {
    const ctx = sceneRef.current;
    if (ctx) ctx.animation = animation;
  }, [animation]);

  useEffect(() => {
    handleResizeRef.current?.();
  }, [previewAspectRatio]);

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

  useEffect(() => {
    const ctx = sceneRef.current;
    if (ctx) ctx.scene.background = backgroundColor === "transparent" ? null : new THREE.Color(backgroundColor);
  }, [backgroundColor]);

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

        const scale = 2.4 / maxDim;
        model.scale.setScalar(scale);
        model.position.set(
          -center.x * scale,
          -box.min.y * scale,
          -center.z * scale
        );

        const pivot = new THREE.Group();
        pivot.add(model);

        // Enable shadow casting on all meshes
        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        ctx.scene.add(pivot);
        ctx.currentModel = pivot;

        const scaledHeight = size.y * scale;
        ctx.modelSize = new THREE.Vector3(size.x, size.y, size.z).multiplyScalar(scale);
        const target = new THREE.Vector3(0, scaledHeight * 0.48, 0);
        const viewDirection = new THREE.Vector3(0.65, 0.28, 1).normalize();

        ctx.camera.position.copy(target).add(viewDirection);
        ctx.controls.target.copy(target);
        fitCameraToModel(ctx);
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
      prepareVideoCapture: (width: number, height: number) => {
        const ctx = sceneRef.current;
        if (!ctx) return;

        ctx.isCapturing = true;
        ctx.captureCameraState = {
          position: ctx.camera.position.clone(),
          target: ctx.controls.target.clone(),
          near: ctx.camera.near,
          far: ctx.camera.far,
        };
        ctx.renderer.setPixelRatio(1);
        ctx.renderer.setSize(width, height, false);
        ctx.camera.aspect = width / height;
        fitCameraToModel(ctx);
        ctx.renderer.render(ctx.scene, ctx.camera);
      },
      restoreViewerSize: () => {
        const ctx = sceneRef.current;
        const container = containerRef.current;
        if (!ctx || !container) return;

        ctx.isCapturing = false;
        ctx.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        ctx.renderer.setSize(container.clientWidth, container.clientHeight);
        if (ctx.captureCameraState) {
          ctx.camera.position.copy(ctx.captureCameraState.position);
          ctx.controls.target.copy(ctx.captureCameraState.target);
          ctx.camera.near = ctx.captureCameraState.near;
          ctx.camera.far = ctx.captureCameraState.far;
          ctx.captureCameraState = null;
        }
        ctx.camera.aspect = container.clientWidth / container.clientHeight;
        ctx.camera.updateProjectionMatrix();
        ctx.controls.update();
      },
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
        ref={wrapperRef}
        className="flex h-full min-h-0 w-full items-center justify-center overflow-hidden rounded-xl bg-black/30"
      >
        <div
          ref={containerRef}
          className="overflow-hidden rounded-lg bg-[var(--bg-secondary)]"
          aria-label="3D model viewer"
        />
      </div>
    );
  }
);

export default ThreeScene;
