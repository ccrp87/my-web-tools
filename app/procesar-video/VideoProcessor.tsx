"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent, DragEvent, SyntheticEvent } from "react";
import {
  getFFmpeg,
  type FFmpegInstance,
  type FFmpegLoadProgress,
} from "./ffmpegClient";
import {
  AUDIO_BITRATES_KBPS,
  AUDIO_FORMATS,
  extractAudio,
  type AudioFormatOption,
} from "./operations/extractAudio";
import {
  VIDEO_FORMATS,
  convertFormat,
  type VideoFormatOption,
} from "./operations/convertFormat";
import { trimVideo } from "./operations/trimVideo";
import { TrimTimeline } from "./TrimTimeline";
import {
  ACCEPTED_VIDEO_EXTENSIONS,
  buildOutputFileName,
  formatFileSize,
  isAcceptedVideoFile,
  isLargeVideo,
} from "./utils";

type Status = "idle" | "ready" | "processing" | "done" | "error";
type OperationId = "extract-audio" | "convert-format" | "trim-video";

const OPERATIONS: readonly { id: OperationId; label: string }[] = [
  { id: "extract-audio", label: "Extraer audio" },
  { id: "convert-format", label: "Convertir formato" },
  { id: "trim-video", label: "Recortar" },
];

export function VideoProcessor(): React.JSX.Element {
  const [status, setStatus] = useState<Status>("idle");
  const [selectedOperation, setSelectedOperation] =
    useState<OperationId>("extract-audio");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [largeVideoWarning, setLargeVideoWarning] = useState<string | null>(
    null,
  );
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);

  const [isFFmpegReady, setIsFFmpegReady] = useState<boolean>(false);
  const [ffmpegLoadProgress, setFFmpegLoadProgress] =
    useState<FFmpegLoadProgress | null>(null);
  const [execProgress, setExecProgress] = useState<number | null>(null);

  const [selectedAudioFormatId, setSelectedAudioFormatId] =
    useState<string>("mp3");
  const [selectedBitrateKbps, setSelectedBitrateKbps] = useState<number>(192);
  const [selectedVideoFormatId, setSelectedVideoFormatId] =
    useState<string>("mp4");

  const [videoDurationSeconds, setVideoDurationSeconds] =
    useState<number>(0);
  const [trimStartSeconds, setTrimStartSeconds] = useState<number>(0);
  const [trimEndSeconds, setTrimEndSeconds] = useState<number>(0);

  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const videoUrlRef = useRef<string | null>(null);
  const resultUrlRef = useRef<string | null>(null);
  const ffmpegLoadStartedRef = useRef<boolean>(false);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    videoUrlRef.current = videoUrl;
  }, [videoUrl]);

  useEffect(() => {
    resultUrlRef.current = resultUrl;
  }, [resultUrl]);

  useEffect(() => {
    return () => {
      if (videoUrlRef.current) {
        URL.revokeObjectURL(videoUrlRef.current);
      }
      if (resultUrlRef.current) {
        URL.revokeObjectURL(resultUrlRef.current);
      }
    };
  }, []);

  const ensureFFmpegLoading = useCallback((): void => {
    if (ffmpegLoadStartedRef.current) {
      return;
    }
    ffmpegLoadStartedRef.current = true;
    getFFmpeg((progress) => setFFmpegLoadProgress(progress))
      .then(() => {
        setIsFFmpegReady(true);
        setFFmpegLoadProgress(null);
      })
      .catch((error) => {
        console.error("[procesar-video] FFmpeg load failed", error);
        setErrorMessage(
          "No se pudo cargar FFmpeg. Recarga la página e inténtalo de nuevo.",
        );
        ffmpegLoadStartedRef.current = false;
      });
  }, []);

  const clearResult = useCallback((): void => {
    if (resultUrlRef.current) {
      URL.revokeObjectURL(resultUrlRef.current);
    }
    setResultUrl(null);
    setExecProgress(null);
  }, []);

  const resetVideoState = useCallback((): void => {
    if (videoUrlRef.current) {
      URL.revokeObjectURL(videoUrlRef.current);
    }
    clearResult();
    setVideoFile(null);
    setVideoUrl(null);
    setErrorMessage(null);
    setLargeVideoWarning(null);
    setVideoDurationSeconds(0);
    setTrimStartSeconds(0);
    setTrimEndSeconds(0);
    setStatus("idle");
  }, [clearResult]);

  const acceptVideo = useCallback(
    (file: File): void => {
      resetVideoState();
      setVideoFile(file);
      setVideoUrl(URL.createObjectURL(file));
      setLargeVideoWarning(
        isLargeVideo(file.size)
          ? `El video pesa ${formatFileSize(file.size)}. El procesamiento puede tardar o agotar la memoria del navegador.`
          : null,
      );
      setStatus("ready");
      ensureFFmpegLoading();
    },
    [resetVideoState, ensureFFmpegLoading],
  );

  const handleFileInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>): void => {
      const file: File | undefined = event.target.files?.[0];
      event.target.value = "";
      if (!file) {
        return;
      }
      if (!isAcceptedVideoFile(file)) {
        setErrorMessage(
          "Formato no soportado. Sube un video MP4, MOV, WEBM, AVI o MKV.",
        );
        setStatus("error");
        return;
      }
      acceptVideo(file);
    },
    [acceptVideo],
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLLabelElement>): void => {
      event.preventDefault();
      setIsDraggingOver(false);
      const file: File | undefined = event.dataTransfer.files?.[0];
      if (!file) {
        return;
      }
      if (!isAcceptedVideoFile(file)) {
        setErrorMessage(
          "Formato no soportado. Sube un video MP4, MOV, WEBM, AVI o MKV.",
        );
        setStatus("error");
        return;
      }
      acceptVideo(file);
    },
    [acceptVideo],
  );

  const handleDragOver = useCallback(
    (event: DragEvent<HTMLLabelElement>): void => {
      event.preventDefault();
      setIsDraggingOver(true);
    },
    [],
  );

  const handleDragLeave = useCallback((): void => {
    setIsDraggingOver(false);
  }, []);

  const handleOperationChange = useCallback(
    (operation: OperationId): void => {
      if (operation === selectedOperation) {
        return;
      }
      clearResult();
      setErrorMessage(null);
      setSelectedOperation(operation);
    },
    [selectedOperation, clearResult],
  );

  const applyDuration = useCallback((duration: number): void => {
    setVideoDurationSeconds(duration);
    setTrimStartSeconds(0);
    setTrimEndSeconds(duration);
  }, []);

  const handleLoadedMetadata = useCallback(
    (event: SyntheticEvent<HTMLVideoElement>): void => {
      const video: HTMLVideoElement = event.currentTarget;
      if (Number.isFinite(video.duration)) {
        applyDuration(video.duration);
        return;
      }
      // Chrome reports duration as Infinity for some MediaRecorder-produced
      // WebM files until the browser is forced to seek past the end; only
      // then does it compute and expose the real duration.
      const handleDurationDiscovered = (): void => {
        video.removeEventListener("timeupdate", handleDurationDiscovered);
        if (Number.isFinite(video.duration)) {
          applyDuration(video.duration);
        }
        video.currentTime = 0;
      };
      video.addEventListener("timeupdate", handleDurationDiscovered);
      video.currentTime = Number.MAX_SAFE_INTEGER;
    },
    [applyDuration],
  );

  const handleTimeUpdate = useCallback(
    (event: SyntheticEvent<HTMLVideoElement>): void => {
      if (
        selectedOperation === "trim-video" &&
        event.currentTarget.currentTime >= trimEndSeconds
      ) {
        event.currentTarget.pause();
      }
    },
    [selectedOperation, trimEndSeconds],
  );

  const handlePreviewFragment = useCallback((): void => {
    const video: HTMLVideoElement | null = videoElementRef.current;
    if (!video) {
      return;
    }
    video.currentTime = trimStartSeconds;
    void video.play();
  }, [trimStartSeconds]);

  const handleProcess = useCallback(async (): Promise<void> => {
    if (!videoFile) {
      return;
    }

    setStatus("processing");
    setErrorMessage(null);
    setExecProgress(0);

    try {
      const ffmpeg: FFmpegInstance = await getFFmpeg((progress) =>
        setFFmpegLoadProgress(progress),
      );
      setIsFFmpegReady(true);
      setFFmpegLoadProgress(null);

      const onProgress = ({ progress }: { progress: number }): void => {
        setExecProgress(Math.min(1, Math.max(0, progress)));
      };
      ffmpeg.on("progress", onProgress);

      try {
        let blob: Blob;
        if (selectedOperation === "extract-audio") {
          const format: AudioFormatOption | undefined = AUDIO_FORMATS.find(
            (option) => option.id === selectedAudioFormatId,
          );
          if (!format) {
            return;
          }
          blob = await extractAudio(ffmpeg, videoFile, {
            format,
            bitrateKbps: selectedBitrateKbps,
          });
        } else if (selectedOperation === "convert-format") {
          const format: VideoFormatOption | undefined = VIDEO_FORMATS.find(
            (option) => option.id === selectedVideoFormatId,
          );
          if (!format) {
            return;
          }
          blob = await convertFormat(ffmpeg, videoFile, { format });
        } else {
          if (trimEndSeconds <= trimStartSeconds) {
            return;
          }
          blob = await trimVideo(ffmpeg, videoFile, {
            startSeconds: trimStartSeconds,
            endSeconds: trimEndSeconds,
          });
        }

        if (resultUrlRef.current) {
          URL.revokeObjectURL(resultUrlRef.current);
        }
        setResultUrl(URL.createObjectURL(blob));
        setStatus("done");
      } finally {
        ffmpeg.off("progress", onProgress);
      }
    } catch (error) {
      console.error("[procesar-video] processing failed", error);
      setErrorMessage(
        selectedOperation === "extract-audio"
          ? "No se pudo extraer el audio. Prueba con otro archivo."
          : selectedOperation === "convert-format"
            ? "No se pudo convertir el video. Prueba con otro archivo."
            : "No se pudo recortar el video. Prueba con otro archivo.",
      );
      setStatus("error");
    }
  }, [
    videoFile,
    selectedOperation,
    selectedAudioFormatId,
    selectedBitrateKbps,
    selectedVideoFormatId,
    trimStartSeconds,
    trimEndSeconds,
  ]);

  const handleClear = useCallback((): void => {
    resetVideoState();
  }, [resetVideoState]);

  const handleDownload = useCallback((): void => {
    if (!resultUrl || !videoFile) {
      return;
    }

    let fileName: string;
    if (selectedOperation === "extract-audio") {
      const format: AudioFormatOption | undefined = AUDIO_FORMATS.find(
        (option) => option.id === selectedAudioFormatId,
      );
      if (!format) {
        return;
      }
      fileName = buildOutputFileName(videoFile.name, "audio", format.extension);
    } else if (selectedOperation === "convert-format") {
      const format: VideoFormatOption | undefined = VIDEO_FORMATS.find(
        (option) => option.id === selectedVideoFormatId,
      );
      if (!format) {
        return;
      }
      fileName = buildOutputFileName(
        videoFile.name,
        "convertido",
        format.extension,
      );
    } else {
      fileName = buildOutputFileName(videoFile.name, "recortado", "mp4");
    }

    const anchor: HTMLAnchorElement = document.createElement("a");
    anchor.href = resultUrl;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  }, [
    resultUrl,
    videoFile,
    selectedOperation,
    selectedAudioFormatId,
    selectedVideoFormatId,
  ]);

  const isProcessing: boolean = status === "processing";
  const hasVideo: boolean = videoFile !== null;
  const selectedAudioFormat: AudioFormatOption | undefined = AUDIO_FORMATS.find(
    (option) => option.id === selectedAudioFormatId,
  );
  const showFFmpegLoadProgress: boolean =
    !isFFmpegReady && ffmpegLoadProgress !== null;
  const isTrimRangeValid: boolean = trimEndSeconds > trimStartSeconds;
  const processButtonLabel: string =
    selectedOperation === "extract-audio"
      ? "Extraer audio"
      : selectedOperation === "convert-format"
        ? "Convertir video"
        : "Recortar video";
  const processingLabel: string =
    selectedOperation === "extract-audio"
      ? "Extrayendo audio..."
      : selectedOperation === "convert-format"
        ? "Convirtiendo video..."
        : "Recortando video...";
  const downloadButtonLabel: string =
    selectedOperation === "extract-audio" ? "Descargar audio" : "Descargar video";
  const isProcessDisabled: boolean =
    !hasVideo ||
    isProcessing ||
    (selectedOperation === "trim-video" && !isTrimRangeValid);

  return (
    <div className="flex w-full flex-col gap-6">
      <label
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          isDraggingOver
            ? "border-black bg-black/[.04] dark:border-white dark:bg-white/[.08]"
            : "border-black/[.15] hover:bg-black/[.02] dark:border-white/[.2] dark:hover:bg-white/[.04]"
        }`}
      >
        <span className="text-sm font-medium text-black dark:text-zinc-50">
          Arrastra un video aquí o haz clic para seleccionarlo
        </span>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          Formatos aceptados: {ACCEPTED_VIDEO_EXTENSIONS.join(", ")}
        </span>
        <input
          type="file"
          accept="video/*,.mp4,.mov,.webm,.avi,.mkv"
          onChange={handleFileInputChange}
          className="hidden"
        />
      </label>

      {errorMessage && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {errorMessage}
        </p>
      )}

      {largeVideoWarning && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:bg-amber-950 dark:text-amber-300">
          {largeVideoWarning}
        </p>
      )}

      {videoUrl && (
        <video
          ref={videoElementRef}
          controls
          src={videoUrl}
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
          className="w-full rounded-xl border border-black/[.08] dark:border-white/[.145]"
        />
      )}

      {hasVideo && (
        <div className="flex gap-2 rounded-full border border-black/[.08] p-1 dark:border-white/[.145]">
          {OPERATIONS.map((operation) => (
            <button
              key={operation.id}
              type="button"
              onClick={() => handleOperationChange(operation.id)}
              disabled={isProcessing}
              className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                selectedOperation === operation.id
                  ? "bg-foreground text-background"
                  : "text-zinc-600 hover:bg-black/[.04] dark:text-zinc-400 dark:hover:bg-white/[.08]"
              }`}
            >
              {operation.label}
            </button>
          ))}
        </div>
      )}

      {showFFmpegLoadProgress && ffmpegLoadProgress && (
        <div className="flex flex-col gap-2">
          <div className="h-2 w-full overflow-hidden rounded-full bg-black/[.08] dark:bg-white/[.145]">
            <div
              className="h-full rounded-full bg-foreground transition-all"
              style={{ width: `${ffmpegLoadProgress.percentage}%` }}
            />
          </div>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Cargando FFmpeg — {ffmpegLoadProgress.file}:{" "}
            {ffmpegLoadProgress.percentage}%
          </span>
        </div>
      )}

      {hasVideo && selectedOperation === "extract-audio" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              Formato de salida
            </span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {AUDIO_FORMATS.map((format) => (
                <button
                  key={format.id}
                  type="button"
                  onClick={() => setSelectedAudioFormatId(format.id)}
                  disabled={isProcessing}
                  className={`rounded-xl border px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    selectedAudioFormatId === format.id
                      ? "border-black bg-black/[.04] dark:border-white dark:bg-white/[.08]"
                      : "border-black/[.08] hover:bg-black/[.02] dark:border-white/[.145] dark:hover:bg-white/[.04]"
                  }`}
                >
                  {format.label}
                </button>
              ))}
            </div>
          </div>

          {selectedAudioFormat?.supportsBitrate && (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                Calidad (bitrate)
              </span>
              <div className="grid grid-cols-4 gap-2">
                {AUDIO_BITRATES_KBPS.map((bitrate) => (
                  <button
                    key={bitrate}
                    type="button"
                    onClick={() => setSelectedBitrateKbps(bitrate)}
                    disabled={isProcessing}
                    className={`rounded-xl border px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      selectedBitrateKbps === bitrate
                        ? "border-black bg-black/[.04] dark:border-white dark:bg-white/[.08]"
                        : "border-black/[.08] hover:bg-black/[.02] dark:border-white/[.145] dark:hover:bg-white/[.04]"
                    }`}
                  >
                    {bitrate} kbps
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {hasVideo && selectedOperation === "convert-format" && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            Formato de salida
          </span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {VIDEO_FORMATS.map((format) => (
              <button
                key={format.id}
                type="button"
                onClick={() => setSelectedVideoFormatId(format.id)}
                disabled={isProcessing}
                className={`rounded-xl border px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  selectedVideoFormatId === format.id
                    ? "border-black bg-black/[.04] dark:border-white dark:bg-white/[.08]"
                    : "border-black/[.08] hover:bg-black/[.02] dark:border-white/[.145] dark:hover:bg-white/[.04]"
                }`}
              >
                {format.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {hasVideo && selectedOperation === "trim-video" && (
        <div className="flex flex-col gap-4">
          <TrimTimeline
            durationSeconds={videoDurationSeconds}
            startSeconds={trimStartSeconds}
            endSeconds={trimEndSeconds}
            onChange={(start, end) => {
              setTrimStartSeconds(start);
              setTrimEndSeconds(end);
            }}
          />

          {!isTrimRangeValid && (
            <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              El fin del recorte debe ser posterior al inicio.
            </p>
          )}

          <button
            type="button"
            onClick={handlePreviewFragment}
            disabled={isProcessing || !isTrimRangeValid}
            className="flex h-10 items-center justify-center self-start rounded-full border border-solid border-black/[.08] px-5 text-sm font-medium transition-colors hover:border-transparent hover:bg-black/[.04] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
          >
            Previsualizar fragmento
          </button>
        </div>
      )}

      {isProcessing && (
        <div className="flex flex-col gap-2">
          <div className="h-2 w-full overflow-hidden rounded-full bg-black/[.08] dark:bg-white/[.145]">
            <div
              className="h-full rounded-full bg-foreground transition-all"
              style={{ width: `${Math.round((execProgress ?? 0) * 100)}%` }}
            />
          </div>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {processingLabel} {Math.round((execProgress ?? 0) * 100)}%
          </span>
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row">
        <button
          type="button"
          onClick={handleProcess}
          disabled={isProcessDisabled}
          className="flex h-12 flex-1 items-center justify-center rounded-full bg-foreground px-5 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-[#ccc]"
        >
          {isProcessing ? processingLabel : processButtonLabel}
        </button>

        {resultUrl && (
          <button
            type="button"
            onClick={handleDownload}
            className="flex h-12 flex-1 items-center justify-center rounded-full border border-solid border-black/[.08] px-5 text-sm font-medium transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
          >
            {downloadButtonLabel}
          </button>
        )}

        {hasVideo && (
          <button
            type="button"
            onClick={handleClear}
            disabled={isProcessing}
            className="flex h-12 flex-1 items-center justify-center rounded-full border border-solid border-black/[.08] px-5 text-sm font-medium transition-colors hover:border-transparent hover:bg-black/[.04] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
          >
            Limpiar
          </button>
        )}
      </div>
    </div>
  );
}
