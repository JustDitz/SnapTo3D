"use client";

export const TRANSPARENT_BG = "transparent";

const PRESETS = [
  { label: "Studio", color: "#e5e7eb" },
  { label: "White", color: "#f8fafc" },
  { label: "Dark", color: "#111827" },
  { label: "Warm", color: "#e8ded1" },
  { label: "Blue", color: "#dbeafe" },
];

interface BackgroundControlsProps {
  color: string;
  onChange: (color: string) => void;
}

export default function BackgroundControls({ color, onChange }: BackgroundControlsProps) {
  const isTransparent = color === TRANSPARENT_BG;

  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-[11px] text-[var(--text-secondary)]">Background</span>

      <div className="flex items-center gap-2 flex-wrap">
        {/* Transparent / no background */}
        <button
          type="button"
          onClick={() => onChange(TRANSPARENT_BG)}
          aria-label="No background"
          title="No background"
          className={`h-7 w-7 rounded-full border transition-all duration-150 cursor-pointer hover:scale-110 overflow-hidden ${
            isTransparent
              ? "border-brand-400 ring-1 ring-brand-400/40 scale-110"
              : "border-[var(--border)]"
          }`}
          style={{
            background:
              "repeating-conic-gradient(#888 0% 25%, #444 0% 50%) 0 0 / 8px 8px",
          }}
        />

        {PRESETS.map((preset) => (
          <button
            key={preset.color}
            type="button"
            onClick={() => onChange(preset.color)}
            aria-label={preset.label}
            title={preset.label}
            className={`h-7 w-7 rounded-full border transition-all duration-150 cursor-pointer hover:scale-110 ${
              color === preset.color
                ? "border-brand-400 ring-1 ring-brand-400/40 scale-110"
                : "border-[var(--border)]"
            }`}
            style={{ backgroundColor: preset.color }}
          />
        ))}

        <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
          Custom
          <input
            type="color"
            value={isTransparent ? "#e5e7eb" : color}
            onChange={(e) => onChange(e.target.value)}
            className="h-7 w-8 cursor-pointer rounded border border-[var(--border)] bg-transparent p-0.5"
            aria-label="Custom background color"
          />
        </label>
      </div>
    </div>
  );
}
