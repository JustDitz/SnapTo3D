"use client";

import React from "react";
import type { LightingSettings } from "./ThreeScene";

interface LightingControlsProps {
  settings: LightingSettings;
  onChange: (settings: LightingSettings) => void;
}

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
    <div className="flex items-center gap-2.5">
      <label className="text-[11px] text-[var(--text-secondary)] w-16 flex-shrink-0">{label}</label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 h-1 accent-brand-500 cursor-pointer"
      />
      <span className="text-[11px] text-[var(--text-secondary)] w-8 text-right tabular-nums">
        {value.toFixed(1)}
      </span>
    </div>
  );
}

export default function LightingControls({ settings, onChange }: LightingControlsProps) {
  const update = (key: keyof LightingSettings, value: number | boolean) =>
    onChange({ ...settings, [key]: value });

  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-[11px] text-[var(--text-secondary)]">Lighting</span>

      <SliderRow label="Intensity" value={settings.intensity} min={0} max={5} step={0.1}
        onChange={(v) => update("intensity", v)} />
      <SliderRow label="Position X" value={settings.posX} min={-10} max={10} step={0.5}
        onChange={(v) => update("posX", v)} />
      <SliderRow label="Position Y" value={settings.posY} min={0} max={15} step={0.5}
        onChange={(v) => update("posY", v)} />
      <SliderRow label="Position Z" value={settings.posZ} min={-10} max={10} step={0.5}
        onChange={(v) => update("posZ", v)} />

      <div className="flex items-center justify-between pt-0.5">
        <span className="text-[11px] text-[var(--text-secondary)]">Soft shadow</span>
        <button
          onClick={() => update("shadowEnabled", !settings.shadowEnabled)}
          className={`relative w-8 h-4 rounded-full transition-colors duration-150 cursor-pointer
            ${settings.shadowEnabled ? "bg-brand-500" : "bg-[var(--border)]"}`}
          role="switch"
          aria-checked={settings.shadowEnabled}
        >
          <span className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform duration-150
            ${settings.shadowEnabled ? "translate-x-4" : "translate-x-0"}`} />
        </button>
      </div>
    </div>
  );
}
