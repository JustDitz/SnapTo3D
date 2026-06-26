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

  const threeSceneRef = useRef<ThreeSceneHandle>(null);
  const localModelUrlRef = useRef<string | null>(null);

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

  const handleUploadComplete = useCallback(
    (glbUrl: string) => showModel(glbUrl, "snapto3d-model.glb"),
    [showModel]
  );

  const handleModelSelected = useCallback(
    (file: File) => showModel(URL.createObjectURL(file), file.name, true),
    [showModel]
  );

  const handleModelLoad = useCallback(() => setModelStatus("ready"), []);

  const handleModelError = useCallback((message: string) => {
    setModelStatus("error");
    setModelError(message);
  }, []);

  const handleLoadDemo = useCallback(() => showModel("/static/sample.glb", "sample.glb"), [showModel]);

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
      console.error("[Download] Failed:", err);
    }
  }, [modelName, modelUrl]);

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
      <header className="flex-shrink-0 flex items-center justify-between px-5 h-11 border-b border-[var(--border)]">
        <div className="flex items-center gap-2.5">
          <div className="w-5 h-5 rounded bg-brand-500 flex items-center justify-center flex-shrink-0">
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 10V7" />
            </svg>
          </div>
          <span className="text-sm font-medium text-[var(--text-primary)] tracking-tight">SnapTo3D</span>
        </div>
        {modelStatus === "ready" && modelName && (
          <span className="text-xs text-[var(--text-secondary)] hidden sm:block truncate max-w-[200px]">
            {modelName}
          </span>
        )}
      </header>

      {/* Body */}
      <div className="flex-1 flex flex-col lg:flex-row lg:overflow-hidden min-h-0">
        {/* Sidebar */}
        <aside className="w-full lg:w-[340px] xl:w-[360px] flex-shrink-0 border-b lg:border-b-0 lg:border-r border-[var(--border)] flex flex-col overflow-y-auto max-h-none lg:max-h-[calc(100vh-44px)]">

          {/* Input section */}
          <div className="p-4 flex flex-col gap-3 border-b border-[var(--border)]">
            <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-widest">
              Input
            </span>
            <UploadZone onUploadComplete={handleUploadComplete} />
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-[var(--border-subtle)]" />
              <span className="text-[10px] text-[var(--text-muted)]">or</span>
              <div className="h-px flex-1 bg-[var(--border-subtle)]" />
            </div>
            <ModelUploadZone onModelSelected={handleModelSelected} />
            <button
              onClick={handleLoadDemo}
              className="w-full py-1.5 px-3 rounded border border-[var(--border)] text-[11px] text-[var(--text-secondary)]
                         hover:border-[#2a2a38] hover:text-[var(--text-primary)] transition-colors duration-150 cursor-pointer"
            >
              Load demo model
            </button>
          </div>

          {/* Model status bar */}
          {modelStatus !== "idle" && (
            <div className="px-4 py-2.5 border-b border-[var(--border)]">
              {modelStatus === "loading" && (
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 animate-spin rounded-full border border-brand-400 border-t-transparent flex-shrink-0" />
                  <span className="text-xs text-[var(--text-secondary)]">Loading model...</span>
                </div>
              )}
              {modelStatus === "ready" && (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                    <span className="text-xs text-[var(--text-secondary)]">Ready</span>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={handleDownloadGLB}
                      title="Download GLB"
                      className="px-2.5 py-1 rounded text-[11px] text-[var(--text-secondary)] border border-[var(--border)]
                                 hover:border-[#2a2a38] hover:text-[var(--text-primary)] transition-colors duration-150 cursor-pointer
                                 flex items-center gap-1"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      GLB
                    </button>
                    <button
                      onClick={handleDownloadOBJ}
                      title="Download OBJ"
                      className="px-2.5 py-1 rounded text-[11px] text-[var(--text-secondary)] border border-[var(--border)]
                                 hover:border-[#2a2a38] hover:text-[var(--text-primary)] transition-colors duration-150 cursor-pointer
                                 flex items-center gap-1"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      OBJ
                    </button>
                  </div>
                </div>
              )}
              {modelStatus === "error" && (
                <p className="text-xs text-red-400">{modelError}</p>
              )}
            </div>
          )}

          {/* Scene controls */}
          <div className="p-4 flex flex-col gap-4 border-b border-[var(--border)]">
            <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-widest">
              Scene
            </span>
            <LightingControls settings={lighting} onChange={setLighting} />
            <div className="h-px bg-[var(--border-subtle)]" />
            <BackgroundControls color={backgroundColor} onChange={setBackgroundColor} />
          </div>

          {/* Export section */}
          <div className="p-4 flex flex-col gap-4">
            <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-widest">
              Export
            </span>
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

            {modelStatus === "ready" && !videoExporter.isRecording && (
              <button
                onClick={handleRenderVideo}
                className="w-full py-2.5 px-4 rounded-md bg-brand-500 hover:bg-brand-600
                           text-sm text-white font-medium transition-colors duration-150 cursor-pointer
                           flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Render Video ({videoDuration}s)
              </button>
            )}

            {videoExporter.isRecording && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                    <span className="text-xs text-red-400">Recording</span>
                  </div>
                  <span className="text-xs text-[var(--text-secondary)] tabular-nums">
                    {videoExporter.elapsedSeconds}s / {videoDuration}s
                  </span>
                </div>
                <div className="w-full h-0.5 bg-[var(--border)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-500 transition-all duration-100"
                    style={{ width: `${videoExporter.progress}%` }}
                  />
                </div>
                <button
                  onClick={videoExporter.cancelRecording}
                  className="w-full py-1.5 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]
                             border border-[var(--border)] hover:border-[#2a2a38] rounded transition-colors duration-150 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}

            {videoExporter.error && (
              <p className="text-xs text-red-400">{videoExporter.error}</p>
            )}
          </div>

          {/* Controls hint */}
          <div className="mt-auto px-4 py-3 border-t border-[var(--border)]">
            <p className="text-[10px] text-[var(--text-muted)]">
              Drag — rotate · Scroll — zoom · Right drag — pan
            </p>
          </div>
        </aside>

        {/* Viewer */}
        <section className="flex-1 p-3 lg:p-4 flex flex-col lg:overflow-hidden min-h-0">
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
        </section>
      </div>
    </main>
  );
}
