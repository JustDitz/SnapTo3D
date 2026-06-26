"use client";

import React, { useCallback, useState, useRef, useEffect } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type TaskStatus = "queued" | "processing" | "done" | "failed";

interface UploadZoneProps {
  /** Called with the GLB URL when 3D generation completes */
  onUploadComplete: (glbUrl: string) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ACCEPTED_EXT = ".jpg,.jpeg,.png,.webp";
const API_UPLOAD_URL = "/api/upload";
const POLL_INTERVAL_MS = 2000;

// ---------------------------------------------------------------------------
// Component: UploadZone
// Drag-and-drop image uploader → polls backend for 3D generation status.
// ---------------------------------------------------------------------------
export default function UploadZone({ onUploadComplete }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [taskStatus, setTaskStatus] = useState<TaskStatus | null>(null);
  const [taskProgress, setTaskProgress] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  // -------------------------------------------------------------------------
  // Poll task status every 2 seconds until done/failed
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!taskId || taskStatus === "done" || taskStatus === "failed") return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/task/${taskId}`);
        if (!res.ok) throw new Error(`Poll failed (${res.status})`);
        const data = await res.json();

        setTaskStatus(data.status);
        setTaskProgress(data.progress || "");

        if (data.status === "done" && data.glb_url) {
          clearInterval(pollInterval);
          onUploadComplete(data.glb_url);
        } else if (data.status === "failed") {
          clearInterval(pollInterval);
          setError(data.error || "3D generation failed.");
        }
      } catch (err) {
        clearInterval(pollInterval);
        setError(err instanceof Error ? err.message : "Polling error.");
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(pollInterval);
  }, [taskId, taskStatus, onUploadComplete]);

  /**
   * Validate file, upload to backend, then start polling for 3D generation.
   */
  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setTaskId(null);
      setTaskStatus(null);
      setTaskProgress("");

      // Validate type
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError("Format tidak didukung. Gunakan JPEG, PNG, atau WebP.");
        return;
      }

      // Validate size (max 10 MB)
      if (file.size > 10 * 1024 * 1024) {
        setError("Ukuran file melebihi 10 MB.");
        return;
      }

      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = URL.createObjectURL(file);
      setPreview(previewUrlRef.current);
      setFileName(file.name);

      // Upload
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch(API_UPLOAD_URL, {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const detail = await res.json().catch(() => ({}));
          throw new Error(detail.detail || `Upload gagal (${res.status})`);
        }

        const data = await res.json();
        // Backend now returns task_id for async 3D generation
        if (data.task_id) {
          setTaskId(data.task_id);
          setTaskStatus("queued");
          setTaskProgress("Task queued...");
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload gagal.";
        setError(msg);
      } finally {
        setIsUploading(false);
      }
    },
    []
  );

  // --- Drag event handlers ---
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  // --- Click-to-browse ---
  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      // Reset so same file can be re-selected
      e.target.value = "";
    },
    [handleFile]
  );

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        className={`
          relative flex flex-col items-center justify-center
          w-full min-h-[160px] rounded-lg border border-dashed
          cursor-pointer transition-colors duration-150 px-3
          ${
            isDragging
              ? "border-brand-500 bg-brand-500/5"
              : "border-[var(--border)] hover:border-[#2a2a38] bg-[var(--bg-surface)]"
          }
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXT}
          onChange={onInputChange}
          className="hidden"
          aria-label="Upload product image"
        />

        <svg className="w-8 h-8 mb-2 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>

        <p className="text-sm text-[var(--text-primary)] font-medium">
          {isDragging ? "Drop image here" : "Drop product photo"}
        </p>
        <p className="text-xs text-[var(--text-secondary)] mt-0.5">
          JPEG · PNG · WebP · max 10 MB
        </p>

        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-primary)]/70 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border border-brand-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-[var(--text-secondary)]">Uploading...</span>
            </div>
          </div>
        )}
      </div>

      {/* Preview + status */}
      {preview && (
        <div className="flex items-center gap-3 p-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border)]">
          <img src={preview} alt="Preview" className="w-10 h-10 object-cover rounded flex-shrink-0" />
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-xs text-[var(--text-primary)] truncate">{fileName}</span>
            {taskId && taskStatus && taskStatus !== "done" && (
              <span className="text-[11px] text-brand-400 truncate">{taskProgress || "Queued..."}</span>
            )}
            {taskStatus === "done" && (
              <span className="text-[11px] text-green-400">Model ready</span>
            )}
            {!taskId && (
              <span className="text-[11px] text-[var(--text-secondary)]">Uploaded</span>
            )}
          </div>
          {taskId && taskStatus && taskStatus !== "done" && (
            <div className="w-3.5 h-3.5 border border-brand-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
          )}
        </div>
      )}

      {error && (
        <p className="text-xs text-red-400 px-0.5">{error}</p>
      )}
    </div>
  );
}
