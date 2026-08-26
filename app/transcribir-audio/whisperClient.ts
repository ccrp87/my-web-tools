export interface WhisperModelOption {
  id: string;
  label: string;
  approximateSizeMb: number;
  description: string;
}

export const WHISPER_MODELS: readonly WhisperModelOption[] = [
  {
    id: "Xenova/whisper-tiny",
    label: "Tiny",
    approximateSizeMb: 39,
    description: "Más rápido, menor calidad.",
  },
  {
    id: "Xenova/whisper-base",
    label: "Base",
    approximateSizeMb: 73,
    description: "Equilibrio entre velocidad y calidad.",
  },
  {
    id: "Xenova/whisper-small",
    label: "Small",
    approximateSizeMb: 238,
    description: "Mejor calidad, más lento y pesado.",
  },
];

export const DEFAULT_WHISPER_MODEL_ID: string = "Xenova/whisper-base";

export interface ModelDownloadProgress {
  file: string;
  percentage: number;
}

export interface TranscriptionResult {
  text: string;
}

type ProgressCallback = (progress: ModelDownloadProgress) => void;

interface TranscriberPipeline {
  (
    audio: Float32Array,
    options?: Record<string, unknown>,
  ): Promise<TranscriptionResult>;
  dispose: () => Promise<void>;
}

interface RawProgressEvent {
  status: string;
  file?: string;
  loaded?: number;
  total?: number;
}

interface ActivePipeline {
  modelId: string;
  promise: Promise<TranscriberPipeline>;
}

let activePipeline: ActivePipeline | null = null;

async function loadPipeline(
  modelId: string,
  onProgress: ProgressCallback,
): Promise<TranscriberPipeline> {
  const { pipeline } = await import("@xenova/transformers");
  return pipeline("automatic-speech-recognition", modelId, {
    progress_callback: (event: RawProgressEvent): void => {
      if (event.status !== "progress" || !event.file || !event.total) {
        return;
      }
      onProgress({
        file: event.file,
        percentage: Math.round(((event.loaded ?? 0) / event.total) * 100),
      });
    },
  }) as unknown as TranscriberPipeline;
}

async function getTranscriber(
  modelId: string,
  onProgress: ProgressCallback,
): Promise<TranscriberPipeline> {
  if (activePipeline && activePipeline.modelId === modelId) {
    return activePipeline.promise;
  }

  const previous: ActivePipeline | null = activePipeline;
  const nextPromise: Promise<TranscriberPipeline> = (async (): Promise<
    TranscriberPipeline
  > => {
    if (previous) {
      try {
        const previousTranscriber: TranscriberPipeline = await previous.promise;
        await previousTranscriber.dispose();
      } catch {
        // The previous model never finished loading or failed to dispose;
        // nothing to release in that case.
      }
    }
    return loadPipeline(modelId, onProgress);
  })();

  activePipeline = { modelId, promise: nextPromise };
  return nextPromise;
}

export async function transcribeAudio(
  audioData: Float32Array,
  modelId: string,
  onModelProgress: ProgressCallback,
  onModelReady?: () => void,
): Promise<TranscriptionResult> {
  const transcriber: TranscriberPipeline = await getTranscriber(
    modelId,
    onModelProgress,
  );
  onModelReady?.();
  return transcriber(audioData, {
    chunk_length_s: 30,
    stride_length_s: 5,
  });
}
