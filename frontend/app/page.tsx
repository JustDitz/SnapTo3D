"use client";

import React, { useState, useCallback, useRef } from "react";
import UploadZone from "@/components/UploadZone";
import ThreeScene from "@/components/ThreeScene";
import type { LightingSettings, AnimationSettings, ThreeSceneHandle } from "@/components/ThreeScene";
import LightingControls from "@/components/LightingControls";
import AnimationControls from "@/components/AnimationControls";
import { useVideoExporter } from "@/hooks/useVideoExporter";

// ---------------------------------------------------------------------------
// Default settings
// ---------------------------------------------------------------------------
const DEFAULT_LIGHTING: LightingSettings = {
  posX: 5,
  posY: 8,
  posZ: 5,
  intensity: 1.2,
  shadowEnabled: false,
};

const DEFAULT_ANIMATION: AnimationSettings = {
  autoRotate: false,
  rotationSpeed: 1.0,
};

// ---------------------------------------------------------------------------
// Page: SnapTo3D Main Layout
// Left panel: upload zone + controls
// Right panel: 3D model viewer (Three.js canvas)
// Responsive: stacks vertically on mobile, side-by-side on desktop
// ---------------------------------------------------------------------------
export default function HomePage() {
  // GLB model URL — null until user uploads an image
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [lighting, setLighting] = useState<LightingSettings>(DEFAULT_LIGHTING);
  const [animation, setAnimation] = useState<AnimationSettings>(DEFAULT_ANIMATION);
  const [videoDuration, setVideoDuration] = useState(10);

  // Ref to access Three.js canvas for video capture
  const threeSceneRef = useRef<ThreeSceneHandle>(null);

  // Video exporter hook
  const videoExporter = useVideoExporter({ duration: videoDuration });

  /**
   * Called by UploadZone after successful backend upload.
   * Sets the GLB URL which triggers ThreeScene to load the model.
   */
  const handleUploadComplete = useCallback((glbUrl: string) => {
    setModelUrl(glbUrl);
  }, []);

  /**
   * Load the stub model directly for dev/testing without uploading.
   */
  const handleLoadDemo = useCallback(() => {
    setModelUrl("/static/sample.glb");
  }, []);

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
      a.download = `snapto3d-model-${Date.now()}.glb`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[Download] Failed to download GLB:", err);
    }
  }, [modelUrl]);

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
    if (!threeSceneRef.current || !modelUrl) return;
    const getCanvas = () => threeSceneRef.current?.getCanvas() ?? null;

    // Temporarily force auto-rotate during recording, then restore
    const prevAutoRotate = animation.autoRotate;
    const onRotateOverride = () => {
      setAnimation((prev) => ({ ...prev, autoRotate: true }));
    };
    const onRotateRestore = () => {
      setAnimation((prev) => ({ ...prev, autoRotate: prevAutoRotate }));
    };

    videoExporter.startRecording(getCanvas, onRotateOverride, onRotateRestore);
  }, [modelUrl, animation.autoRotate, videoExporter]);

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
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
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Left panel: Upload + Controls */}
        <aside className="w-full lg:w-[380px] xl:w-[420px] flex-shrink-0 border-b lg:border-b-0 lg:border-r border-gray-800 p-6 flex flex-col gap-6 overflow-y-auto max-h-[calc(100vh-57px)]">
          {/* Section title */}
          <div>
            <h2 className="text-base font-medium text-gray-100">
              Unggah Foto Produk
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Seret foto produk Anda dan dapatkan model 3D interaktif.
            </p>
          </div>

          {/* Upload zone */}
          <UploadZone onUploadComplete={handleUploadComplete} />

          {/* Demo button — load stub model for testing */}
          <button
            onClick={handleLoadDemo}
            className="w-full py-2.5 px-4 rounded-lg border border-gray-700 text-sm text-gray-300
                       hover:bg-gray-800 hover:border-gray-600 transition-colors duration-200"
          >
            Muat Model Demo (GLB Statis)
          </button>

          {/* Download GLB button */}
          {modelUrl && (
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
          {modelUrl && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-900/20 border border-green-800/30">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs text-green-300">
                Model 3D aktif — gunakan mouse untuk memutar
              </span>
            </div>
          )}

          {/* Divider */}
          <hr className="border-gray-800" />

          {/* Lighting controls */}
          <LightingControls settings={lighting} onChange={setLighting} />

          {/* Divider */}
          <hr className="border-gray-800" />

          {/* Animation controls */}
          <AnimationControls
            settings={animation}
            onChange={setAnimation}
            videoDuration={videoDuration}
            onVideoDurationChange={setVideoDuration}
          />

          {/* Divider */}
          <hr className="border-gray-800" />

          {/* Export section */}
          <div className="flex flex-col gap-3">
            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">
              Export
            </h3>

            {/* Render Video button */}
            {modelUrl && !videoExporter.isRecording && (
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
        <section className="flex-1 p-4 lg:p-6 flex flex-col">
          <div className="flex-1 min-h-[400px] lg:min-h-0">
            <ThreeScene
              ref={threeSceneRef}
              modelUrl={modelUrl}
              lighting={lighting}
              animation={animation}
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
