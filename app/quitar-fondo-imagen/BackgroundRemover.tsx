"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import { BeforeAfterSlider } from "./BeforeAfterSlider";
import {
  ACCEPTED_IMAGE_TYPES,
  buildDownloadFileName,
  formatFileSize,
  isAcceptedImageType,
  isLargeFile,
} from "./utils";

type Status = "idle" | "ready" | "processing" | "done" | "error";

interface ProcessingProgress {
  key: string;
  percentage: number;
}

export function BackgroundRemover(): React.JSX.Element {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [largeFileWarning, setLargeFileWarning] = useState<string | null>(
    null,
  );
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProcessingProgress | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);

  const previewUrlRef = useRef<string | null>(null);
  const resultUrlRef = useRef<string | null>(null);

  useEffect(() => {
    previewUrlRef.current = previewUrl;
  }, [previewUrl]);

  useEffect(() => {
    resultUrlRef.current = resultUrl;
  }, [resultUrl]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
      if (resultUrlRef.current) {
        URL.revokeObjectURL(resultUrlRef.current);
      }
    };
  }, []);

  const resetResult = useCallback((): void => {
    if (resultUrlRef.current) {
      URL.revokeObjectURL(resultUrlRef.current);
    }
    setResultUrl(null);
    setProgress(null);
  }, []);

  const acceptFile = useCallback(
    (file: File): void => {
      if (!isAcceptedImageType(file)) {
        setErrorMessage(
          "Formato no soportado. Sube una imagen JPG, PNG o WEBP.",
        );
        setStatus("error");
        return;
      }

      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
      resetResult();

      setErrorMessage(null);
      setLargeFileWarning(
        isLargeFile(file)
          ? `La imagen pesa ${formatFileSize(file.size)}. El procesamiento puede tardar más de lo normal.`
          : null,
      );
      setSourceFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setStatus("ready");
    },
    [resetResult],
  );

  const handleFileInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>): void => {
      const file: File | undefined = event.target.files?.[0];
      if (file) {
        acceptFile(file);
      }
      event.target.value = "";
    },
    [acceptFile],
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLLabelElement>): void => {
      event.preventDefault();
      setIsDraggingOver(false);
      const file: File | undefined = event.dataTransfer.files?.[0];
      if (file) {
        acceptFile(file);
      }
    },
    [acceptFile],
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

  const handleRemoveBackground = useCallback(async (): Promise<void> => {
    if (!sourceFile) {
      return;
    }

    setStatus("processing");
    setErrorMessage(null);
    setProgress({ key: "iniciando", percentage: 0 });

    try {
      const { removeBackground } = await import("@imgly/background-removal");

      const blob: Blob = await removeBackground(sourceFile, {
        model: "isnet_quint8",
        progress: (key: string, current: number, total: number): void => {
          const percentage: number =
            total > 0 ? Math.round((current / total) * 100) : 0;
          setProgress({ key, percentage });
        },
      });

      if (resultUrlRef.current) {
        URL.revokeObjectURL(resultUrlRef.current);
      }
      setResultUrl(URL.createObjectURL(blob));
      setStatus("done");
    } catch (error) {
      console.error("[quitar-fondo-imagen] removeBackground failed", error);
      setErrorMessage(
        "No se pudo quitar el fondo de la imagen. Intenta con otra imagen.",
      );
      setStatus("error");
    }
  }, [sourceFile]);

  const handleClear = useCallback((): void => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
    if (resultUrlRef.current) {
      URL.revokeObjectURL(resultUrlRef.current);
    }
    setSourceFile(null);
    setPreviewUrl(null);
    setResultUrl(null);
    setErrorMessage(null);
    setLargeFileWarning(null);
    setProgress(null);
    setStatus("idle");
  }, []);

  const isProcessing: boolean = status === "processing";
  const downloadFileName: string | null = sourceFile
    ? buildDownloadFileName(sourceFile.name)
    : null;

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
          Arrastra una imagen aquí o haz clic para seleccionarla
        </span>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          Formatos aceptados: JPG, PNG, WEBP
        </span>
        <input
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(",")}
          onChange={handleFileInputChange}
          className="hidden"
        />
      </label>

      {errorMessage && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {errorMessage}
        </p>
      )}

      {largeFileWarning && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:bg-amber-950 dark:text-amber-300">
          {largeFileWarning}
        </p>
      )}

      {previewUrl && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            {resultUrl
              ? "Arrastra el divisor para comparar"
              : "Vista previa"}
          </span>

          {resultUrl ? (
            <BeforeAfterSlider
              beforeSrc={previewUrl}
              beforeAlt="Imagen original"
              afterSrc={resultUrl}
              afterAlt="Imagen con el fondo eliminado"
            />
          ) : (
            <div className="relative w-full overflow-hidden rounded-xl border border-black/[.08] dark:border-white/[.145]">
              <img
                src={previewUrl}
                alt="Vista previa de la imagen"
                className="block w-full h-auto"
              />
              {isProcessing && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <span
                    role="status"
                    aria-label="Procesando imagen"
                    className="h-10 w-10 animate-spin rounded-full border-4 border-white/30 border-t-white"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {isProcessing && progress && (
        <div className="flex flex-col gap-2">
          <div className="h-2 w-full overflow-hidden rounded-full bg-black/[.08] dark:bg-white/[.145]">
            <div
              className="h-full rounded-full bg-foreground transition-all"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {progress.key}: {progress.percentage}%
          </span>
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row">
        <button
          type="button"
          onClick={handleRemoveBackground}
          disabled={!sourceFile || isProcessing}
          className="flex h-12 flex-1 items-center justify-center rounded-full bg-foreground px-5 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-[#ccc]"
        >
          {isProcessing ? "Quitando fondo..." : "Quitar fondo"}
        </button>

        {resultUrl && downloadFileName && (
          <a
            href={resultUrl}
            download={downloadFileName}
            className="flex h-12 flex-1 items-center justify-center rounded-full border border-solid border-black/[.08] px-5 text-sm font-medium transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
          >
            Descargar PNG
          </a>
        )}

        {sourceFile && (
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
