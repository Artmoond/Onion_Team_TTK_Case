export type AuthRole = 'admin' | 'user';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: AuthRole;
  isActive: boolean;
  createdAt?: string | null;
  lastLoginAt?: string | null;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: AuthUser;
}

const STORAGE_KEY = 'ttk.auth.session.v1';

const defaultApiHost =
  typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : 'http://localhost:8000';
const API_URL = (import.meta.env.VITE_API_URL || defaultApiHost).replace(/\/+$/, '');

export { API_URL };

export class ApiError extends Error {
  status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function isSession(value: unknown): value is Session {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Session>;
  return Boolean(
    candidate.accessToken &&
      candidate.refreshToken &&
      candidate.user &&
      typeof candidate.user.id === 'string' &&
      (candidate.user.role === 'admin' || candidate.user.role === 'user'),
  );
}

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveSession(session: Session): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}

async function readError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as unknown;
    if (data && typeof data === 'object') {
      const detail = (data as { detail?: unknown }).detail;
      if (typeof detail === 'string') return detail;
      if (Array.isArray(detail)) {
        const messages = detail
          .map((item) => {
            if (!item || typeof item !== 'object') return null;
            const msg = (item as { msg?: unknown }).msg;
            return typeof msg === 'string' ? msg.replace(/^Value error,\s*/i, '') : null;
          })
          .filter((item): item is string => Boolean(item));
        if (messages.length) return messages.join('; ');
      }
    }
  } catch {
    // Ниже вернём общий текст.
  }
  if (response.status === 429) return 'Слишком много попыток. Попробуйте немного позже.';
  if (response.status >= 500) return 'Сервер временно недоступен. Попробуйте ещё раз.';
  return `Ошибка запроса (${response.status})`;
}

async function publicRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers || {}),
      },
    });
  } catch {
    throw new ApiError(
      `Не удалось связаться с сервером ${API_URL}. Проверьте, что бэкенд запущен.`,
    );
  }

  if (!response.ok) {
    throw new ApiError(await readError(response), response.status);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function loginUser(
  email: string,
  password: string,
  role: AuthRole,
): Promise<Session> {
  const session = await publicRequest<Session>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: email.trim(), password, role }),
  });
  saveSession(session);
  return session;
}

export interface RegisterPayload {
  email: string;
  password: string;
  fullName: string;
  role: AuthRole;
  adminInviteCode?: string;
}

export async function registerUser(payload: RegisterPayload): Promise<Session> {
  const session = await publicRequest<Session>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: payload.email.trim(),
      password: payload.password,
      fullName: payload.fullName.trim(),
      role: payload.role,
      adminInviteCode: payload.adminInviteCode?.trim() || undefined,
    }),
  });
  saveSession(session);
  return session;
}

let refreshInFlight: Promise<Session> | null = null;

export function refreshSession(): Promise<Session> {
  if (refreshInFlight) return refreshInFlight;

  const current = loadSession();
  if (!current) {
    return Promise.reject(new ApiError('Сессия не найдена. Войдите заново.', 401));
  }

  refreshInFlight = publicRequest<Session>('/api/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: current.refreshToken }),
  })
    .then((session) => {
      saveSession(session);
      return session;
    })
    .catch((error: unknown) => {
      // При сетевом сбое не выкидываем пользователя: сессия ещё может быть
      // валидной, просто бэкенд временно недоступен.
      if (!(error instanceof ApiError && error.status === 0)) {
        clearSession();
      }
      if (error instanceof ApiError) throw error;
      throw new ApiError('Не удалось обновить сессию. Войдите заново.', 401);
    })
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}

export async function restoreSession(): Promise<Session | null> {
  const current = loadSession();
  if (!current) return null;
  try {
    return await refreshSession();
  } catch (error) {
    if (error instanceof ApiError && error.status === 0) {
      // Офлайн/бэкенд недоступен — оставляем локальную сессию.
      return current;
    }
    clearSession();
    return null;
  }
}

async function authorizedFetch(
  session: Session,
  path: string,
  init: RequestInit,
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${session.accessToken}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  try {
    return await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(
      `Не удалось связаться с сервером ${API_URL}. Проверьте подключение.`,
    );
  }
}

/** fetch с автоматическим обновлением access-токена при 401. */
export async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  let session = loadSession();
  if (!session) throw new ApiError('Требуется авторизация', 401);

  let response = await authorizedFetch(session, path, init);
  if (response.status !== 401) return response;

  try {
    session = await refreshSession();
  } catch (error) {
    clearSession();
    throw error instanceof ApiError ? error : new ApiError('Сессия истекла', 401);
  }

  response = await authorizedFetch(session, path, init);
  if (response.status === 401) {
    clearSession();
    throw new ApiError(await readError(response), 401);
  }
  return response;
}

export async function authJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await authFetch(path, init);
  if (!response.ok) {
    throw new ApiError(await readError(response), response.status);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function logoutSession(): Promise<void> {
  try {
    await authFetch('/api/auth/logout', { method: 'POST' });
  } catch {
    // Даже если сервер недоступен, локальную сессию нужно очистить.
  } finally {
    clearSession();
  }
}

export function roleLabel(role: AuthRole): string {
  return role === 'admin' ? 'Организатор' : 'Посетитель';
}
