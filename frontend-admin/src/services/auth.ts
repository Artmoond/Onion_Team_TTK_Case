import { API_BASE } from './api';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export class AuthError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'AuthError';
  }
}

async function authRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new AuthError('Не удалось связаться с сервером авторизации. Проверьте подключение и попробуйте снова.');
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null) as { detail?: unknown; message?: unknown } | null;
    const message = typeof body?.detail === 'string'
      ? body.detail
      : typeof body?.message === 'string'
        ? body.message
        : response.status === 401
          ? 'Неверный email или пароль.'
          : response.status === 404
            ? 'Сервис авторизации ещё не подключён на backend.'
            : `Не удалось выполнить запрос (${response.status}).`;
    throw new AuthError(message, response.status);
  }

  if (response.status === 204) return undefined as T;
  return response.json().catch(() => undefined) as Promise<T>;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const result = await authRequest<{ user: AuthUser }>('/api/auth/me');
    return result.user;
  } catch (error) {
    if (error instanceof AuthError && error.status === 401) return null;
    throw error;
  }
}

export function registerOrganizer(input: { name: string; email: string; password: string }): Promise<void> {
  return authRequest('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function loginOrganizer(input: { email: string; password: string }): Promise<AuthUser> {
  const result = await authRequest<{ user: AuthUser }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return result.user;
}

export function logoutOrganizer(): Promise<void> {
  return authRequest('/api/auth/logout', { method: 'POST' });
}
