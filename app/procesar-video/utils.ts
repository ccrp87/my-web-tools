export const ACCEPTED_VIDEO_EXTENSIONS: readonly string[] = [
  ".mp4",
  ".mov",
  ".webm",
  ".avi",
  ".mkv",
];

export const LARGE_VIDEO_THRESHOLD_BYTES: number = 200 * 1024 * 1024;

export function isAcceptedVideoFile(file: File): boolean {
  if (file.type.startsWith("video/")) {
    return true;
  }
  const lowerCaseName: string = file.name.toLowerCase();
  return ACCEPTED_VIDEO_EXTENSIONS.some((extension) =>
    lowerCaseName.endsWith(extension),
  );
}

export function isLargeVideo(sizeBytes: number): boolean {
  return sizeBytes > LARGE_VIDEO_THRESHOLD_BYTES;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const kilobytes: number = bytes / 1024;
  if (kilobytes < 1024) {
    return `${kilobytes.toFixed(1)} KB`;
  }
  const megabytes: number = kilobytes / 1024;
  return `${megabytes.toFixed(1)} MB`;
}

export function getFileExtension(fileName: string): string {
  const lastDotIndex: number = fileName.lastIndexOf(".");
  return lastDotIndex > 0 ? fileName.slice(lastDotIndex + 1).toLowerCase() : "";
}

export function formatTimestamp(seconds: number): string {
  const totalSeconds: number = Math.max(0, Math.round(seconds));
  const minutes: number = Math.floor(totalSeconds / 60);
  const remainingSeconds: number = totalSeconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export function buildOutputFileName(
  originalName: string,
  operationSuffix: string,
  outputExtension: string,
): string {
  const lastDotIndex: number = originalName.lastIndexOf(".");
  const baseName: string =
    lastDotIndex > 0 ? originalName.slice(0, lastDotIndex) : originalName;
  return `${baseName}_${operationSuffix}.${outputExtension}`;
}
