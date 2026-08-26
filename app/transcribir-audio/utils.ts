export const ACCEPTED_AUDIO_EXTENSIONS: readonly string[] = [
  ".mp3",
  ".wav",
  ".m4a",
  ".ogg",
  ".webm",
];

export const LONG_AUDIO_THRESHOLD_SECONDS: number = 5 * 60;

const WHISPER_SAMPLE_RATE: number = 16000;

export function isAcceptedAudioFile(file: File): boolean {
  if (file.type.startsWith("audio/")) {
    return true;
  }
  const lowerCaseName: string = file.name.toLowerCase();
  return ACCEPTED_AUDIO_EXTENSIONS.some((extension) =>
    lowerCaseName.endsWith(extension),
  );
}

export function isLongAudio(durationSeconds: number): boolean {
  return durationSeconds > LONG_AUDIO_THRESHOLD_SECONDS;
}

export function formatDuration(durationSeconds: number): string {
  const totalSeconds: number = Math.round(durationSeconds);
  const minutes: number = Math.floor(totalSeconds / 60);
  const seconds: number = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function buildTranscriptFileName(sourceName: string | null): string {
  if (!sourceName) {
    return "transcripcion.txt";
  }
  const lastDotIndex: number = sourceName.lastIndexOf(".");
  const baseName: string =
    lastDotIndex > 0 ? sourceName.slice(0, lastDotIndex) : sourceName;
  return `${baseName}.txt`;
}

export function buildDefaultRecordingTitle(date: Date): string {
  return `Grabación ${date.toLocaleString("es-ES", {
    dateStyle: "short",
    timeStyle: "medium",
  })}`;
}

export interface DecodedAudio {
  samples: Float32Array;
  durationSeconds: number;
}

export async function decodeToMono16kHz(blob: Blob): Promise<DecodedAudio> {
  const arrayBuffer: ArrayBuffer = await blob.arrayBuffer();
  const AudioContextClass: typeof AudioContext =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  const decodingContext: AudioContext = new AudioContextClass();

  let decoded: AudioBuffer;
  try {
    decoded = await decodingContext.decodeAudioData(arrayBuffer);
  } finally {
    await decodingContext.close();
  }

  const offlineContext: OfflineAudioContext = new OfflineAudioContext(
    1,
    Math.ceil(decoded.duration * WHISPER_SAMPLE_RATE),
    WHISPER_SAMPLE_RATE,
  );
  const source: AudioBufferSourceNode = offlineContext.createBufferSource();
  source.buffer = decoded;
  source.connect(offlineContext.destination);
  source.start(0);
  const rendered: AudioBuffer = await offlineContext.startRendering();

  return {
    samples: rendered.getChannelData(0),
    durationSeconds: decoded.duration,
  };
}
