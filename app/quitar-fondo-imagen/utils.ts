export const ACCEPTED_IMAGE_TYPES: readonly string[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

export const LARGE_FILE_THRESHOLD_BYTES: number = 10 * 1024 * 1024;

export function isAcceptedImageType(file: File): boolean {
  return ACCEPTED_IMAGE_TYPES.includes(file.type);
}

export function isLargeFile(file: File): boolean {
  return file.size > LARGE_FILE_THRESHOLD_BYTES;
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

export function buildDownloadFileName(originalFileName: string): string {
  const lastDotIndex: number = originalFileName.lastIndexOf(".");
  const baseName: string =
    lastDotIndex > 0
      ? originalFileName.slice(0, lastDotIndex)
      : originalFileName;
  return `${baseName}_sin_fondo.png`;
}
