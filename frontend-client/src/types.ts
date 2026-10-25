// Общие TypeScript типы для Mobile Client (согласованы с shared/types.ts)

export type PointCategory = 
  | 'sponsor'    // Стенды компаний (ТТК и др.)
  | 'hall'       // Конференц-залы, сцены
  | 'food'       // Кофе-брейк, буфет, ресторан
  | 'wc'         // Санузлы
  | 'service'    // Ресепшн, гардероб, медпункт
  | 'wifi'       // Зоны усиленного Wi-Fi
  | 'entrance';  // Входы и выходы

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
  tags?: string[];
}

export interface Hotspot {
  id: string;
  panoramaId: string;
  yaw: number;     // Угол поворота по горизонтали (-180..180)
  pitch: number;   // Угол по вертикали (-90..90)
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
  title?: string;
  url: string;
  previewUrl: string;
  yawOffset?: number;
  hotspots: Hotspot[];
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

export interface Stair {
  id: string;
  floorId: string;
  name: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  direction?: 'up' | 'down' | 'both';
  targetFloorId?: string;
  targetStairId?: string;
}

export interface Floor {
  id: string;
  venueId: string;
  level: number;
  name: string;
  planUrl?: string;
  width: number;
  height: number;
  metersPerPixel: number;
  points: POI[];
  panoramas: Panorama[];
  graph: NavGraph;
  walls?: Wall[];
  rooms?: Room[];
  stairs?: Stair[];
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
}

export interface RouteLeg {
  floorId: string;
  floorLevel: number;
  points: [number, number][];
}

export interface RouteResponse {
  totalDistanceMeters: number;
  estimatedDurationSeconds: number;
  legs: RouteLeg[];
  panoramas: string[];
  steps: string[];
}
