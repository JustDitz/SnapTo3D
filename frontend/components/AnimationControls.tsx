"use client";

import React from "react";
import type { AnimationSettings } from "./ThreeScene";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface AnimationControlsProps {
  settings: AnimationSettings;
  onChange: (settings: AnimationSettings) => void;
  /** Video duration in seconds for MP4 export (future use) */
  videoDuration: number;
  onVideoDurationChange: (seconds: number) => void;
}

// ---------------------------------------------------------------------------
// Component: AnimationControls
// ---------------------------------------------------------------------------
export default function AnimationControls({
  settings,
  onChange,
  videoDuration,
  onVideoDurationChange,
}: AnimationControlsProps) {
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

      {/* Video duration input (for future MP4 export) */}
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
    </div>
  );
}
