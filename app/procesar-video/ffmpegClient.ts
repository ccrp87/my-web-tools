const FFMPEG_CORE_VERSION: string = "0.12.10";
const FFMPEG_CORE_BASE_URL: string = `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/umd`;

export interface FFmpegLoadProgress {
  file: string;
  percentage: number;
}

export interface FFmpegExecProgress {
  ratio: number;
}

type LoadProgressCallback = (progress: FFmpegLoadProgress) => void;

interface FFmpegInstance {
  loaded: boolean;
  on(
    event: "progress",
    callback: (event: { progress: number }) => void,
  ): void;
  off(
    event: "progress",
    callback: (event: { progress: number }) => void,
  ): void;
  load(config: { coreURL: string; wasmURL: string }): Promise<boolean>;
  exec(args: string[]): Promise<number>;
  writeFile(path: string, data: Uint8Array): Promise<boolean>;
  readFile(path: string): Promise<Uint8Array | string>;
  deleteFile(path: string): Promise<boolean>;
}

let ffmpegPromise: Promise<FFmpegInstance> | null = null;

// @ffmpeg/util's toBlobURL/downloadWithProgress compares received bytes
// against the Content-Length header and throws if they don't match. CDNs
// often serve these files transport-compressed, so fetch() delivers more
// (decompressed) bytes than that header promises — which both breaks its
// progress math and makes it throw. This is a tolerant replacement: it
// reports progress as bytes actually received and never treats a
// received/total mismatch as an error.
async function fetchAsBlobURL(
  url: string,
  mimeType: string,
  onChunk?: (received: number, total: number) => void,
): Promise<string> {
  const response: Response = await fetch(url);
  const total: number = Number(response.headers.get("Content-Length") ?? 0);
  const reader = response.body?.getReader();

  if (!reader) {
    const buffer: ArrayBuffer = await response.arrayBuffer();
    return URL.createObjectURL(new Blob([buffer], { type: mimeType }));
  }

  // The stream's chunks are backed by regular ArrayBuffers (not shared);
  // the cast just satisfies BlobPart's stricter generic.
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let received: number = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (value) {
      chunks.push(value as Uint8Array<ArrayBuffer>);
      received += value.length;
      onChunk?.(received, total);
    }
  }

  return URL.createObjectURL(new Blob(chunks, { type: mimeType }));
}

async function createFFmpeg(
  onLoadProgress: LoadProgressCallback,
): Promise<FFmpegInstance> {
  const { FFmpeg } = await import("@ffmpeg/ffmpeg");

  const ffmpeg = new FFmpeg() as unknown as FFmpegInstance;

  const coreURL: string = await fetchAsBlobURL(
    `${FFMPEG_CORE_BASE_URL}/ffmpeg-core.js`,
    "text/javascript",
  );
  const wasmURL: string = await fetchAsBlobURL(
    `${FFMPEG_CORE_BASE_URL}/ffmpeg-core.wasm`,
    "application/wasm",
    (received, total) => {
      onLoadProgress({
        file: "ffmpeg-core.wasm",
        percentage:
          total > 0 ? Math.min(100, Math.round((received / total) * 100)) : 0,
      });
    },
  );

  await ffmpeg.load({ coreURL, wasmURL });
  return ffmpeg;
}

export function getFFmpeg(
  onLoadProgress: LoadProgressCallback,
): Promise<FFmpegInstance> {
  if (!ffmpegPromise) {
    ffmpegPromise = createFFmpeg(onLoadProgress);
  }
  return ffmpegPromise;
}

export type { FFmpegInstance };
