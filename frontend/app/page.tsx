"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import UploadZone from "@/components/UploadZone";
import ModelUploadZone from "@/components/ModelUploadZone";
import ThreeScene from "@/components/ThreeScene";
import type { LightingSettings, AnimationSettings, ThreeSceneHandle } from "@/components/ThreeScene";
import LightingControls from "@/components/LightingControls";
import AnimationControls from "@/components/AnimationControls";
import type { VideoAspectRatio, VideoResolution } from "@/components/AnimationControls";
import BackgroundControls from "@/components/BackgroundControls";
import { useVideoExporter } from "@/hooks/useVideoExporter";
import type { VideoFormat } from "@/hooks/useVideoExporter";

// ---------------------------------------------------------------------------
// Default settings
// ---------------------------------------------------------------------------
const DEFAULT_LIGHTING: LightingSettings = {
  posX: 5,
  posY: 8,
  posZ: 5,
  intensity: 3,
  shadowEnabled: true,
};

const DEFAULT_ANIMATION: AnimationSettings = {
  autoRotate: false,
  rotationSpeed: 1.0,
};

type ModelStatus = "idle" | "loading" | "ready" | "error";

const VIDEO_SIZES: Record<VideoResolution, Record<VideoAspectRatio, { width: number; height: number }>> = {
  "720p": {
    "16:9": { width: 1280, height: 720 },
    "9:16": { width: 720, height: 1280 },
    "1:1": { width: 720, height: 720 },
    "4:5": { width: 720, height: 900 },
  },
  "1080p": {
    "16:9": { width: 1920, height: 1080 },
    "9:16": { width: 1080, height: 1920 },
    "1:1": { width: 1080, height: 1080 },
    "4:5": { width: 1080, height: 1350 },
  },
};

// ---------------------------------------------------------------------------
// Page: SnapTo3D Main Layout
// Left panel: upload zone + controls
// Right panel: 3D model viewer (Three.js canvas)
// Responsive: stacks vertically on mobile, side-by-side on desktop
// ---------------------------------------------------------------------------
export default function HomePage() {
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [modelName, setModelName] = useState<string | null>(null);
  const [modelStatus, setModelStatus] = useState<ModelStatus>("idle");
  const [modelError, setModelError] = useState<string | null>(null);
  const [lighting, setLighting] = useState<LightingSettings>(DEFAULT_LIGHTING);
  const [backgroundColor, setBackgroundColor] = useState("#e5e7eb");
  const [animation, setAnimation] = useState<AnimationSettings>(DEFAULT_ANIMATION);
  const [videoDuration, setVideoDuration] = useState(10);
  const [videoResolution, setVideoResolution] = useState<VideoResolution>("1080p");
  const [videoAspectRatio, setVideoAspectRatio] = useState<VideoAspectRatio>("16:9");
  const [videoFormat, setVideoFormat] = useState<VideoFormat>("auto");
  const videoSize = VIDEO_SIZES[videoResolution][videoAspectRatio];

  // Ref to access Three.js canvas for video capture
  const threeSceneRef = useRef<ThreeSceneHandle>(null);
  const localModelUrlRef = useRef<string | null>(null);

  // Video exporter hook
  const videoExporter = useVideoExporter({ duration: videoDuration, format: videoFormat });

  const releaseLocalModelUrl = useCallback(() => {
    if (localModelUrlRef.current) {
      URL.revokeObjectURL(localModelUrlRef.current);
      localModelUrlRef.current = null;
    }
  }, []);

  useEffect(() => releaseLocalModelUrl, [releaseLocalModelUrl]);

  const showModel = useCallback(
    (url: string, name: string, isLocalFile = false) => {
      releaseLocalModelUrl();
      if (isLocalFile) localModelUrlRef.current = url;
      setModelUrl(url);
      setModelName(name);
      setModelStatus("loading");
      setModelError(null);
    },
    [releaseLocalModelUrl]
  );

  const handleUploadComplete = useCallback((glbUrl: string) => {
    showModel(glbUrl, "snapto3d-model.glb");
  }, [showModel]);

  const handleModelSelected = useCallback((file: File) => {
    showModel(URL.createObjectURL(file), file.name, true);
  }, [showModel]);

  const handleModelLoad = useCallback(() => {
    setModelStatus("ready");
  }, []);

  const handleModelError = useCallback((message: string) => {
    setModelStatus("error");
    setModelError(message);
  }, []);

  /**
   * Load the stub model directly for dev/testing without uploading.
   */
  const handleLoadDemo = useCallback(() => {
    showModel("/static/sample.glb", "sample.glb");
  }, [showModel]);

  /**
   * Download the current GLB model file.
   */
  const handleDownloadGLB = useCallback(async () => {
    if (!modelUrl) return;
    try {
      const res = await fetch(modelUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = modelName ?? `snapto3d-model-${Date.now()}.glb`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[Download] Failed to download GLB:", err);
    }
  }, [modelName, modelUrl]);

  /**
   * Download the current model as OBJ file (client-side conversion).
   */
  const handleDownloadOBJ = useCallback(() => {
    if (!threeSceneRef.current) return;
    const objText = threeSceneRef.current.exportOBJ();
    if (!objText) return;

    const blob = new Blob([objText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `snapto3d-model-${Date.now()}.obj`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  /**
   * Start video recording from the Three.js canvas.
   */
  const handleRenderVideo = useCallback(() => {
    if (!threeSceneRef.current || modelStatus !== "ready") return;
    const getCanvas = () => threeSceneRef.current?.getCanvas() ?? null;

    const prevAutoRotate = animation.autoRotate;
    const onCaptureStart = () => {
      threeSceneRef.current?.prepareVideoCapture(videoSize.width, videoSize.height);
      setAnimation((prev) => ({ ...prev, autoRotate: true }));
    };
    const onCaptureEnd = () => {
      threeSceneRef.current?.restoreViewerSize();
      setAnimation((prev) => ({ ...prev, autoRotate: prevAutoRotate }));
    };

    videoExporter.startRecording(getCanvas, onCaptureStart, onCaptureEnd);
  }, [modelStatus, videoSize, animation.autoRotate, videoExporter]);

  return (
    <main className="min-h-screen lg:h-screen lg:max-h-screen lg:overflow-hidden flex flex-col bg-[var(--bg-primary)]">
      {/* Header */}
      <header className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center">
            <span className="text-white font-bold text-sm">S3</span>
          </div>
          <h1 className="text-lg font-semibold text-gray-100">SnapTo3D</h1>
        </div>
        <span className="text-xs text-gray-500 hidden sm:block">
          Platform Presentasi Produk 3D untuk UMKM
        </span>
      </header>

      {/* Main content — responsive two-column layout */}
      <div className="flex-1 flex flex-col lg:flex-row lg:overflow-hidden min-h-0">
        {/* Left panel: Upload + Controls */}
        <aside className="w-full lg:w-[380px] xl:w-[420px] flex-shrink-0 border-b lg:border-b-0 lg:border-r border-gray-800 p-6 flex flex-col gap-6 overflow-y-auto max-h-none lg:max-h-[calc(100vh-57px)]">
          <div>
            <h2 className="text-base font-medium text-gray-100">
              Foto → Model 3D → Video
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Buat model dari foto, lalu atur dan export sebagai video.
            </p>
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2 text-center text-[11px] text-gray-400">
            <span className="rounded-md bg-gray-900 px-2 py-2">1. Foto</span>
            <span aria-hidden="true">→</span>
            <span className="rounded-md bg-gray-900 px-2 py-2">2. Model 3D</span>
            <span aria-hidden="true">→</span>
            <span className="rounded-md bg-gray-900 px-2 py-2">3. Video</span>
          </div>

          <div>
            <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-400">
              1. Buat Model dari Foto
            </h3>
            <UploadZone onUploadComplete={handleUploadComplete} />
          </div>

          <div className="flex items-center gap-3" aria-hidden="true">
            <div className="h-px flex-1 bg-gray-800" />
            <span className="text-[11px] text-gray-500">atau masuk langsung ke tahap 2</span>
            <div className="h-px flex-1 bg-gray-800" />
          </div>

          <ModelUploadZone onModelSelected={handleModelSelected} />

          {/* Demo button — load stub model for testing */}
          <button
            onClick={handleLoadDemo}
            className="w-full py-2.5 px-4 rounded-lg border border-gray-700 text-sm text-gray-300
                       hover:bg-gray-800 hover:border-gray-600 transition-colors duration-200"
          >
            Muat Model Demo (GLB Statis)
          </button>

          {/* Download GLB button */}
          {modelStatus === "ready" && (
            <div className="flex gap-2">
              <button
                onClick={handleDownloadGLB}
                className="flex-1 py-2.5 px-4 rounded-lg bg-brand-500 hover:bg-brand-600
                           text-sm text-white font-medium transition-colors duration-200
                           flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download GLB
              </button>
              <button
                onClick={handleDownloadOBJ}
                className="flex-1 py-2.5 px-4 rounded-lg border border-gray-600 hover:bg-gray-800
                           text-sm text-gray-300 font-medium transition-colors duration-200
                           flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download OBJ
              </button>
            </div>
          )}

          {/* Status indicator */}
          {modelStatus === "loading" && (
            <div className="flex items-center gap-2 rounded-lg border border-brand-800/30 bg-brand-900/20 px-3 py-2">
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" />
              <span className="text-xs text-brand-300">Memuat model 3D...</span>
            </div>
          )}

          {modelStatus === "ready" && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-900/20 border border-green-800/30">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="min-w-0 truncate text-xs text-green-300">
                {modelName} aktif — gunakan mouse untuk memutar
              </span>
            </div>
          )}

          {modelStatus === "error" && (
            <p className="rounded-lg border border-red-800/30 bg-red-900/20 px-3 py-2 text-xs text-red-300">
              {modelError}
            </p>
          )}

          {/* Divider */}
          <hr className="border-gray-800" />

          <h3 className="text-xs font-medium uppercase tracking-wider text-gray-400">
            2. Atur Model 3D
          </h3>

          {/* Lighting controls */}
          <LightingControls settings={lighting} onChange={setLighting} />

          {/* Divider */}
          <hr className="border-gray-800" />

          <BackgroundControls color={backgroundColor} onChange={setBackgroundColor} />

          {/* Divider */}
          <hr className="border-gray-800" />

          {/* Animation controls */}
          <AnimationControls
            settings={animation}
            onChange={setAnimation}
            videoDuration={videoDuration}
            onVideoDurationChange={setVideoDuration}
            videoResolution={videoResolution}
            onVideoResolutionChange={setVideoResolution}
            videoAspectRatio={videoAspectRatio}
            onVideoAspectRatioChange={setVideoAspectRatio}
            videoFormat={videoFormat}
            onVideoFormatChange={setVideoFormat}
            outputSize={videoSize}
          />

          {/* Divider */}
          <hr className="border-gray-800" />

          {/* Export section */}
          <div className="flex flex-col gap-3">
            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">
              3. Generate Video
            </h3>

            {/* Render Video button */}
            {modelStatus === "ready" && !videoExporter.isRecording && (
              <button
                onClick={handleRenderVideo}
                className="w-full py-2.5 px-4 rounded-lg bg-purple-600 hover:bg-purple-700
                           text-sm text-white font-medium transition-colors duration-200
                           flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Render & Download Video ({videoDuration}s)
              </button>
            )}

            {/* Recording progress */}
            {videoExporter.isRecording && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-sm text-red-300 font-medium">Recording...</span>
                  </div>
                  <span className="text-xs text-gray-400 tabular-nums">
                    {videoExporter.elapsedSeconds}s / {videoDuration}s
                  </span>
                </div>
                {/* Progress bar */}
                <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-500 rounded-full transition-all duration-100"
                    style={{ width: `${videoExporter.progress}%` }}
                  />
                </div>
                <button
                  onClick={videoExporter.cancelRecording}
                  className="w-full py-1.5 px-3 rounded-md border border-gray-600 text-xs text-gray-400
                             hover:bg-gray-800 transition-colors duration-200"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Recording error */}
            {videoExporter.error && (
              <p className="text-xs text-red-400">{videoExporter.error}</p>
            )}
          </div>

          {/* Info panel */}
          <div className="mt-auto pt-4 border-t border-gray-800">
            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
              Kontrol Penampil
            </h3>
            <ul className="text-xs text-gray-500 space-y-1">
              <li>Klik kiri + seret = Putar model</li>
              <li>Scroll = Zoom masuk/keluar</li>
              <li>Klik kanan + seret = Geser kamera</li>
            </ul>
          </div>
        </aside>

        {/* Right panel: 3D Viewer */}
        <section className="flex-1 p-4 lg:p-6 flex flex-col lg:overflow-hidden min-h-0">
          <div className="flex-1 min-h-[400px] lg:min-h-0">
            <ThreeScene
              ref={threeSceneRef}
              modelUrl={modelUrl}
              lighting={lighting}
              animation={animation}
              backgroundColor={backgroundColor}
              previewAspectRatio={videoSize.width / videoSize.height}
              onModelLoad={handleModelLoad}
              onModelError={handleModelError}
            />
          </div>

          {/* Footer info */}
          <p className="text-xs text-gray-600 text-center mt-3">
            SnapTo3D v1.0 — Progres 100% • Three.js + FastAPI + Modal Labs GPU
          </p>
        </section>
      </div>
    </main>
  );
}
