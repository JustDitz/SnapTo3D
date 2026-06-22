"use client";

import React from "react";
import type { LightingSettings } from "./ThreeScene";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface LightingControlsProps {
  settings: LightingSettings;
  onChange: (settings: LightingSettings) => void;
}

// ---------------------------------------------------------------------------
// Reusable slider row
// ---------------------------------------------------------------------------
function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <label className="text-xs text-gray-400 w-8 flex-shrink-0">{label}</label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 h-1.5 accent-brand-500 bg-gray-700 rounded-full appearance-none cursor-pointer"
      />
      <span className="text-xs text-gray-500 w-10 text-right tabular-nums">
        {value.toFixed(1)}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component: LightingControls
// ---------------------------------------------------------------------------
export default function LightingControls({ settings, onChange }: LightingControlsProps) {
  const update = (key: keyof LightingSettings, value: number | boolean) => {
    onChange({ ...settings, [key]: value });
  };

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">
        Kontrol Pencahayaan
      </h3>

      {/* Position X */}
      <SliderRow
        label="X"
        value={settings.posX}
        min={-10}
        max={10}
        step={0.5}
        onChange={(v) => update("posX", v)}
      />

      {/* Position Y */}
      <SliderRow
        label="Y"
        value={settings.posY}
        min={0}
        max={15}
        step={0.5}
        onChange={(v) => update("posY", v)}
      />

      {/* Position Z */}
      <SliderRow
        label="Z"
        value={settings.posZ}
        min={-10}
        max={10}
        step={0.5}
        onChange={(v) => update("posZ", v)}
      />

      {/* Intensity */}
      <SliderRow
        label="Int"
        value={settings.intensity}
        min={0}
        max={5}
        step={0.1}
        onChange={(v) => update("intensity", v)}
      />

      {/* Shadow toggle */}
      <div className="flex items-center justify-between mt-1">
        <span className="text-xs text-gray-400">Soft Shadow</span>
        <button
          onClick={() => update("shadowEnabled", !settings.shadowEnabled)}
          className={`
            relative w-10 h-5 rounded-full transition-colors duration-200
            ${settings.shadowEnabled ? "bg-brand-500" : "bg-gray-600"}
          `}
          role="switch"
          aria-checked={settings.shadowEnabled}
        >
          <span
            className={`
              absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white
              transition-transform duration-200
              ${settings.shadowEnabled ? "translate-x-5" : "translate-x-0"}
            `}
          />
        </button>
      </div>
    </div>
  );
}
