import { useState, useCallback, useRef } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface VideoExporterState {
  isRecording: boolean;
  progress: number; // 0–100
  elapsedSeconds: number;
  error: string | null;
}

interface UseVideoExporterOptions {
  /** Duration of the video in seconds */
  duration: number;
  /** Force auto-rotate during recording even if user has it off */
  forceRotate?: boolean;
}

// ---------------------------------------------------------------------------
// Hook: useVideoExporter
// Captures a Three.js canvas stream via MediaRecorder and downloads as WebM.
// ---------------------------------------------------------------------------
export function useVideoExporter({ duration, forceRotate = true }: UseVideoExporterOptions) {
  const [state, setState] = useState<VideoExporterState>({
    isRecording: false,
    progress: 0,
    elapsedSeconds: 0,
    error: null,
  });

  const abortRef = useRef(false);

  /**
   * Start recording the canvas for the specified duration.
   * @param getCanvas - function that returns the HTMLCanvasElement
   * @param onRotateOverride - callback to temporarily enable auto-rotate
   */
  const startRecording = useCallback(
    async (
      getCanvas: () => HTMLCanvasElement | null,
      onRotateOverride?: () => void,
      onRotateRestore?: () => void,
    ) => {
      abortRef.current = false;
      setState({ isRecording: true, progress: 0, elapsedSeconds: 0, error: null });
      let stream: MediaStream | null = null;
      let shouldRestoreRotation = false;

      try {
        const canvas = getCanvas();
        if (!canvas) throw new Error("Canvas not available. Load a 3D model first.");
        if (typeof MediaRecorder === "undefined") {
          throw new Error("Browser ini belum mendukung perekaman video.");
        }

        // Force rotation during recording
        if (forceRotate) {
          onRotateOverride?.();
          shouldRestoreRotation = true;
        }

        // Capture canvas stream at 30 FPS
        stream = canvas.captureStream(30);
        const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
          ? "video/webm;codecs=vp9"
          : "video/webm";

        const recorder = new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: 5_000_000, // 5 Mbps for good quality
        });

        const chunks: Blob[] = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        // Progress tracking
        const startTime = Date.now();
        const durationMs = duration * 1000;
        const progressInterval = setInterval(() => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(100, Math.round((elapsed / durationMs) * 100));
          setState((prev) => ({
            ...prev,
            progress,
            elapsedSeconds: Math.floor(elapsed / 1000),
          }));
        }, 100);

        // Wait for recording to complete
        const blob = await new Promise<Blob>((resolve, reject) => {
          let timeout: ReturnType<typeof setTimeout>;
          let abortCheck: ReturnType<typeof setInterval>;
          const clearTimers = () => {
            clearInterval(progressInterval);
            clearInterval(abortCheck);
            clearTimeout(timeout);
          };

          recorder.onstop = () => {
            clearTimers();
            const fullBlob = new Blob(chunks, { type: mimeType });
            resolve(fullBlob);
          };
          recorder.onerror = () => {
            clearTimers();
            reject(new Error("MediaRecorder error"));
          };

          recorder.start(100); // collect data every 100ms

          // Auto-stop after duration
          timeout = setTimeout(() => {
            if (recorder.state === "recording") {
              recorder.stop();
            }
          }, durationMs);

          // Allow manual abort
          abortCheck = setInterval(() => {
            if (abortRef.current) {
              if (recorder.state === "recording") recorder.stop();
            }
          }, 100);
        });

        if (abortRef.current) {
          setState({ isRecording: false, progress: 0, elapsedSeconds: 0, error: null });
          return;
        }

        // Trigger download
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `snapto3d-video-${Date.now()}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setState({ isRecording: false, progress: 100, elapsedSeconds: duration, error: null });
      } catch (err) {
        setState((prev) => ({
          ...prev,
          isRecording: false,
          error: err instanceof Error ? err.message : "Recording failed",
        }));
      } finally {
        if (shouldRestoreRotation) onRotateRestore?.();
        stream?.getTracks().forEach((track) => track.stop());
      }
    },
    [duration, forceRotate]
  );

  const cancelRecording = useCallback(() => {
    abortRef.current = true;
  }, []);

  return { ...state, startRecording, cancelRecording };
}
