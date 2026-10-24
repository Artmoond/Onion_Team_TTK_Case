export const PLAN_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
export const PANORAMA_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_PLAN_BYTES = 12 * 1024 * 1024;
export const MAX_PANORAMA_BYTES = 25 * 1024 * 1024;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

export function validateFile(
  file: File,
  mimeTypes: string[],
  maxBytes: number
): string | null {
  if (!file.size) return 'Файл пустой.';
  if (file.size > maxBytes) return `Файл больше ${formatBytes(maxBytes)}.`;
  if (!file.type || !mimeTypes.includes(file.type)) {
    return `Неподдерживаемый формат: ${file.type}. Разрешены ${mimeTypes.join(', ')}.`;
  }
  return null;
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

export function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'file';
}
