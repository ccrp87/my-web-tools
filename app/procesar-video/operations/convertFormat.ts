import { fetchFile } from "@ffmpeg/util";
import type { FFmpegInstance } from "../ffmpegClient";
import { getFileExtension } from "../utils";

export interface VideoFormatOption {
  id: string;
  label: string;
  extension: string;
  mimeType: string;
  videoCodec: string;
  audioCodec: string;
  extraArgs: readonly string[];
}

export const VIDEO_FORMATS: readonly VideoFormatOption[] = [
  {
    id: "mp4",
    label: "MP4",
    extension: "mp4",
    mimeType: "video/mp4",
    videoCodec: "libx264",
    audioCodec: "aac",
    extraArgs: ["-preset", "ultrafast"],
  },
  {
    id: "webm",
    label: "WEBM",
    extension: "webm",
    mimeType: "video/webm",
    videoCodec: "libvpx",
    audioCodec: "libvorbis",
    extraArgs: ["-deadline", "realtime", "-cpu-used", "5"],
  },
  {
    id: "mov",
    label: "MOV",
    extension: "mov",
    mimeType: "video/quicktime",
    videoCodec: "libx264",
    audioCodec: "aac",
    extraArgs: ["-preset", "ultrafast"],
  },
  {
    id: "avi",
    label: "AVI",
    extension: "avi",
    mimeType: "video/x-msvideo",
    videoCodec: "mpeg4",
    audioCodec: "libmp3lame",
    extraArgs: [],
  },
];

export interface ConvertFormatOptions {
  format: VideoFormatOption;
}

export async function convertFormat(
  ffmpeg: FFmpegInstance,
  videoFile: File,
  { format }: ConvertFormatOptions,
): Promise<Blob> {
  const inputExtension: string = getFileExtension(videoFile.name) || "mp4";
  const inputPath: string = `input.${inputExtension}`;
  const outputPath: string = `output.${format.extension}`;

  await ffmpeg.writeFile(inputPath, await fetchFile(videoFile));

  const args: string[] = [
    "-i",
    inputPath,
    "-c:v",
    format.videoCodec,
    ...format.extraArgs,
    "-c:a",
    format.audioCodec,
    outputPath,
  ];

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
