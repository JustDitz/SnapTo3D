"use client";

import React, { useState, useCallback } from "react";
import UploadZone from "@/components/UploadZone";
import ThreeScene from "@/components/ThreeScene";

// ---------------------------------------------------------------------------
// Page: SnapTo3D Main Layout
// Left panel: upload zone + controls
// Right panel: 3D model viewer (Three.js canvas)
// Responsive: stacks vertically on mobile, side-by-side on desktop
// ---------------------------------------------------------------------------
export default function HomePage() {
  // GLB model URL — null until user uploads an image
  const [modelUrl, setModelUrl] = useState<string | null>(null);

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
        <aside className="w-full lg:w-[380px] xl:w-[420px] flex-shrink-0 border-b lg:border-b-0 lg:border-r border-gray-800 p-6 flex flex-col gap-6">
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

          {/* Status indicator */}
          {modelUrl && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-900/20 border border-green-800/30">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs text-green-300">
                Model 3D aktif — gunakan mouse untuk memutar
              </span>
            </div>
          )}

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
            <ThreeScene modelUrl={modelUrl} />
          </div>

          {/* Footer info */}
          <p className="text-xs text-gray-600 text-center mt-3">
            SnapTo3D v0.6 — Progres 60% • Three.js + FastAPI + Modal Labs GPU
          </p>
        </section>
      </div>
    </main>
  );
}
