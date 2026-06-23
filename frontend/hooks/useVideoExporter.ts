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

export type VideoFormat = "auto" | "mp4" | "webm";

const FORMAT_MIME_TYPES = {
  mp4: ["video/mp4;codecs=avc1.42E01E", "video/mp4"],
  webm: ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"],
} as const;

export function isVideoFormatSupported(format: "mp4" | "webm") {
  if (typeof MediaRecorder === "undefined") return false;
  return FORMAT_MIME_TYPES[format].some((type) => MediaRecorder.isTypeSupported(type));
}

interface UseVideoExporterOptions {
  /** Duration of the video in seconds */
  duration: number;
  format: VideoFormat;
}

// ---------------------------------------------------------------------------
// Hook: useVideoExporter
// Captures a Three.js canvas stream via MediaRecorder and downloads the result.
// ---------------------------------------------------------------------------
export function useVideoExporter({ duration, format }: UseVideoExporterOptions) {
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
   * @param onCaptureStart - prepares the scene before recording
   * @param onCaptureEnd - restores the scene after recording
   */
  const startRecording = useCallback(
    async (
      getCanvas: () => HTMLCanvasElement | null,
      onCaptureStart?: () => void,
      onCaptureEnd?: () => void,
    ) => {
      abortRef.current = false;
      setState({ isRecording: true, progress: 0, elapsedSeconds: 0, error: null });
      let stream: MediaStream | null = null;
      let shouldCleanup = false;

      try {
        const canvas = getCanvas();
        if (!canvas) throw new Error("Canvas not available. Load a 3D model first.");
        if (typeof MediaRecorder === "undefined") {
          throw new Error("Browser ini belum mendukung perekaman video.");
        }
        if (typeof canvas.captureStream !== "function") {
          throw new Error("Browser ini belum mendukung perekaman canvas.");
        }

        onCaptureStart?.();
        shouldCleanup = true;

        // Capture canvas stream at 30 FPS
        stream = canvas.captureStream(30);
        const preferredTypes =
          format === "auto"
            ? [...FORMAT_MIME_TYPES.mp4, ...FORMAT_MIME_TYPES.webm]
            : FORMAT_MIME_TYPES[format];
        const mimeType = preferredTypes.find((type) => MediaRecorder.isTypeSupported(type));

        if (!mimeType) {
          const label = format === "auto" ? "Video" : format.toUpperCase();
          throw new Error(`${label} tidak didukung browser ini.`);
        }

        const videoBitsPerSecond = Math.max(canvas.width, canvas.height) >= 1920
          ? 8_000_000
          : 5_000_000;

        const recorder = new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond,
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
            const fullBlob = new Blob(chunks, { type: recorder.mimeType || mimeType });
            resolve(fullBlob);
          };
          recorder.onerror = () => {
            clearTimers();
            reject(new Error("MediaRecorder error"));
          };

          try {
            recorder.start(100); // collect data every 100ms
          } catch {
            clearTimers();
            reject(new Error("Perekaman video gagal dimulai."));
            return;
          }

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
        const extension = (recorder.mimeType || mimeType).startsWith("video/mp4") ? "mp4" : "webm";
        a.download = `snapto3d-video-${Date.now()}.${extension}`;
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
        if (shouldCleanup) onCaptureEnd?.();
        stream?.getTracks().forEach((track) => track.stop());
      }
    },
    [duration, format]
  );

  const cancelRecording = useCallback(() => {
    abortRef.current = true;
  }, []);

  return { ...state, startRecording, cancelRecording };
}
