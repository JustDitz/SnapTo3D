"use client";

import React, { useEffect, useState } from "react";
import type { AnimationSettings } from "./ThreeScene";
import { isVideoFormatSupported } from "@/hooks/useVideoExporter";
import type { VideoFormat } from "@/hooks/useVideoExporter";

export type VideoResolution = "720p" | "1080p";
export type VideoAspectRatio = "16:9" | "9:16" | "1:1" | "4:5";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface AnimationControlsProps {
  settings: AnimationSettings;
  onChange: (settings: AnimationSettings) => void;
  videoDuration: number;
  onVideoDurationChange: (seconds: number) => void;
  videoResolution: VideoResolution;
  onVideoResolutionChange: (resolution: VideoResolution) => void;
  videoAspectRatio: VideoAspectRatio;
  onVideoAspectRatioChange: (ratio: VideoAspectRatio) => void;
  videoFormat: VideoFormat;
  onVideoFormatChange: (format: VideoFormat) => void;
  outputSize: { width: number; height: number };
}

// ---------------------------------------------------------------------------
// Component: AnimationControls
// ---------------------------------------------------------------------------
export default function AnimationControls({
  settings,
  onChange,
  videoDuration,
  onVideoDurationChange,
  videoResolution,
  onVideoResolutionChange,
  videoAspectRatio,
  onVideoAspectRatioChange,
  videoFormat,
  onVideoFormatChange,
  outputSize,
}: AnimationControlsProps) {
  const [formatSupport, setFormatSupport] = useState({ mp4: false, webm: false });

  useEffect(() => {
    setFormatSupport({
      mp4: isVideoFormatSupported("mp4"),
      webm: isVideoFormatSupported("webm"),
    });
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">
        Kontrol Animasi
      </h3>

      {/* Auto-rotate toggle */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">Auto-Rotate 360°</span>
        <button
          onClick={() => onChange({ ...settings, autoRotate: !settings.autoRotate })}
          className={`
            relative w-10 h-5 rounded-full transition-colors duration-200
            ${settings.autoRotate ? "bg-brand-500" : "bg-gray-600"}
          `}
          role="switch"
          aria-checked={settings.autoRotate}
        >
          <span
            className={`
              absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white
              transition-transform duration-200
              ${settings.autoRotate ? "translate-x-5" : "translate-x-0"}
            `}
          />
        </button>
      </div>

      {/* Rotation speed slider */}
      <div className="flex items-center gap-3">
        <label className="text-xs text-gray-400 w-12 flex-shrink-0">Speed</label>
        <input
          type="range"
          min={0.1}
          max={5}
          step={0.1}
          value={settings.rotationSpeed}
          onChange={(e) =>
            onChange({ ...settings, rotationSpeed: parseFloat(e.target.value) })
          }
          className="flex-1 h-1.5 accent-brand-500 bg-gray-700 rounded-full appearance-none cursor-pointer"
          disabled={!settings.autoRotate}
        />
        <span className="text-xs text-gray-500 w-10 text-right tabular-nums">
          {settings.rotationSpeed.toFixed(1)}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-xs text-gray-400 w-12 flex-shrink-0">Durasi</label>
        <input
          type="number"
          min={3}
          max={60}
          value={videoDuration}
          onChange={(e) => onVideoDurationChange(parseInt(e.target.value) || 10)}
          className="w-16 px-2 py-1 text-xs bg-gray-800 border border-gray-600 rounded-md
                     text-gray-200 focus:border-brand-500 focus:outline-none"
        />
        <span className="text-xs text-gray-500">detik</span>
      </div>

      <div className="flex items-center gap-3">
        <label className="w-12 flex-shrink-0 text-xs text-gray-400">Rasio</label>
        <select
          value={videoAspectRatio}
          onChange={(event) => onVideoAspectRatioChange(event.target.value as VideoAspectRatio)}
          className="flex-1 rounded-md border border-gray-600 bg-gray-800 px-2 py-1.5 text-xs
                     text-gray-200 focus:border-brand-500 focus:outline-none"
        >
          <option value="16:9">16:9 — YouTube / Presentasi</option>
          <option value="9:16">9:16 — TikTok / Reels / Shorts</option>
          <option value="1:1">1:1 — Post / Marketplace</option>
          <option value="4:5">4:5 — Instagram Feed</option>
        </select>
      </div>

      <div className="flex items-center gap-3">
        <label className="w-12 flex-shrink-0 text-xs text-gray-400">Kualitas</label>
        <select
          value={videoResolution}
          onChange={(event) => onVideoResolutionChange(event.target.value as VideoResolution)}
          className="flex-1 rounded-md border border-gray-600 bg-gray-800 px-2 py-1.5 text-xs
                     text-gray-200 focus:border-brand-500 focus:outline-none"
        >
          <option value="720p">HD</option>
          <option value="1080p">Full HD</option>
        </select>
      </div>

      <p className="text-right text-[11px] text-gray-500">
        Output: {outputSize.width} × {outputSize.height} px · 30 FPS
      </p>

      <div className="flex items-center gap-3">
        <label className="w-12 flex-shrink-0 text-xs text-gray-400">Format</label>
        <select
          value={videoFormat}
          onChange={(event) => onVideoFormatChange(event.target.value as VideoFormat)}
          className="flex-1 rounded-md border border-gray-600 bg-gray-800 px-2 py-1.5 text-xs
                     text-gray-200 focus:border-brand-500 focus:outline-none"
        >
          <option value="auto">Auto — utamakan MP4</option>
          <option value="mp4" disabled={!formatSupport.mp4}>
            MP4{formatSupport.mp4 ? "" : " — tidak didukung"}
          </option>
          <option value="webm" disabled={!formatSupport.webm}>
            WebM{formatSupport.webm ? "" : " — tidak didukung"}
          </option>
        </select>
      </div>
    </div>
  );
}
