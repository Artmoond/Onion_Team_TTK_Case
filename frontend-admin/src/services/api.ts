import type { Venue } from '../types/venue';
import { loadSession } from '../lib/auth';

const defaultApiHost =
  typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : 'http://localhost:8000';

export const API_BASE = (import.meta.env.VITE_API_URL || defaultApiHost).replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

function mediaUrl(path: string): string {
  if (!path) return path;
  if (path.startsWith('local-asset://')) return path;
  try {
    const parsed = new URL(path, `${API_BASE}/`);
    const apiOrigin = new URL(API_BASE).origin;
    if (parsed.origin !== apiOrigin || !parsed.pathname.startsWith('/uploads/') || parsed.username || parsed.password) {
      throw new Error('invalid upload url');
    }
    return parsed.toString();
  } catch {
    throw new ApiError('Сервер вернул недопустимый адрес загруженного файла.');
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), 30_000);
  const abortFromCaller = () => controller.abort();
  init?.signal?.addEventListener('abort', abortFromCaller, { once: true });
  try {
    const headers = new Headers(init?.headers);
    const session = loadSession();
    if (session?.accessToken && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${session.accessToken}`);
    }
    response = await fetch(`${API_BASE}${path}`, { ...init, headers, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) throw new ApiError('Запрос к серверу отменён или превысил лимит времени.');
    throw new ApiError(`Сервер недоступен по адресу ${API_BASE}. Используйте локальный режим или запустите сервер.`);
  } finally {
    globalThis.clearTimeout(timeout);
    init?.signal?.removeEventListener('abort', abortFromCaller);
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

export async function saveVenue(venue: Venue): Promise<{ status: string; slug: string; publicUrl?: string }> {
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

export function buildPublicUrl(venue: Venue): { url: string; source: 'backend' } | null {
  const validPublicUrl = (value?: string): string | null => {
    if (!value?.trim()) return null;
    try {
      const parsed = new URL(value.trim());
      if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:') || parsed.username || parsed.password) return null;
      return parsed.toString();
    } catch {
      return null;
    }
  };
  const backendUrl = validPublicUrl(venue.publicUrl);
  if (backendUrl) {
    return { url: backendUrl, source: 'backend' };
  }
  return null;
}
