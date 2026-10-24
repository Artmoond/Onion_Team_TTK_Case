export const POINT_CATEGORIES = [
  'sponsor',
  'hall',
  'food',
  'wc',
  'service',
  'wifi',
  'entrance',
  'panorama',
  'info',
  'wardrobe',
  'other',
] as const;

export type PointCategory = (typeof POINT_CATEGORIES)[number];

export type PointStorage = 'local' | 'server';

export interface AssetReference {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storage: PointStorage;
  url: string;
  createdAt: string;
  width?: number;
  height?: number;
}

export interface WifiSettings {
  ssid?: string;
  password?: string;
  security?: 'open' | 'WPA2' | 'WPA3' | 'enterprise';
  hidden?: boolean;
}

export interface InfoPointSettings {
  link?: string;
  schedule?: string;
}

export interface EntranceSettings {
  direction?: 'in' | 'out' | 'both';
  accessible?: boolean;
}

export interface WardrobeSettings {
  openHours?: string;
  capacity?: number;
}

export interface OtherPointSettings {
  label?: string;
  settings?: Record<string, string>;
}

export interface POI {
  id: string;
  floorId: string;
  name: string;
  category: PointCategory;
  description?: string;
  x: number;
  y: number;
  photoUrl?: string;
  isPublic: boolean;
  panoramaId?: string;
  wifi?: WifiSettings;
  info?: InfoPointSettings;
  entrance?: EntranceSettings;
  wardrobe?: WardrobeSettings;
  other?: OtherPointSettings;
}

export interface Hotspot {
  id: string;
  panoramaId: string;
  yaw: number;
  pitch: number;
  type: 'info' | 'scene';
  text: string;
  targetPanoramaId?: string;
  poiId?: string;
}

export interface Panorama {
  id: string;
  floorId: string;
  x: number;
  y: number;
  url: string;
  previewUrl: string;
  yawOffset?: number;
  hotspots: Hotspot[];
  asset?: AssetReference;
}

export interface NavNode {
  id: string;
  floorId: string;
  x: number;
  y: number;
  kind?: 'corridor' | 'door' | 'stairs' | 'elevator';
}

export interface NavEdge {
  id: string;
  fromId: string;
  toId: string;
  lengthMeters: number;
  kind: 'walk' | 'stairs' | 'elevator';
  bidirectional: boolean;
}

export interface NavGraph {
  nodes: NavNode[];
  edges: NavEdge[];
}

export interface Wall {
  id: string;
  floorId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  lengthMeters: number;
  thickness?: number;
  kind?: 'wall' | 'partition' | 'boundary';
}

export type StairDirection = 'up' | 'down' | 'both';

export interface Stair {
  id: string;
  floorId: string;
  name: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  direction: StairDirection;
  targetFloorId?: string;
  targetStairId?: string;
}

export interface RoomPoint {
  x: number;
  y: number;
}

export interface Room {
  id: string;
  floorId: string;
  name: string;
  points: RoomPoint[];
  color?: string;
  description?: string;
}

export interface Floor {
  id: string;
  venueId: string;
  level: number;
  name: string;
  planUrl: string;
  width: number;
  height: number;
  metersPerPixel: number;
  points: POI[];
  panoramas: Panorama[];
  graph: NavGraph;
  walls?: Wall[];
  rooms?: Room[];
  stairs?: Stair[];
  planAsset?: AssetReference;
}

export interface Venue {
  id: string;
  slug: string;
  title: string;
  description?: string;
  coverUrl?: string;
  floors: Floor[];
  createdAt: string;
  publishedRevision: number;
  schemaVersion?: number;
  publicUrl?: string;
}

export type EditorTool = 'select' | 'pan' | 'point' | 'wall' | 'room' | 'stairs' | 'calibrate';

export interface ProjectSettings {
  publicUrlOverride: string;
}

export const ADMIN_SCHEMA_VERSION = 1;
