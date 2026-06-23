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
        className={`relative flex min-h-[140px] w-full cursor-pointer flex-col items-center
                    justify-center rounded-xl border-2 border-dashed transition-colors duration-200
                    ${
                      isDragging
                        ? "border-brand-500 bg-brand-500/10"
                        : "border-gray-600 bg-[var(--bg-secondary)] hover:border-gray-400"
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

        <svg className="mb-2 h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16zM3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" />
        </svg>
        <p className="text-sm font-medium text-gray-300">
          {isDragging ? "Lepaskan model di sini" : "Sudah punya model 3D? Upload di sini"}
        </p>
        <p className="mt-1 text-xs text-gray-500">
          File GLB — maks 50 MB
        </p>
      </div>

      {fileName && !error && (
        <div className="flex items-center gap-3 rounded-lg bg-[var(--bg-secondary)] p-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-brand-500/10 text-xs font-semibold text-brand-300">
            GLB
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm text-gray-200">{fileName}</p>
            <p className="text-xs text-green-400">File dipilih</p>
          </div>
        </div>
      )}

      {error && <p className="px-1 text-sm text-red-400">{error}</p>}
    </div>
  );
}
