"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import {
  saveRecording,
  updateRecordingTranscript,
  type RecordingEntry,
} from "./db";
import { RecordingsLibrary } from "./RecordingsLibrary";
import {
  ACCEPTED_AUDIO_EXTENSIONS,
  buildDefaultRecordingTitle,
  buildTranscriptFileName,
  decodeToMono16kHz,
  formatDuration,
  isAcceptedAudioFile,
  isLongAudio,
} from "./utils";
import {
  DEFAULT_WHISPER_MODEL_ID,
  WHISPER_MODELS,
  transcribeAudio,
  type ModelDownloadProgress,
} from "./whisperClient";

type Mode = "upload" | "record";
type Status = "idle" | "ready" | "transcribing" | "done" | "error";

export function AudioTranscriber(): React.JSX.Element {
  const [mode, setMode] = useState<Mode>("upload");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [longAudioWarning, setLongAudioWarning] = useState<string | null>(
    null,
  );
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioFileName, setAudioFileName] = useState<string | null>(null);
  const [monoAudioData, setMonoAudioData] = useState<Float32Array | null>(
    null,
  );
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  const [modelProgress, setModelProgress] =
    useState<ModelDownloadProgress | null>(null);
  const [isInferring, setIsInferring] = useState<boolean>(false);
  const [transcriptText, setTranscriptText] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [selectedModelId, setSelectedModelId] = useState<string>(
    DEFAULT_WHISPER_MODEL_ID,
  );

  const audioUrlRef = useRef<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentRecordingIdRef = useRef<number | null>(null);

  useEffect(() => {
    audioUrlRef.current = audioUrl;
  }, [audioUrl]);

  useEffect(() => {
    return () => {
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const resetAudioState = useCallback((): void => {
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
    }
    currentRecordingIdRef.current = null;
    setAudioUrl(null);
    setAudioFileName(null);
    setMonoAudioData(null);
    setErrorMessage(null);
    setLongAudioWarning(null);
    setModelProgress(null);
    setIsInferring(false);
    setTranscriptText(null);
    setStatus("idle");
  }, []);

  const acceptAudio = useCallback(
    async (blob: Blob, fileName: string | null): Promise<void> => {
      resetAudioState();
      setAudioFileName(fileName);

      try {
        const { samples, durationSeconds } = await decodeToMono16kHz(blob);
        setAudioUrl(URL.createObjectURL(blob));
        setMonoAudioData(samples);
        setLongAudioWarning(
          isLongAudio(durationSeconds)
            ? `El audio dura ${formatDuration(durationSeconds)}. La transcripción puede tardar más de lo normal.`
            : null,
        );
        setStatus("ready");
      } catch {
        setErrorMessage("No se pudo leer el audio. Prueba con otro archivo.");
        setStatus("error");
      }
    },
    [resetAudioState],
  );

  const handleFileInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>): void => {
      const file: File | undefined = event.target.files?.[0];
      event.target.value = "";
      if (!file) {
        return;
      }
      if (!isAcceptedAudioFile(file)) {
        setErrorMessage(
          "Formato no soportado. Sube un audio MP3, WAV, M4A, OGG o WEBM.",
        );
        setStatus("error");
        return;
      }
      void acceptAudio(file, file.name);
    },
    [acceptAudio],
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLLabelElement>): void => {
      event.preventDefault();
      setIsDraggingOver(false);
      const file: File | undefined = event.dataTransfer.files?.[0];
      if (!file) {
        return;
      }
      if (!isAcceptedAudioFile(file)) {
        setErrorMessage(
          "Formato no soportado. Sube un audio MP3, WAV, M4A, OGG o WEBM.",
        );
        setStatus("error");
        return;
      }
      void acceptAudio(file, file.name);
    },
    [acceptAudio],
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

  const handleStartRecording = useCallback(async (): Promise<void> => {
    setErrorMessage(null);
    try {
      const stream: MediaStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      streamRef.current = stream;
      recordedChunksRef.current = [];

      const recorder: MediaRecorder = new MediaRecorder(stream);
      recorder.ondataavailable = (event: BlobEvent): void => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };
      recorder.onstop = (): void => {
        const blob: Blob = new Blob(recordedChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        currentRecordingIdRef.current = null;
        void (async (): Promise<void> => {
          await acceptAudio(blob, null);
          try {
            currentRecordingIdRef.current = await saveRecording(
              blob,
              buildDefaultRecordingTitle(new Date()),
            );
          } catch {
            setErrorMessage(
              "El almacenamiento del navegador está lleno. No se pudo guardar la grabación en la biblioteca.",
            );
          }
        })();
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch {
      setErrorMessage(
        "Permiso de micrófono denegado. Habilítalo en la configuración del navegador para grabar audio.",
      );
      setStatus("error");
      setIsRecording(false);
    }
  }, [acceptAudio]);

  const handleStopRecording = useCallback((): void => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  }, []);

  const handleModeChange = useCallback(
    (nextMode: Mode): void => {
      if (nextMode === mode) {
        return;
      }
      if (isRecording) {
        handleStopRecording();
      }
      resetAudioState();
      setMode(nextMode);
    },
    [mode, isRecording, handleStopRecording, resetAudioState],
  );

  const handleViewRecording = useCallback(
    (recording: RecordingEntry): void => {
      if (isRecording) {
        handleStopRecording();
      }
      resetAudioState();
      currentRecordingIdRef.current = recording.id;
      setAudioFileName(recording.title);
      setAudioUrl(URL.createObjectURL(recording.audio));
      setTranscriptText(recording.transcript);
      setStatus(recording.transcript ? "done" : "ready");
      void decodeToMono16kHz(recording.audio)
        .then(({ samples, durationSeconds }) => {
          setMonoAudioData(samples);
          setLongAudioWarning(
            isLongAudio(durationSeconds)
              ? `El audio dura ${formatDuration(durationSeconds)}. La transcripción puede tardar más de lo normal.`
              : null,
          );
        })
        .catch(() => {
          setErrorMessage("No se pudo leer el audio de esta grabación.");
        });
    },
    [isRecording, handleStopRecording, resetAudioState],
  );

  const handleTranscribe = useCallback(async (): Promise<void> => {
    if (!monoAudioData) {
      return;
    }
    setStatus("transcribing");
    setErrorMessage(null);
    setIsInferring(false);
    setModelProgress(null);

    try {
      const result = await transcribeAudio(
        monoAudioData,
        selectedModelId,
        (progress) => setModelProgress(progress),
        () => setIsInferring(true),
      );
      const trimmedText: string = result.text.trim();
      setTranscriptText(trimmedText);
      setStatus("done");
      if (currentRecordingIdRef.current !== null) {
        void updateRecordingTranscript(
          currentRecordingIdRef.current,
          trimmedText,
        );
      }
    } catch (error) {
      console.error("[transcribir-audio] transcribeAudio failed", error);
      const errorText: string =
        error instanceof Error ? error.message : String(error);
      setErrorMessage(
        /OrtRun|memory/i.test(errorText)
          ? "Este modelo requiere más memoria de la que tu navegador tiene disponible. Prueba con un modelo más pequeño (Tiny o Base)."
          : "No se pudo transcribir el audio. Intenta con otro archivo.",
      );
      setStatus("error");
    }
  }, [monoAudioData, selectedModelId]);

  const handleClear = useCallback((): void => {
    if (isRecording) {
      handleStopRecording();
    }
    resetAudioState();
  }, [isRecording, handleStopRecording, resetAudioState]);

  const handleCopy = useCallback(async (): Promise<void> => {
    if (!transcriptText) {
      return;
    }
    try {
      await navigator.clipboard.writeText(transcriptText);
      setCopied(true);
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setErrorMessage(
        "No se pudo copiar automáticamente. Selecciona el texto y copia con Ctrl+C.",
      );
    }
  }, [transcriptText]);

  const handleDownload = useCallback((): void => {
    if (!transcriptText) {
      return;
    }
    const blob: Blob = new Blob([transcriptText], {
      type: "text/plain;charset=utf-8",
    });
    const url: string = URL.createObjectURL(blob);
    const anchor: HTMLAnchorElement = document.createElement("a");
    anchor.href = url;
    anchor.download = buildTranscriptFileName(audioFileName);
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, [transcriptText, audioFileName]);

  const isTranscribing: boolean = status === "transcribing";
  const showDownloadProgress: boolean =
    isTranscribing && !isInferring && modelProgress !== null;
  const showSpinner: boolean =
    isTranscribing && (isInferring || modelProgress === null);
  const hasAudio: boolean = monoAudioData !== null;

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex gap-2 rounded-full border border-black/[.08] p-1 dark:border-white/[.145]">
        <button
          type="button"
          onClick={() => handleModeChange("upload")}
          className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            mode === "upload"
              ? "bg-foreground text-background"
              : "text-zinc-600 hover:bg-black/[.04] dark:text-zinc-400 dark:hover:bg-white/[.08]"
          }`}
        >
          Subir archivo
        </button>
        <button
          type="button"
          onClick={() => handleModeChange("record")}
          className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            mode === "record"
              ? "bg-foreground text-background"
              : "text-zinc-600 hover:bg-black/[.04] dark:text-zinc-400 dark:hover:bg-white/[.08]"
          }`}
        >
          Grabar audio
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
          Modelo de transcripción
        </span>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {WHISPER_MODELS.map((model) => (
            <button
              key={model.id}
              type="button"
              onClick={() => setSelectedModelId(model.id)}
              disabled={isTranscribing}
              className={`flex flex-col items-start gap-0.5 rounded-xl border px-4 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                selectedModelId === model.id
                  ? "border-black bg-black/[.04] dark:border-white dark:bg-white/[.08]"
                  : "border-black/[.08] hover:bg-black/[.02] dark:border-white/[.145] dark:hover:bg-white/[.04]"
              }`}
            >
              <span className="text-sm font-medium text-black dark:text-zinc-50">
                {model.label} — ~{model.approximateSizeMb} MB
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {model.description}
              </span>
            </button>
          ))}
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Los modelos más grandes ofrecen mejor calidad, pero tardan más en
          descargarse y transcribir. En equipos con poca memoria disponible,
          un modelo grande puede fallar por falta de memoria — si eso pasa,
          prueba con uno más pequeño.
        </p>
      </div>

      {mode === "upload" ? (
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
            Arrastra un audio aquí o haz clic para seleccionarlo
          </span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Formatos aceptados: {ACCEPTED_AUDIO_EXTENSIONS.join(", ")}
          </span>
          <input
            type="file"
            accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm"
            onChange={handleFileInputChange}
            className="hidden"
          />
        </label>
      ) : (
        <div className="flex w-full flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-black/[.15] px-6 py-10 text-center dark:border-white/[.2]">
          {isRecording && (
            <div className="flex items-center gap-2 text-sm font-medium text-red-600 dark:text-red-400">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-600 dark:bg-red-400" />
              Grabando...
            </div>
          )}
          <button
            type="button"
            onClick={isRecording ? handleStopRecording : handleStartRecording}
            className="flex h-12 items-center justify-center rounded-full bg-foreground px-6 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
          >
            {isRecording ? "Detener grabación" : "Iniciar grabación"}
          </button>
        </div>
      )}

      {mode === "record" && (
        <RecordingsLibrary onView={handleViewRecording} />
      )}

      {errorMessage && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {errorMessage}
        </p>
      )}

      {longAudioWarning && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:bg-amber-950 dark:text-amber-300">
          {longAudioWarning}
        </p>
      )}

      {audioUrl && mode === "upload" && (
        <audio
          controls
          src={audioUrl}
          className="w-full"
          aria-label="Vista previa del audio"
        />
      )}

      {isTranscribing && (
        <div className="flex flex-col gap-2">
          {showDownloadProgress && modelProgress && (
            <>
              <div className="h-2 w-full overflow-hidden rounded-full bg-black/[.08] dark:bg-white/[.145]">
                <div
                  className="h-full rounded-full bg-foreground transition-all"
                  style={{ width: `${modelProgress.percentage}%` }}
                />
              </div>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                Descargando modelo — {modelProgress.file}:{" "}
                {modelProgress.percentage}%
              </span>
            </>
          )}
          {showSpinner && (
            <div className="flex items-center gap-3">
              <span
                role="status"
                aria-label="Transcribiendo"
                className="h-6 w-6 animate-spin rounded-full border-4 border-black/10 border-t-foreground dark:border-white/10"
              />
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                Transcribiendo...
              </span>
            </div>
          )}
        </div>
      )}

      {transcriptText !== null && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            Transcripción
          </span>
          <textarea
            value={transcriptText}
            onChange={(event) => setTranscriptText(event.target.value)}
            rows={10}
            className="w-full rounded-xl border border-black/[.08] bg-white p-4 text-sm leading-6 text-black dark:border-white/[.145] dark:bg-zinc-900 dark:text-zinc-50"
          />
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row">
        <button
          type="button"
          onClick={handleTranscribe}
          disabled={!hasAudio || isTranscribing}
          className="flex h-12 flex-1 items-center justify-center rounded-full bg-foreground px-5 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-[#ccc]"
        >
          {isTranscribing ? "Transcribiendo..." : "Transcribir"}
        </button>

        {transcriptText !== null && (
          <>
            <button
              type="button"
              onClick={handleCopy}
              className="flex h-12 flex-1 items-center justify-center rounded-full border border-solid border-black/[.08] px-5 text-sm font-medium transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
            >
              {copied ? "¡Copiado!" : "Copiar"}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="flex h-12 flex-1 items-center justify-center rounded-full border border-solid border-black/[.08] px-5 text-sm font-medium transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
            >
              Descargar .txt
            </button>
          </>
        )}

        {(hasAudio || transcriptText !== null) && (
          <button
            type="button"
            onClick={handleClear}
            disabled={isTranscribing}
            className="flex h-12 flex-1 items-center justify-center rounded-full border border-solid border-black/[.08] px-5 text-sm font-medium transition-colors hover:border-transparent hover:bg-black/[.04] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
          >
            Limpiar
          </button>
        )}
      </div>
    </div>
  );
}
