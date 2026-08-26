import { fetchFile } from "@ffmpeg/util";
import type { FFmpegInstance } from "../ffmpegClient";
import { getFileExtension } from "../utils";

export interface TrimVideoOptions {
  startSeconds: number;
  endSeconds: number;
}

export async function trimVideo(
  ffmpeg: FFmpegInstance,
  videoFile: File,
  { startSeconds, endSeconds }: TrimVideoOptions,
): Promise<Blob> {
  const inputExtension: string = getFileExtension(videoFile.name) || "mp4";
  const inputPath: string = `input.${inputExtension}`;
  const outputPath: string = "output.mp4";

  await ffmpeg.writeFile(inputPath, await fetchFile(videoFile));

  const args: string[] = [
    "-i",
    inputPath,
    "-ss",
    startSeconds.toFixed(3),
    "-to",
    endSeconds.toFixed(3),
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-c:a",
    "aac",
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
    return new Blob([bytes], { type: "video/mp4" });
  } finally {
    await ffmpeg.deleteFile(inputPath).catch(() => {});
    await ffmpeg.deleteFile(outputPath).catch(() => {});
  }
}
