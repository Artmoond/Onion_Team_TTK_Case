import { create } from 'zustand';
import { POINT_TYPES } from '../config/pointTypes';
import type {
  AssetReference,
  EditorTool,
  Floor,
  Panorama,
  POI,
  PointCategory,
  ProjectSettings,
  Room,
  RoomPoint,
  Stair,
  Venue,
  Wall,
} from '../types/venue';
import { createEmptyFloor, createEmptyVenue } from '../services/serialization';
import { clearDraft, DEFAULT_SETTINGS, loadDraft, saveDraft, type SavedDraft } from '../services/storage';
import { createId } from '../utils/id';
import { wallLength } from '../utils/geometry';

export type SelectionKind = 'point' | 'wall' | 'room' | 'stair' | 'panorama';

export interface Selection {
  kind: SelectionKind;
  id: string;
}

export type SaveStatus = 'idle' | 'saving' | 'saved-local' | 'saved-server' | 'error';

export interface ToastMessage {
  id: string;
  tone: 'success' | 'error' | 'info';
  title: string;
  text?: string;
}

interface History {
  past: Venue[];
  future: Venue[];
}

interface EditorState {
  venue: Venue | null;
  activeFloorId: string | null;
  selection: Selection | null;
  tool: EditorTool;
  pointCategory: PointCategory;
  history: History;
  transaction: Venue | null;
  transactionDirty: boolean;
  dirty: boolean;
  saveStatus: SaveStatus;
  saveError: string | null;
  lastSavedAt: string | null;
  settings: ProjectSettings;
  toast: ToastMessage | null;

  createProject: (title: string, slug: string, description?: string) => void;
  loadProject: (venue: Venue) => void;
  setVenueAfterSync: (venue: Venue) => void;
  clearProject: () => void;
  updateProjectMeta: (patch: Partial<Pick<Venue, 'title' | 'slug' | 'description' | 'coverUrl' | 'publicUrl'>>, record?: boolean) => void;

  setActiveFloor: (floorId: string) => void;
  addFloor: () => void;
  deleteFloor: (floorId: string) => void;
  updateFloorMeta: (floorId: string, patch: Partial<Pick<Floor, 'name' | 'level'>>, record?: boolean) => void;
  setFloorScale: (floorId: string, metersPerPixel: number, record?: boolean) => void;
  clearFloorObjects: (floorId: string) => void;
  replaceFloorPlan: (floorId: string, asset: AssetReference, width: number, height: number) => void;

  addPoint: (category: PointCategory, x: number, y: number) => void;
  updatePoint: (pointId: string, patch: Partial<POI>, record?: boolean) => void;
  deletePoint: (pointId: string) => void;
  duplicatePoint: (pointId: string) => void;

  addWall: (x1: number, y1: number, x2: number, y2: number) => void;
  updateWall: (wallId: string, patch: Partial<Wall>, record?: boolean) => void;
  deleteWall: (wallId: string) => void;

  addStair: (x1: number, y1: number, x2: number, y2: number) => void;
  updateStair: (stairId: string, patch: Partial<Stair>, record?: boolean) => void;
  deleteStair: (stairId: string) => void;
  linkStairs: (stairId: string, targetStairId: string | null) => void;
  createLinkedStair: (stairId: string, targetFloorId: string) => string | null;

  addRoom: (points: RoomPoint[]) => void;
  updateRoom: (roomId: string, patch: Partial<Room>, record?: boolean) => void;
  deleteRoom: (roomId: string) => void;

  addPanorama: (input: {
    asset: AssetReference;
    x: number;
    y: number;
    linkPointId?: string;
  }) => string | null;
  replacePanoramaAsset: (panoramaId: string, asset: AssetReference) => void;
  updatePanorama: (panoramaId: string, patch: Partial<Panorama>, record?: boolean) => void;
  deletePanorama: (panoramaId: string) => void;
  linkPanorama: (pointId: string, panoramaId: string | null) => void;

  setTool: (tool: EditorTool) => void;
  setPointCategory: (category: PointCategory) => void;
  select: (selection: Selection | null) => void;

  undo: () => void;
  redo: () => void;
  beginTransaction: () => void;
  commitTransaction: () => void;
  cancelTransaction: () => void;

  setSettings: (patch: Partial<ProjectSettings>) => void;
  markSaving: () => void;
  markSavedLocal: () => void;
  markSavedServer: () => void;
  markSaveError: (message: string) => void;
  showToast: (tone: ToastMessage['tone'], title: string, text?: string) => void;
  dismissToast: () => void;
}

const HISTORY_LIMIT = 60;

function cloneVenue(venue: Venue): Venue {
  return typeof structuredClone === 'function'
    ? structuredClone(venue)
    : (JSON.parse(JSON.stringify(venue)) as Venue);
}

function withHistory(state: EditorState, venue: Venue, record: boolean): Partial<EditorState> {
  if (!state.venue) {
    return { venue, dirty: true, saveStatus: 'idle' };
  }
  if (!record) {
    return {
      venue,
      dirty: true,
      saveStatus: 'idle',
      ...(state.transaction ? { transactionDirty: true } : {}),
    };
  }
  return {
    venue,
    dirty: true,
    saveStatus: 'idle',
    history: {
      past: [...state.history.past.slice(-(HISTORY_LIMIT - 1)), state.venue],
      future: [],
    },
    transaction: null,
    transactionDirty: false,
  };
}

function mapFloor(venue: Venue, floorId: string, updater: (floor: Floor) => Floor): Venue {
  return {
    ...venue,
    floors: venue.floors.map((floor) => (floor.id === floorId ? updater(floor) : floor)),
  };
}

function findFloorWithPoint(venue: Venue, pointId: string): Floor | null {
  return venue.floors.find((floor) => floor.points.some((point) => point.id === pointId)) ?? null;
}

function findStair(venue: Venue, stairId: string): { floor: Floor; stair: Stair } | null {
  for (const floor of venue.floors) {
    const stair = floor.stairs?.find((item) => item.id === stairId);
    if (stair) return { floor, stair };
  }
  return null;
}

function clearStairReferences(venue: Venue, stairIds: Set<string>, floorIds: Set<string> = new Set()): Venue {
  if (stairIds.size === 0 && floorIds.size === 0) return venue;
  return {
    ...venue,
    floors: venue.floors.map((floor) => ({
      ...floor,
      stairs: floor.stairs?.map((stair) => {
        const targetFloorGone = Boolean(stair.targetFloorId && floorIds.has(stair.targetFloorId));
        const targetStairGone = Boolean(stair.targetStairId && stairIds.has(stair.targetStairId));
        if (!targetFloorGone && !targetStairGone) return stair;
        return { ...stair, targetFloorId: undefined, targetStairId: undefined };
      }),
    })),
  };
}

function reconcileSelection(
  venue: Venue,
  activeFloorId: string | null,
  selection: Selection | null
): { activeFloorId: string | null; selection: Selection | null } {
  const floor = venue.floors.find((item) => item.id === activeFloorId) ?? venue.floors[0] ?? null;
  if (!floor) return { activeFloorId: null, selection: null };
  if (!selection) return { activeFloorId: floor.id, selection: null };
  const exists =
    (selection.kind === 'point' && floor.points.some((point) => point.id === selection.id)) ||
    (selection.kind === 'wall' && floor.walls?.some((wall) => wall.id === selection.id)) ||
    (selection.kind === 'room' && floor.rooms?.some((room) => room.id === selection.id)) ||
    (selection.kind === 'stair' && floor.stairs?.some((stair) => stair.id === selection.id)) ||
    (selection.kind === 'panorama' && floor.panoramas.some((panorama) => panorama.id === selection.id));
  return { activeFloorId: floor.id, selection: exists ? selection : null };
}

function initialDraft() {
  const draft = loadDraft();
  return {
    venue: draft?.venue ?? null,
    activeFloorId: draft?.activeFloorId ?? null,
    settings: draft?.settings ?? DEFAULT_SETTINGS,
    lastSavedAt: draft?.savedAt ?? null,
    dirty: false,
  };
}

export const useEditorStore = create<EditorState>((set, get) => ({
  ...initialDraft(),
  selection: null,
  tool: 'select',
  pointCategory: 'info',
  history: { past: [], future: [] },
  transaction: null,
  transactionDirty: false,
  saveStatus: 'idle',
  saveError: null,
  toast: null,

  createProject: (title, slug, description) => {
    const venue = createEmptyVenue(title, slug, description);
    set({
      venue,
      activeFloorId: venue.floors[0]?.id ?? null,
      selection: null,
      history: { past: [], future: [] },
      transaction: null,
      transactionDirty: false,
      dirty: true,
      saveStatus: 'idle',
      saveError: null,
      lastSavedAt: null,
      toast: { id: createId('toast'), tone: 'success', title: 'Проект создан', text: 'Загрузите план этажа и добавьте объекты.' },
    });
  },

  loadProject: (venue) => {
    set({
      venue,
      activeFloorId: venue.floors[0]?.id ?? null,
      selection: null,
      history: { past: [], future: [] },
      transaction: null,
      transactionDirty: false,
      dirty: true,
      saveStatus: 'idle',
      saveError: null,
      lastSavedAt: null,
      toast: { id: createId('toast'), tone: 'success', title: 'Карта загружена', text: `${venue.floors.length} эт. · ${venue.title}` },
    });
  },

  setVenueAfterSync: (venue) => {
    set({
      venue,
      dirty: false,
      saveStatus: 'saved-server',
      saveError: null,
      lastSavedAt: new Date().toISOString(),
    });
  },

  clearProject: () => {
    clearDraft();
    set({
      venue: null,
      activeFloorId: null,
      selection: null,
      history: { past: [], future: [] },
      transaction: null,
      transactionDirty: false,
      dirty: false,
      saveStatus: 'idle',
      saveError: null,
      lastSavedAt: null,
      toast: null,
    });
  },

  updateProjectMeta: (patch, record = true) =>
    set((state) => {
      if (!state.venue) return {};
      return withHistory(state, { ...state.venue, ...patch }, record);
    }),

  setActiveFloor: (floorId) =>
    set((state) => {
      if (!state.venue?.floors.some((floor) => floor.id === floorId)) return {};
      return { activeFloorId: floorId, selection: null };
    }),

  addFloor: () =>
    set((state) => {
      if (!state.venue) return {};
      const level = Math.max(0, ...state.venue.floors.map((floor) => floor.level)) + 1;
      const floor = createEmptyFloor(state.venue.id, level, `${level} этаж`);
      const venue = { ...state.venue, floors: [...state.venue.floors, floor] };
      return {
        ...withHistory(state, venue, true),
        activeFloorId: floor.id,
        selection: null,
        toast: { id: createId('toast'), tone: 'success', title: 'Этаж добавлен', text: floor.name },
      };
    }),

  deleteFloor: (floorId) =>
    set((state) => {
      if (!state.venue || state.venue.floors.length <= 1) {
        return {
          toast: { id: createId('toast'), tone: 'error', title: 'Нельзя удалить единственный этаж' },
        };
      }
      const removedFloor = state.venue.floors.find((floor) => floor.id === floorId);
      const removedStairIds = new Set<string>((removedFloor?.stairs ?? []).map((stair) => stair.id));
      const floors = state.venue.floors.filter((floor) => floor.id !== floorId);
      const venue = clearStairReferences({ ...state.venue, floors }, removedStairIds, new Set<string>([floorId]));
      const nextFloor = venue.floors.find((floor) => floor.id === state.activeFloorId) ?? venue.floors[0];
      return {
        ...withHistory(state, venue, true),
        activeFloorId: nextFloor?.id ?? null,
        selection: null,
        toast: { id: createId('toast'), tone: 'success', title: 'Этаж удалён' },
      };
    }),

  updateFloorMeta: (floorId, patch, record = true) =>
    set((state) => {
      if (!state.venue) return {};
      const venue = mapFloor(state.venue, floorId, (floor) => ({ ...floor, ...patch }));
      return withHistory(state, venue, record);
    }),

  setFloorScale: (floorId, metersPerPixel, record = true) =>
    set((state) => {
      if (!state.venue || !Number.isFinite(metersPerPixel) || metersPerPixel <= 0) return {};
      const venue = mapFloor(state.venue, floorId, (floor) => ({
        ...floor,
        metersPerPixel,
        walls: floor.walls?.map((wall) => ({
          ...wall,
          lengthMeters: wallLength(wall.x1, wall.y1, wall.x2, wall.y2, metersPerPixel),
        })),
      }));
      return withHistory(state, venue, record);
    }),

  clearFloorObjects: (floorId) =>
    set((state) => {
      if (!state.venue) return {};
      const floor = state.venue.floors.find((item) => item.id === floorId);
      if (!floor) return {};
      const removedStairIds = new Set<string>((floor.stairs ?? []).map((stair) => stair.id));
      const cleared = mapFloor(state.venue, floorId, (item) => ({
        ...item,
        points: [],
        walls: [],
        rooms: [],
        stairs: [],
        panoramas: item.panoramas,
      }));
      const venue = clearStairReferences(cleared, removedStairIds);
      return {
        ...withHistory(state, venue, true),
        selection: null,
        toast: {
          id: createId('toast'),
          tone: 'success',
          title: 'Объекты этажа очищены',
          text: 'Точки, стены, помещения и лестницы удалены. Панорамы сохранены.',
        },
      };
    }),

  replaceFloorPlan: (floorId, asset, width, height) =>
    set((state) => {
      if (!state.venue) return {};
      const venue = mapFloor(state.venue, floorId, (floor) => ({
        ...floor,
        planUrl: asset.url,
        planAsset: asset,
        width: Math.max(1, Math.round(width)),
        height: Math.max(1, Math.round(height)),
      }));
      return {
        ...withHistory(state, venue, true),
        toast: { id: createId('toast'), tone: 'success', title: 'План этажа обновлён', text: asset.fileName },
      };
    }),

  addPoint: (category, x, y) =>
    set((state) => {
      if (!state.venue || !state.activeFloorId) return {};
      const floor = state.venue.floors.find((item) => item.id === state.activeFloorId);
      if (!floor) return {};
      const definition = POINT_TYPES[category];
      const count = floor.points.filter((point) => point.category === category).length + 1;
      const point: POI = {
        id: createId('poi'),
        floorId: floor.id,
        name: `${definition.label} ${count}`,
        category,
        description: '',
        x: Math.round(x),
        y: Math.round(y),
        isPublic: true,
        ...definition.createSettings(),
      };
      const venue = mapFloor(state.venue, floor.id, (item) => ({ ...item, points: [...item.points, point] }));
      return {
        ...withHistory(state, venue, true),
        selection: { kind: 'point', id: point.id },
        tool: 'select',
      };
    }),

  updatePoint: (pointId, patch, record = true) =>
    set((state) => {
      if (!state.venue) return {};
      const floor = findFloorWithPoint(state.venue, pointId);
      if (!floor) return {};
      const current = floor.points.find((point) => point.id === pointId)!;
      const next: POI = { ...current, ...patch };
      let panoramaCoordinates: { x: number; y: number } | null = null;
      if (
        next.panoramaId &&
        ((patch.x !== undefined && patch.x !== current.x) || (patch.y !== undefined && patch.y !== current.y))
      ) {
        panoramaCoordinates = { x: next.x, y: next.y };
      }
      const venue = mapFloor(state.venue, floor.id, (item) => {
        let panoramas = item.panoramas;
        if (panoramaCoordinates && next.panoramaId) {
          panoramas = panoramas.map((panorama) =>
            panorama.id === next.panoramaId ? { ...panorama, ...panoramaCoordinates! } : panorama
          );
        }
        if (patch.panoramaId && patch.panoramaId !== current.panoramaId) {
          const sourcePanorama = panoramas.find((panorama) => panorama.id === patch.panoramaId);
          if (sourcePanorama) {
            panoramaCoordinates = { x: next.x, y: next.y };
            panoramas = panoramas.map((panorama) =>
              panorama.id === patch.panoramaId ? { ...panorama, x: next.x, y: next.y } : panorama
            );
          }
          return {
            ...item,
            panoramas,
            points: item.points.map((point) => {
              if (point.id === pointId) return next;
              if (point.panoramaId === patch.panoramaId) return { ...point, panoramaId: undefined };
              return point;
            }),
          };
        }
        return {
          ...item,
          panoramas,
          points: item.points.map((point) => (point.id === pointId ? next : point)),
        };
      });
      return withHistory(state, venue, record);
    }),

  deletePoint: (pointId) =>
    set((state) => {
      if (!state.venue) return {};
      const floor = findFloorWithPoint(state.venue, pointId);
      if (!floor) return {};
      const venue = mapFloor(state.venue, floor.id, (item) => ({
        ...item,
        points: item.points.filter((point) => point.id !== pointId),
        panoramas: item.panoramas.map((panorama) => ({
          ...panorama,
          hotspots: panorama.hotspots.filter((hotspot) => hotspot.poiId !== pointId),
        })),
      }));
      return {
        ...withHistory(state, venue, true),
        selection:
          state.selection?.kind === 'point' && state.selection.id === pointId ? null : state.selection,
      };
    }),

  duplicatePoint: (pointId) =>
    set((state) => {
      if (!state.venue) return {};
      const floor = findFloorWithPoint(state.venue, pointId);
      if (!floor) return {};
      const source = floor.points.find((point) => point.id === pointId);
      if (!source) return {};
      const copy: POI = {
        ...cloneVenue({ ...state.venue, floors: [{ ...floor, points: [source] }] }).floors[0].points[0],
        id: createId('poi'),
        name: `${source.name} (копия)`,
        x: source.x + 24,
        y: source.y + 24,
        panoramaId: undefined,
      };
      const venue = mapFloor(state.venue, floor.id, (item) => ({ ...item, points: [...item.points, copy] }));
      return {
        ...withHistory(state, venue, true),
        selection: { kind: 'point', id: copy.id },
      };
    }),

  addWall: (x1, y1, x2, y2) =>
    set((state) => {
      if (!state.venue || !state.activeFloorId) return {};
      const floor = state.venue.floors.find((item) => item.id === state.activeFloorId);
      if (!floor) return {};
      const wall: Wall = {
        id: createId('wall'),
        floorId: floor.id,
        x1: Math.round(x1),
        y1: Math.round(y1),
        x2: Math.round(x2),
        y2: Math.round(y2),
        lengthMeters: wallLength(x1, y1, x2, y2, floor.metersPerPixel),
        thickness: 4,
        kind: 'wall',
      };
      const venue = mapFloor(state.venue, floor.id, (item) => ({ ...item, walls: [...(item.walls ?? []), wall] }));
      return { ...withHistory(state, venue, true), selection: { kind: 'wall', id: wall.id } };
    }),

  updateWall: (wallId, patch, record = true) =>
    set((state) => {
      if (!state.venue) return {};
      const floor = state.venue.floors.find((item) => item.walls?.some((wall) => wall.id === wallId));
      if (!floor) return {};
      const venue = mapFloor(state.venue, floor.id, (item) => ({
        ...item,
        walls: item.walls?.map((wall) => {
          if (wall.id !== wallId) return wall;
          const next = { ...wall, ...patch };
          return {
            ...next,
            lengthMeters: wallLength(next.x1, next.y1, next.x2, next.y2, item.metersPerPixel),
          };
        }),
      }));
      return withHistory(state, venue, record);
    }),

  deleteWall: (wallId) =>
    set((state) => {
      if (!state.venue) return {};
      const floor = state.venue.floors.find((item) => item.walls?.some((wall) => wall.id === wallId));
      if (!floor) return {};
      const venue = mapFloor(state.venue, floor.id, (item) => ({
        ...item,
        walls: item.walls?.filter((wall) => wall.id !== wallId),
      }));
      return {
        ...withHistory(state, venue, true),
        selection: state.selection?.kind === 'wall' && state.selection.id === wallId ? null : state.selection,
      };
    }),

  addStair: (x1, y1, x2, y2) =>
    set((state) => {
      if (!state.venue || !state.activeFloorId) return {};
      const floor = state.venue.floors.find((item) => item.id === state.activeFloorId);
      if (!floor) return {};
      const stair: Stair = {
        id: createId('stair'),
        floorId: floor.id,
        name: `Лестница ${(floor.stairs?.length ?? 0) + 1}`,
        x1: Math.round(x1),
        y1: Math.round(y1),
        x2: Math.round(x2),
        y2: Math.round(y2),
        width: 40,
        direction: 'both',
      };
      const venue = mapFloor(state.venue, floor.id, (item) => ({
        ...item,
        stairs: [...(item.stairs ?? []), stair],
      }));
      return { ...withHistory(state, venue, true), selection: { kind: 'stair', id: stair.id } };
    }),

  updateStair: (stairId, patch, record = true) =>
    set((state) => {
      if (!state.venue) return {};
      const found = findStair(state.venue, stairId);
      if (!found) return {};
      const venue = mapFloor(state.venue, found.floor.id, (floor) => ({
        ...floor,
        stairs: floor.stairs?.map((stair) => (stair.id === stairId ? { ...stair, ...patch } : stair)),
      }));
      return withHistory(state, venue, record);
    }),

  deleteStair: (stairId) =>
    set((state) => {
      if (!state.venue) return {};
      const found = findStair(state.venue, stairId);
      if (!found) return {};
      const removed = mapFloor(state.venue, found.floor.id, (floor) => ({
        ...floor,
        stairs: floor.stairs?.filter((stair) => stair.id !== stairId),
      }));
      const venue = clearStairReferences(removed, new Set([stairId]));
      return {
        ...withHistory(state, venue, true),
        selection: state.selection?.kind === 'stair' && state.selection.id === stairId ? null : state.selection,
      };
    }),

  linkStairs: (stairId, targetStairId) =>
    set((state) => {
      if (!state.venue) return {};
      const source = findStair(state.venue, stairId);
      if (!source) return {};

      if (!targetStairId) {
        const partnerId = source.stair.targetStairId;
        if (!partnerId) return {};
        const cleared = clearStairReferences(state.venue, new Set([stairId, partnerId]));
        return withHistory(state, cleared, true);
      }

      const target = findStair(state.venue, targetStairId);
      if (!target || target.stair.id === source.stair.id || target.floor.id === source.floor.id) return {};

      const affected = new Set<string>([source.stair.id, target.stair.id]);
      if (source.stair.targetStairId) affected.add(source.stair.targetStairId);
      if (target.stair.targetStairId) affected.add(target.stair.targetStairId);

      const floors = state.venue.floors.map((floor) => ({
        ...floor,
        stairs: floor.stairs?.map((stair) => {
          if (affected.has(stair.id) || (stair.targetStairId && affected.has(stair.targetStairId))) {
            return { ...stair, targetFloorId: undefined, targetStairId: undefined };
          }
          return stair;
        }),
      }));

      const linked = floors.map((floor) => ({
        ...floor,
        stairs: floor.stairs?.map((stair) => {
          if (stair.id === source.stair.id) {
            return { ...stair, targetFloorId: target.floor.id, targetStairId: target.stair.id };
          }
          if (stair.id === target.stair.id) {
            return { ...stair, targetFloorId: source.floor.id, targetStairId: source.stair.id };
          }
          return stair;
        }),
      }));

      return withHistory(state, { ...state.venue, floors: linked }, true);
    }),

  createLinkedStair: (stairId, targetFloorId) => {
    const state = get();
    if (!state.venue) return null;
    const source = findStair(state.venue, stairId);
    const targetFloor = state.venue.floors.find((floor) => floor.id === targetFloorId);
    if (!source || !targetFloor || targetFloor.id === source.floor.id) return null;

    const clampCoordinate = (value: number, max: number) => Math.min(Math.max(0, Math.round(value)), Math.max(1, Math.round(max)));
    const levelDelta = targetFloor.level - source.floor.level;
    const sourceDirection = levelDelta === 0 ? 'both' : levelDelta > 0 ? 'up' : 'down';
    const targetDirection = levelDelta === 0 ? 'both' : levelDelta > 0 ? 'down' : 'up';
    const newStair: Stair = {
      id: createId('stair'),
      floorId: targetFloor.id,
      name: `Лестница ${(targetFloor.stairs?.length ?? 0) + 1}`,
      x1: clampCoordinate(source.stair.x1, targetFloor.width),
      y1: clampCoordinate(source.stair.y1, targetFloor.height),
      x2: clampCoordinate(source.stair.x2, targetFloor.width),
      y2: clampCoordinate(source.stair.y2, targetFloor.height),
      width: source.stair.width,
      direction: targetDirection,
      targetFloorId: source.floor.id,
      targetStairId: source.stair.id,
    };

    const oldPartnerId = source.stair.targetStairId;
    const affected = new Set<string>([source.stair.id, newStair.id]);
    if (oldPartnerId) affected.add(oldPartnerId);

    const floors = state.venue.floors.map((floor) => {
      let stairs = floor.stairs ?? [];
      if (floor.id === targetFloor.id) stairs = [...stairs, newStair];
      stairs = stairs.map((stair) => {
        if (stair.id === source.stair.id) {
          return {
            ...stair,
            targetFloorId: targetFloor.id,
            targetStairId: newStair.id,
            direction: sourceDirection,
          };
        }
        if (stair.id === newStair.id) return stair;
        if (stair.targetStairId && affected.has(stair.targetStairId)) {
          return { ...stair, targetFloorId: undefined, targetStairId: undefined };
        }
        if (stair.id !== newStair.id && affected.has(stair.id)) {
          return { ...stair, targetFloorId: undefined, targetStairId: undefined };
        }
        return stair;
      });
      return { ...floor, stairs };
    });

    set(withHistory(state, { ...state.venue, floors }, true));
    return newStair.id;
  },

  addRoom: (points) =>
    set((state) => {
      if (!state.venue || !state.activeFloorId || points.length < 3) return {};
      const floor = state.venue.floors.find((item) => item.id === state.activeFloorId);
      if (!floor) return {};
      const room: Room = {
        id: createId('room'),
        floorId: floor.id,
        name: `Помещение ${(floor.rooms?.length ?? 0) + 1}`,
        points,
        color: '#0ea5e9',
      };
      const venue = mapFloor(state.venue, floor.id, (item) => ({ ...item, rooms: [...(item.rooms ?? []), room] }));
      return {
        ...withHistory(state, venue, true),
        selection: { kind: 'room', id: room.id },
        tool: 'select',
      };
    }),

  updateRoom: (roomId, patch, record = true) =>
    set((state) => {
      if (!state.venue) return {};
      const floor = state.venue.floors.find((item) => item.rooms?.some((room) => room.id === roomId));
      if (!floor) return {};
      const venue = mapFloor(state.venue, floor.id, (item) => ({
        ...item,
        rooms: item.rooms?.map((room) => (room.id === roomId ? { ...room, ...patch } : room)),
      }));
      return withHistory(state, venue, record);
    }),

  deleteRoom: (roomId) =>
    set((state) => {
      if (!state.venue) return {};
      const floor = state.venue.floors.find((item) => item.rooms?.some((room) => room.id === roomId));
      if (!floor) return {};
      const venue = mapFloor(state.venue, floor.id, (item) => ({
        ...item,
        rooms: item.rooms?.filter((room) => room.id !== roomId),
      }));
      return {
        ...withHistory(state, venue, true),
        selection: state.selection?.kind === 'room' && state.selection.id === roomId ? null : state.selection,
      };
    }),

  addPanorama: ({ asset, x, y, linkPointId }) => {
    const state = get();
    if (!state.venue || !state.activeFloorId) return null;
    const floor = state.venue.floors.find((item) => item.id === state.activeFloorId);
    if (!floor) return null;
    const panorama: Panorama = {
      id: createId('panorama'),
      floorId: floor.id,
      x: Math.round(x),
      y: Math.round(y),
      url: asset.url,
      previewUrl: asset.url,
      yawOffset: 0,
      hotspots: [],
      asset,
    };
    const venue = mapFloor(state.venue, floor.id, (item) => ({
      ...item,
      panoramas: [...item.panoramas, panorama],
      points: linkPointId
        ? item.points.map((point) => {
            if (point.id === linkPointId) return { ...point, panoramaId: panorama.id };
            if (point.panoramaId === panorama.id) return { ...point, panoramaId: undefined };
            return point;
          })
        : item.points,
    }));
    set({
      ...withHistory(state, venue, true),
      selection: linkPointId ? { kind: 'point', id: linkPointId } : { kind: 'panorama', id: panorama.id },
    });
    return panorama.id;
  },

  replacePanoramaAsset: (panoramaId, asset) =>
    set((state) => {
      if (!state.venue) return {};
      const floor = state.venue.floors.find((item) => item.panoramas.some((panorama) => panorama.id === panoramaId));
      if (!floor) return {};
      const venue = mapFloor(state.venue, floor.id, (item) => ({
        ...item,
        panoramas: item.panoramas.map((panorama) =>
          panorama.id === panoramaId
            ? { ...panorama, asset, url: asset.url, previewUrl: asset.url }
            : panorama
        ),
      }));
      return {
        ...withHistory(state, venue, true),
        toast: { id: createId('toast'), tone: 'success', title: 'Панорама заменена', text: asset.fileName },
      };
    }),

  updatePanorama: (panoramaId, patch, record = true) =>
    set((state) => {
      if (!state.venue) return {};
      const floor = state.venue.floors.find((item) => item.panoramas.some((panorama) => panorama.id === panoramaId));
      if (!floor) return {};
      const venue = mapFloor(state.venue, floor.id, (item) => ({
        ...item,
        panoramas: item.panoramas.map((panorama) =>
          panorama.id === panoramaId ? { ...panorama, ...patch } : panorama
        ),
      }));
      return withHistory(state, venue, record);
    }),

  deletePanorama: (panoramaId) =>
    set((state) => {
      if (!state.venue) return {};
      const floor = state.venue.floors.find((item) => item.panoramas.some((panorama) => panorama.id === panoramaId));
      if (!floor) return {};
      const venue = mapFloor(state.venue, floor.id, (item) => ({
        ...item,
        panoramas: item.panoramas.filter((panorama) => panorama.id !== panoramaId),
        points: item.points.map((point) =>
          point.panoramaId === panoramaId ? { ...point, panoramaId: undefined } : point
        ),
      }));
      return {
        ...withHistory(state, venue, true),
        selection:
          state.selection?.kind === 'panorama' && state.selection.id === panoramaId ? null : state.selection,
      };
    }),

  linkPanorama: (pointId, panoramaId) =>
    set((state) => {
      if (!state.venue) return {};
      const floor = findFloorWithPoint(state.venue, pointId);
      if (!floor) return {};
      const panorama = panoramaId ? floor.panoramas.find((item) => item.id === panoramaId) : null;
      const point = floor.points.find((item) => item.id === pointId)!;
      const venue = mapFloor(state.venue, floor.id, (item) => ({
        ...item,
        points: item.points.map((candidate) => {
          if (candidate.id === pointId) return { ...candidate, panoramaId: panorama?.id };
          if (panorama && candidate.panoramaId === panorama.id) return { ...candidate, panoramaId: undefined };
          return candidate;
        }),
        panoramas: panorama
          ? item.panoramas.map((p) => (p.id === panorama.id ? { ...p, x: point.x, y: point.y } : p))
          : item.panoramas,
      }));
      return withHistory(state, venue, true);
    }),

  setTool: (tool) => set({ tool }),
  setPointCategory: (pointCategory) => set({ pointCategory }),
  select: (selection) => set({ selection }),

  undo: () =>
    set((state) => {
      const previous = state.history.past[state.history.past.length - 1];
      if (!state.venue || !previous) return {};
      const current = state.venue;
      const reconciled = reconcileSelection(previous, state.activeFloorId, state.selection);
      return {
        venue: previous,
        history: {
          past: state.history.past.slice(0, -1),
          future: [current, ...state.history.future].slice(0, HISTORY_LIMIT),
        },
        ...reconciled,
        dirty: true,
        saveStatus: 'idle',
        transaction: null,
        transactionDirty: false,
      };
    }),

  redo: () =>
    set((state) => {
      const next = state.history.future[0];
      if (!state.venue || !next) return {};
      const current = state.venue;
      const reconciled = reconcileSelection(next, state.activeFloorId, state.selection);
      return {
        venue: next,
        history: {
          past: [...state.history.past.slice(-(HISTORY_LIMIT - 1)), current],
          future: state.history.future.slice(1),
        },
        ...reconciled,
        dirty: true,
        saveStatus: 'idle',
        transaction: null,
        transactionDirty: false,
      };
    }),

  beginTransaction: () =>
    set((state) => {
      if (!state.venue) return {};
      return { transaction: cloneVenue(state.venue), transactionDirty: false };
    }),

  commitTransaction: () =>
    set((state) => {
      if (!state.transaction || !state.venue) return { transaction: null, transactionDirty: false };
      if (!state.transactionDirty) return { transaction: null, transactionDirty: false };
      return {
        history: {
          past: [...state.history.past.slice(-(HISTORY_LIMIT - 1)), state.transaction],
          future: [],
        },
        transaction: null,
        transactionDirty: false,
      };
    }),

  cancelTransaction: () =>
    set((state) => {
      if (!state.transaction) return {};
      return {
        venue: state.transaction,
        transaction: null,
        transactionDirty: false,
      };
    }),

  setSettings: (patch) => set((state) => ({ settings: { ...state.settings, ...patch } })),

  markSaving: () => set({ saveStatus: 'saving', saveError: null }),
  markSavedLocal: () => set({ saveStatus: 'saved-local', dirty: false, saveError: null, lastSavedAt: new Date().toISOString() }),
  markSavedServer: () =>
    set({ saveStatus: 'saved-server', dirty: false, saveError: null, lastSavedAt: new Date().toISOString() }),
  markSaveError: (message) => set({ saveStatus: 'error', saveError: message }),

  showToast: (tone, title, text) =>
    set({ toast: { id: createId('toast'), tone, title, text } }),
  dismissToast: () => set({ toast: null }),
}));

export function useActiveFloor(): Floor | null {
  return useEditorStore((state) => state.venue?.floors.find((floor) => floor.id === state.activeFloorId) ?? null);
}

export function useSelectedPoint(): POI | null {
  return useEditorStore((state) => {
    if (state.selection?.kind !== 'point') return null;
    return state.venue?.floors.flatMap((floor) => floor.points).find((point) => point.id === state.selection?.id) ?? null;
  });
}

export function useSelectedWall(): Wall | null {
  return useEditorStore((state) => {
    if (state.selection?.kind !== 'wall') return null;
    return state.venue?.floors.flatMap((floor) => floor.walls ?? []).find((wall) => wall.id === state.selection?.id) ?? null;
  });
}

export function useSelectedRoom(): Room | null {
  return useEditorStore((state) => {
    if (state.selection?.kind !== 'room') return null;
    return state.venue?.floors.flatMap((floor) => floor.rooms ?? []).find((room) => room.id === state.selection?.id) ?? null;
  });
}

export function useSelectedStair(): Stair | null {
  return useEditorStore((state) => {
    if (state.selection?.kind !== 'stair') return null;
    return state.venue?.floors.flatMap((floor) => floor.stairs ?? []).find((stair) => stair.id === state.selection?.id) ?? null;
  });
}

export function useSelectedPanorama(): Panorama | null {
  return useEditorStore((state) => {
    if (state.selection?.kind !== 'panorama') return null;
    return state.venue?.floors.flatMap((floor) => floor.panoramas).find((panorama) => panorama.id === state.selection?.id) ?? null;
  });
}

export function persistCurrentDraft(): SavedDraft | null {
  const state = useEditorStore.getState();
  if (!state.venue) return null;
  const draft = {
    venue: state.venue,
    activeFloorId: state.activeFloorId,
    settings: state.settings,
    savedAt: new Date().toISOString(),
  };
  saveDraft(draft);
  return draft;
}
