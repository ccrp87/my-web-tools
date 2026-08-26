import { fetchFile } from "@ffmpeg/util";
import type { FFmpegInstance } from "../ffmpegClient";
import { getFileExtension } from "../utils";

export interface AudioFormatOption {
  id: string;
  label: string;
  extension: string;
  mimeType: string;
  codec: string;
  supportsBitrate: boolean;
}

export const AUDIO_FORMATS: readonly AudioFormatOption[] = [
  {
    id: "mp3",
    label: "MP3",
    extension: "mp3",
    mimeType: "audio/mpeg",
    codec: "libmp3lame",
    supportsBitrate: true,
  },
  {
    id: "wav",
    label: "WAV",
    extension: "wav",
    mimeType: "audio/wav",
    codec: "pcm_s16le",
    supportsBitrate: false,
  },
  {
    id: "m4a",
    label: "M4A",
    extension: "m4a",
    mimeType: "audio/mp4",
    codec: "aac",
    supportsBitrate: true,
  },
  {
    id: "ogg",
    label: "OGG",
    extension: "ogg",
    mimeType: "audio/ogg",
    codec: "libvorbis",
    supportsBitrate: true,
  },
];

export const AUDIO_BITRATES_KBPS: readonly number[] = [128, 192, 256, 320];

export interface ExtractAudioOptions {
  format: AudioFormatOption;
  bitrateKbps: number;
}

export async function extractAudio(
  ffmpeg: FFmpegInstance,
  videoFile: File,
  { format, bitrateKbps }: ExtractAudioOptions,
): Promise<Blob> {
  const inputExtension: string = getFileExtension(videoFile.name) || "mp4";
  const inputPath: string = `input.${inputExtension}`;
  const outputPath: string = `output.${format.extension}`;

  await ffmpeg.writeFile(inputPath, await fetchFile(videoFile));

  const args: string[] = ["-i", inputPath, "-vn", "-c:a", format.codec];
  if (format.supportsBitrate) {
    args.push("-b:a", `${bitrateKbps}k`);
  }
  args.push(outputPath);

  try {
    const exitCode: number = await ffmpeg.exec(args);
    if (exitCode !== 0) {
      throw new Error(`ffmpeg exited with code ${exitCode}`);
    }
    const data: Uint8Array | string = await ffmpeg.readFile(outputPath);
    // ffmpeg.wasm's readFile is backed by a regular ArrayBuffer, not a
    // SharedArrayBuffer; the cast just satisfies BlobPart's stricter generic.
    const bytes = (
      typeof data === "string" ? new TextEncoder().encode(data) : data
    ) as Uint8Array<ArrayBuffer>;
    return new Blob([bytes], { type: format.mimeType });
  } finally {
    await ffmpeg.deleteFile(inputPath).catch(() => {});
    await ffmpeg.deleteFile(outputPath).catch(() => {});
  }
}
