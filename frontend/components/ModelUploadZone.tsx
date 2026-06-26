"use client";

import { useCallback, useRef, useState } from "react";
import type { DragEvent } from "react";

interface ModelUploadZoneProps {
  onModelSelected: (file: File) => void;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024;

export default function ModelUploadZone({ onModelSelected }: ModelUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      setError(null);

      if (!file.name.toLowerCase().endsWith(".glb")) {
        setError("Format tidak didukung. Gunakan file GLB.");
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        setError("Ukuran file GLB melebihi 50 MB.");
        return;
      }

      setFileName(file.name);
      onModelSelected(file);
    },
    [onModelSelected]
  );

  const handleDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      setIsDragging(false);
      const file = event.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div className="flex flex-col gap-4 w-full">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsDragging(false);
        }}
        onDrop={handleDrop}
        className={`relative flex min-h-[100px] w-full cursor-pointer flex-col items-center
                    justify-center rounded-lg border border-dashed transition-colors duration-150
                    ${
                      isDragging
                        ? "border-brand-500 bg-brand-500/5"
                        : "border-[var(--border)] bg-[var(--bg-surface)] hover:border-[#2a2a38]"
                    }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".glb,model/gltf-binary"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) handleFile(file);
            event.target.value = "";
          }}
          className="hidden"
          aria-label="Upload GLB model"
        />

        <svg className="mb-1.5 h-6 w-6 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16zM3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" />
        </svg>
        <p className="text-sm font-medium text-[var(--text-primary)] text-center">
          {isDragging ? "Drop GLB here" : "Upload existing GLB"}
        </p>
        <p className="mt-0.5 text-xs text-[var(--text-secondary)] text-center">
          GLB · max 50 MB
        </p>
      </div>

      {fileName && !error && (
        <div className="flex items-center gap-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] px-2.5 py-2">
          <span className="text-[10px] font-semibold text-brand-400 bg-brand-500/10 px-1.5 py-0.5 rounded flex-shrink-0">GLB</span>
          <p className="truncate text-xs text-[var(--text-primary)]">{fileName}</p>
        </div>
      )}

      {error && <p className="px-1 text-sm text-red-400">{error}</p>}
    </div>
  );
}
