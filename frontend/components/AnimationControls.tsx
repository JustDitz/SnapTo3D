"use client";

import React, { useEffect, useState } from "react";
import type { AnimationSettings } from "./ThreeScene";
import { isVideoFormatSupported } from "@/hooks/useVideoExporter";
import type { VideoFormat } from "@/hooks/useVideoExporter";

export type VideoResolution = "720p" | "1080p";
export type VideoAspectRatio = "16:9" | "9:16" | "1:1" | "4:5";

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

const selectClass =
  "flex-1 rounded border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1.5 text-[11px] text-[var(--text-primary)] focus:border-brand-500 focus:outline-none cursor-pointer";

const labelClass = "w-16 flex-shrink-0 text-[11px] text-[var(--text-secondary)]";

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
    setFormatSupport({ mp4: isVideoFormatSupported("mp4"), webm: isVideoFormatSupported("webm") });
  }, []);

  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-[11px] text-[var(--text-secondary)]">Animation</span>

      {/* Auto-rotate */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-[var(--text-secondary)]">Auto-rotate</span>
        <button
          onClick={() => onChange({ ...settings, autoRotate: !settings.autoRotate })}
          className={`relative w-8 h-4 rounded-full transition-colors duration-150 cursor-pointer
            ${settings.autoRotate ? "bg-brand-500" : "bg-[var(--border)]"}`}
          role="switch"
          aria-checked={settings.autoRotate}
        >
          <span className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform duration-150
            ${settings.autoRotate ? "translate-x-4" : "translate-x-0"}`} />
        </button>
      </div>

      {/* Speed */}
      <div className="flex items-center gap-2.5">
        <label className={labelClass}>Speed</label>
        <input
          type="range" min={0.1} max={5} step={0.1}
          value={settings.rotationSpeed}
          onChange={(e) => onChange({ ...settings, rotationSpeed: parseFloat(e.target.value) })}
          className="flex-1 h-1 accent-brand-500 cursor-pointer"
          disabled={!settings.autoRotate}
        />
        <span className="text-[11px] text-[var(--text-secondary)] w-8 text-right tabular-nums">
          {settings.rotationSpeed.toFixed(1)}
        </span>
      </div>

      <div className="h-px bg-[var(--border-subtle)]" />

      <span className="text-[11px] text-[var(--text-secondary)]">Video</span>

      {/* Duration */}
      <div className="flex items-center gap-2.5">
        <label className={labelClass}>Duration</label>
        <input
          type="number" min={3} max={60} value={videoDuration}
          onChange={(e) => onVideoDurationChange(parseInt(e.target.value) || 10)}
          className="w-14 px-2 py-1.5 text-[11px] bg-[var(--bg-surface)] border border-[var(--border)] rounded
                     text-[var(--text-primary)] focus:border-brand-500 focus:outline-none"
        />
        <span className="text-[11px] text-[var(--text-secondary)]">s</span>
      </div>

      {/* Aspect ratio */}
      <div className="flex items-center gap-2.5">
        <label className={labelClass}>Ratio</label>
        <select value={videoAspectRatio}
          onChange={(e) => onVideoAspectRatioChange(e.target.value as VideoAspectRatio)}
          className={selectClass}>
          <option value="16:9">16:9</option>
          <option value="9:16">9:16</option>
          <option value="1:1">1:1</option>
          <option value="4:5">4:5</option>
        </select>
      </div>

      {/* Quality */}
      <div className="flex items-center gap-2.5">
        <label className={labelClass}>Quality</label>
        <select value={videoResolution}
          onChange={(e) => onVideoResolutionChange(e.target.value as VideoResolution)}
          className={selectClass}>
          <option value="720p">HD 720p</option>
          <option value="1080p">Full HD 1080p</option>
        </select>
      </div>

      {/* Format */}
      <div className="flex items-center gap-2.5">
        <label className={labelClass}>Format</label>
        <select value={videoFormat}
          onChange={(e) => onVideoFormatChange(e.target.value as VideoFormat)}
          className={selectClass}>
          <option value="auto">Auto</option>
          <option value="mp4" disabled={!formatSupport.mp4}>MP4{!formatSupport.mp4 ? " (unsupported)" : ""}</option>
          <option value="webm" disabled={!formatSupport.webm}>WebM{!formatSupport.webm ? " (unsupported)" : ""}</option>
        </select>
      </div>

      <p className="text-[10px] text-[var(--text-muted)] text-right">
        {outputSize.width} × {outputSize.height} · 30 fps
      </p>
    </div>
  );
}
