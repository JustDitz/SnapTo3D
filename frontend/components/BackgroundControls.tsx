"use client";

const PRESETS = [
  { label: "Studio", color: "#e5e7eb" },
  { label: "Putih", color: "#f8fafc" },
  { label: "Gelap", color: "#111827" },
  { label: "Hangat", color: "#e8ded1" },
  { label: "Biru", color: "#dbeafe" },
];

interface BackgroundControlsProps {
  color: string;
  onChange: (color: string) => void;
}

export default function BackgroundControls({ color, onChange }: BackgroundControlsProps) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-xs font-medium uppercase tracking-wider text-gray-400">
        Background
      </h3>

      <div className="flex items-center gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.color}
            type="button"
            onClick={() => onChange(preset.color)}
            aria-label={`Background ${preset.label}`}
            title={preset.label}
            className={`h-8 w-8 rounded-full border transition-transform hover:scale-110 ${
              color === preset.color
                ? "border-brand-400 ring-2 ring-brand-400/40"
                : "border-gray-600"
            }`}
            style={{ backgroundColor: preset.color }}
          />
        ))}

        <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs text-gray-400">
          Custom
          <input
            type="color"
            value={color}
            onChange={(event) => onChange(event.target.value)}
            className="h-8 w-10 cursor-pointer rounded border border-gray-600 bg-transparent p-0.5"
            aria-label="Pilih warna background"
          />
        </label>
      </div>
    </div>
  );
}
