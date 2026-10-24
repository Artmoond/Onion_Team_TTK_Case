import {
  ADMIN_SCHEMA_VERSION,
  POINT_CATEGORIES,
  type AssetReference,
  type Floor,
  type Hotspot,
  type NavEdge,
  type NavGraph,
  type NavNode,
  type Panorama,
  type POI,
  type PointCategory,
  type Room,
  type RoomPoint,
  type Stair,
  type Venue,
  type Wall,
} from '../types/venue';
import { createId, slugify } from '../utils/id';
import { wallLength } from '../utils/geometry';

export class VenueValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VenueValidationError';
  }
}

const CATEGORY_SET = new Set<string>(POINT_CATEGORIES);

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function finite(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function positive(value: unknown, fallback: number): number {
  const parsed = finite(value, fallback);
  return parsed > 0 ? parsed : fallback;
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function isServerAssetUrl(url: string): boolean {
  return (
    /^https?:\/\//i.test(url) ||
    url.startsWith('data:') ||
    url.startsWith('/uploads/') ||
    url.startsWith('/demo/')
  );
}

function normalizeAsset(value: unknown): AssetReference | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const source = record(value);
  const id = text(source.id);
  const url = text(source.url);
  if (!id || !url) return undefined;
  return {
    ...(source as unknown as AssetReference),
    id,
    fileName: text(source.fileName, 'file'),
    mimeType: text(source.mimeType, 'application/octet-stream'),
    sizeBytes: Math.max(0, finite(source.sizeBytes)),
    storage: source.storage === 'server' || isServerAssetUrl(url) ? 'server' : 'local',
    url,
    createdAt: text(source.createdAt, new Date().toISOString()),
    width: source.width === undefined ? undefined : Math.max(0, finite(source.width)),
    height: source.height === undefined ? undefined : Math.max(0, finite(source.height)),
  };
}

function normalizeHotspot(value: unknown, panoramaId: string): Hotspot | null {
  const source = record(value);
  const id = text(source.id, createId('hotspot'));
  if (!id) return null;
  return {
    ...(source as unknown as Hotspot),
    id,
    panoramaId,
    yaw: finite(source.yaw),
    pitch: finite(source.pitch),
    type: source.type === 'scene' ? 'scene' : 'info',
    text: text(source.text),
    targetPanoramaId: text(source.targetPanoramaId) || undefined,
    poiId: text(source.poiId) || undefined,
  };
}

function normalizePanorama(value: unknown, floorId: string): Panorama {
  const source = record(value);
  const id = text(source.id, createId('panorama'));
  const asset = normalizeAsset(source.asset);
  const url = text(source.url, asset?.url ?? '');
  return {
    ...(source as unknown as Panorama),
    id,
    floorId,
    x: finite(source.x),
    y: finite(source.y),
    url,
    previewUrl: text(source.previewUrl, asset?.url ?? url),
    yawOffset: finite(source.yawOffset, 0),
    hotspots: array(source.hotspots)
      .map((hotspot) => normalizeHotspot(hotspot, id))
      .filter((hotspot): hotspot is Hotspot => Boolean(hotspot)),
    asset,
  };
}

function normalizeCategory(value: unknown): { category: PointCategory; original?: string } {
  if (typeof value === 'string' && CATEGORY_SET.has(value)) {
    return { category: value as PointCategory };
  }
  return { category: 'other', original: typeof value === 'string' ? value : undefined };
}

function normalizePoint(value: unknown, floorId: string, index: number): POI {
  const source = record(value);
  const { category, original } = normalizeCategory(source.category);
  const id = text(source.id, createId('poi'));
  const toggled: Record<string, unknown> = {};
  if (category === 'other' && original) {
    toggled.other = { ...record(source.other), label: text(record(source.other).label, original) };
  }
  return {
    ...(source as unknown as POI),
    ...toggled,
    id,
    floorId,
    name: text(source.name, `Точка ${index + 1}`),
    category,
    description: text(source.description) || undefined,
    x: finite(source.x),
    y: finite(source.y),
    isPublic: source.isPublic !== false,
    panoramaId: text(source.panoramaId) || undefined,
  };
}

function normalizeWall(value: unknown, floorId: string, metersPerPixel: number): Wall {
  const source = record(value);
  const x1 = finite(source.x1);
  const y1 = finite(source.y1);
  const x2 = finite(source.x2);
  const y2 = finite(source.y2);
  return {
    ...(source as unknown as Wall),
    id: text(source.id, createId('wall')),
    floorId,
    x1,
    y1,
    x2,
    y2,
    lengthMeters: wallLength(x1, y1, x2, y2, metersPerPixel),
    thickness: positive(source.thickness, 4),
    kind: source.kind === 'partition' || source.kind === 'boundary' ? source.kind : 'wall',
  };
}

function normalizeRoom(value: unknown, floorId: string, index: number): Room {
  const source = record(value);
  const points: RoomPoint[] = array(source.points)
    .map((point) => {
      const item = record(point);
      return { x: finite(item.x), y: finite(item.y) };
    });
  return {
    ...(source as unknown as Room),
    id: text(source.id, createId('room')),
    floorId,
    name: text(source.name, `Помещение ${index + 1}`),
    points,
    color: text(source.color, '#0ea5e9'),
    description: text(source.description) || undefined,
  };
}

function normalizeStair(value: unknown, floorId: string, index: number): Stair {
  const source = record(value);
  return {
    ...(source as unknown as Stair),
    id: text(source.id, createId('stair')),
    floorId,
    name: text(source.name, `Лестница ${index + 1}`),
    x1: finite(source.x1),
    y1: finite(source.y1),
    x2: finite(source.x2),
    y2: finite(source.y2),
    width: positive(source.width, 40),
    direction:
      source.direction === 'up' || source.direction === 'down' || source.direction === 'both'
        ? source.direction
        : 'both',
    targetFloorId: text(source.targetFloorId) || undefined,
    targetStairId: text(source.targetStairId) || undefined,
  };
}

function normalizeGraph(value: unknown, floorId: string): NavGraph {
  const source = record(value);
  const nodes: NavNode[] = array(source.nodes)
    .map((node) => {
      const item = record(node);
      return {
        ...(item as unknown as NavNode),
        id: text(item.id, createId('node')),
        floorId,
        x: finite(item.x),
        y: finite(item.y),
        kind: item.kind === 'door' || item.kind === 'stairs' || item.kind === 'elevator' ? item.kind : 'corridor',
      };
    });
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges: NavEdge[] = array(source.edges)
    .map((edge) => {
      const item = record(edge);
      const fromId = text(item.fromId);
      const toId = text(item.toId);
      if (!fromId || !toId || !nodeIds.has(fromId) || !nodeIds.has(toId)) return null;
      return {
        ...(item as unknown as NavEdge),
        id: text(item.id, createId('edge')),
        fromId,
        toId,
        lengthMeters: Math.max(0, finite(item.lengthMeters)),
        kind: item.kind === 'stairs' || item.kind === 'elevator' ? item.kind : 'walk',
        bidirectional: item.bidirectional !== false,
      };
    })
    .filter((edge): edge is NavEdge => Boolean(edge));
  return { nodes, edges };
}

function normalizeFloor(value: unknown, venueId: string, index: number, fallbackSlug: string): Floor {
  const source = record(value);
  const id = text(source.id, createId('floor'));
  const width = positive(source.width, 1200);
  const height = positive(source.height, 800);
  const metersPerPixel = positive(source.metersPerPixel, 0.05);
  const planAsset = normalizeAsset(source.planAsset);
  return {
    ...(source as unknown as Floor),
    id,
    venueId,
    level: finite(source.level, index + 1),
    name: text(source.name, `${index + 1} этаж — ${fallbackSlug}`),
    planUrl: text(source.planUrl, planAsset?.url ?? ''),
    width,
    height,
    metersPerPixel,
    points: array(source.points).map((point, pointIndex) => normalizePoint(point, id, pointIndex)),
    panoramas: array(source.panoramas).map((panorama) => normalizePanorama(panorama, id)),
    graph: normalizeGraph(source.graph, id),
    walls: array(source.walls).map((wall) => normalizeWall(wall, id, metersPerPixel)),
    rooms: array(source.rooms).map((room, roomIndex) => normalizeRoom(room, id, roomIndex)),
    stairs: array(source.stairs).map((stair, stairIndex) => normalizeStair(stair, id, stairIndex)),
    planAsset,
  };
}

function normalizeStairLinks(floors: Floor[]): void {
  const stairs = new Map<string, Stair>();
  for (const floor of floors) {
    for (const stair of floor.stairs ?? []) stairs.set(stair.id, stair);
  }
  const claimed = new Map<string, string>();

  for (const floor of floors) {
    for (const stair of floor.stairs ?? []) {
      const target = stair.targetStairId ? stairs.get(stair.targetStairId) : undefined;
      if (!target || target.id === stair.id || target.floorId === stair.floorId) {
        stair.targetStairId = undefined;
        stair.targetFloorId = undefined;
        continue;
      }
      stair.targetFloorId = target.floorId;

      const owner = claimed.get(target.id);
      const partnerTarget = target.targetStairId ? stairs.get(target.targetStairId) : undefined;
      if ((owner && owner !== stair.id) || (partnerTarget && partnerTarget.id !== stair.id)) {
        stair.targetStairId = undefined;
        stair.targetFloorId = undefined;
        continue;
      }
      claimed.set(target.id, stair.id);
      if (!target.targetStairId) {
        target.targetStairId = stair.id;
        target.targetFloorId = stair.floorId;
      }
    }
  }
}

export function normalizeVenue(value: unknown, fallbackSlug = 'venue'): Venue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new VenueValidationError('JSON должен содержать объект площадки.');
  }
  const source = record(value);
  const slug = slugify(text(source.slug, fallbackSlug)) || fallbackSlug;
  const id = text(source.id, createId('venue'));
  const floorsSource = array(source.floors);
  if (floorsSource.length === 0) {
    throw new VenueValidationError('В JSON отсутствует хотя бы один этаж (floors).');
  }
  const floors = floorsSource.map((floor, index) => normalizeFloor(floor, id, index, slug));
  const floorIds = new Set<string>();
  for (const floor of floors) {
    if (floorIds.has(floor.id)) {
      floor.id = createId('floor');
      floor.points = floor.points.map((point) => ({ ...point, floorId: floor.id }));
      floor.panoramas = floor.panoramas.map((panorama) => ({ ...panorama, floorId: floor.id }));
      floor.walls = floor.walls?.map((wall) => ({ ...wall, floorId: floor.id }));
      floor.rooms = floor.rooms?.map((room) => ({ ...room, floorId: floor.id }));
      floor.stairs = floor.stairs?.map((stair) => ({ ...stair, floorId: floor.id }));
    }
    floorIds.add(floor.id);
  }
  normalizeStairLinks(floors);
  return {
    ...(source as unknown as Venue),
    id,
    slug,
    title: text(source.title, 'Новая площадка'),
    description: text(source.description) || undefined,
    coverUrl: text(source.coverUrl) || undefined,
    floors,
    createdAt: text(source.createdAt, new Date().toISOString()),
    publishedRevision: Math.max(0, finite(source.publishedRevision)),
    schemaVersion: positive(source.schemaVersion, ADMIN_SCHEMA_VERSION),
    publicUrl: text(source.publicUrl) || undefined,
  };
}

export function parseVenueJson(input: string): Venue {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    throw new VenueValidationError('Файл не является корректным JSON.');
  }
  return normalizeVenue(parsed);
}

export function serializeVenue(venue: Venue): string {
  return JSON.stringify(
    {
      ...venue,
      schemaVersion: venue.schemaVersion ?? ADMIN_SCHEMA_VERSION,
      floors: venue.floors.map((floor) => ({
        ...floor,
        walls: floor.walls?.map((wall) => ({
          ...wall,
          lengthMeters: wallLength(wall.x1, wall.y1, wall.x2, wall.y2, floor.metersPerPixel),
        })),
      })),
    },
    null,
    2
  );
}

export function createEmptyFloor(venueId: string, level: number, name?: string): Floor {
  return {
    id: createId('floor'),
    venueId,
    level,
    name: name ?? `${level} этаж`,
    planUrl: '',
    width: 1200,
    height: 800,
    metersPerPixel: 0.05,
    points: [],
    panoramas: [],
    graph: { nodes: [], edges: [] },
    walls: [],
    rooms: [],
    stairs: [],
  };
}

export function createEmptyVenue(title: string, slugInput: string, description = ''): Venue {
  const slug = slugify(slugInput || title) || `venue-${Date.now()}`;
  const id = createId('venue');
  return {
    id,
    slug,
    title: title.trim() || 'Новая площадка',
    description: description.trim() || undefined,
    floors: [createEmptyFloor(id, 1, '1 этаж')],
    createdAt: new Date().toISOString(),
    publishedRevision: 0,
    schemaVersion: ADMIN_SCHEMA_VERSION,
  };
}

export function findFloor(venue: Venue | null, floorId: string | null): Floor | null {
  return venue?.floors.find((floor) => floor.id === floorId) ?? null;
}
