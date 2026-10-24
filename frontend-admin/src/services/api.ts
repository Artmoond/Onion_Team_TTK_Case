import type { Venue } from '../types/venue';

const DEFAULT_API_BASE = 'http://localhost:8000';

export const API_BASE = (import.meta.env.VITE_API_URL || DEFAULT_API_BASE).replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

function mediaUrl(path: string): string {
  if (!path) return path;
  if (/^https?:\/\//i.test(path) || path.startsWith('local-asset://') || path.startsWith('data:')) {
    return path;
  }
  return `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, init);
  } catch {
    throw new ApiError(`Backend недоступен по адресу ${API_BASE}. Используйте локальный режим или запустите backend.`);
  }
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new ApiError(`Запрос ${path} завершился с ошибкой ${response.status}${text ? `: ${text.slice(0, 240)}` : ''}.`, response.status);
  }
  return (await response.json()) as T;
}

export async function checkBackend(): Promise<{ status: string; service: string; venues_count: number }> {
  return request('/api/health');
}

export async function listVenues(): Promise<Venue[]> {
  return request('/api/venues');
}

export async function fetchVenue(slug: string): Promise<Venue> {
  return request(`/api/public/${encodeURIComponent(slug)}`);
}

export async function saveVenue(venue: Venue): Promise<{ status: string; slug: string }> {
  return request(`/api/venues/${encodeURIComponent(venue.slug)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(venue),
  });
}

export async function uploadAsset(file: Blob, fileName: string): Promise<{ url: string; size: number }> {
  const form = new FormData();
  form.append('file', file, fileName);
  const result = await request<{ url: string; size: number }>('/api/upload', {
    method: 'POST',
    body: form,
  });
  return { ...result, url: mediaUrl(result.url) };
}

export function buildPublicUrl(venue: Venue, override?: string): {
  url: string;
  source: 'backend' | 'manual' | 'test';
} {
  if (venue.publicUrl?.trim()) {
    return { url: venue.publicUrl.trim(), source: 'backend' };
  }
  if (override?.trim()) {
    return { url: override.trim(), source: 'manual' };
  }
  const base = (import.meta.env.VITE_PUBLIC_MAP_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
  return { url: `${base}/m/${venue.slug}`, source: 'test' };
}
