import type { ProjectSettings, Venue } from '../types/venue';
import { normalizeVenue } from './serialization';

const DRAFT_KEY = 'ttk-admin:draft:v1';

export interface SavedDraft {
  venue: Venue;
  activeFloorId: string | null;
  settings: ProjectSettings;
  savedAt: string;
}

export const DEFAULT_SETTINGS: ProjectSettings = {
  publicUrlOverride: '',
};

export function loadDraft(): SavedDraft | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const venue = normalizeVenue(parsed.venue);
    const activeFloorId = typeof parsed.activeFloorId === 'string' ? parsed.activeFloorId : venue.floors[0]?.id ?? null;
    return {
      venue,
      activeFloorId: venue.floors.some((floor) => floor.id === activeFloorId) ? activeFloorId : venue.floors[0]?.id ?? null,
      settings: {
        publicUrlOverride:
          typeof (parsed.settings as Record<string, unknown> | undefined)?.publicUrlOverride === 'string'
            ? String((parsed.settings as Record<string, unknown>).publicUrlOverride)
            : '',
      },
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function saveDraft(draft: SavedDraft): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch (error) {
    console.warn('Не удалось сохранить локальный черновик', error);
  }
}

export function clearDraft(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(DRAFT_KEY);
}
