// Общие TypeScript типы для всей команды (Frontend Client, Frontend Admin, Backend)

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
  // Координаты на 2D плане (нормализованные 0..1 или в пикселях)
  x: number;
  y: number;
  photoUrl?: string;
  isPublic: boolean;
}

export interface Hotspot {
  id: string;
  panoramaId: string;
  yaw: number;     // Угол поворота по горизонтали (-180..180)
  pitch: number;   // Угол по вертикали (-90..90)
  type: 'info' | 'scene';
  text: string;
  targetPanoramaId?: string; // Если type === 'scene'
  poiId?: string;            // Если type === 'info'
}

export interface Panorama {
  id: string;
  floorId: string;
  x: number;       // Привязка к координате на 2D плане
  y: number;
  url: string;     // URL полной панорамы (WebP)
  previewUrl: string; // URL превью (1024x512 WebP для быстрого старта)
  yawOffset?: number; // Смещение относительно севера на 2D плане
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

export interface Floor {
  id: string;
  venueId: string;
  level: number;       // Номер этажа: 1, 2, -1
  name: string;        // "1 этаж — Главный зал"
  planUrl: string;     // Ссылка на картинку плана (SVG / PNG / WebP)
  width: number;       // Разрешение плана
  height: number;
  metersPerPixel: number; // Калибровка масштаба (метров в 1 пикселе)
  points: POI[];
  panoramas: Panorama[];
  graph: NavGraph;
}

export interface Venue {
  id: string;
  slug: string;        // Уникальный идентификатор для ссылки: /m/ttk-expo
  title: string;       // Название площадки
  description?: string;
  coverUrl?: string;
  floors: Floor[];
  createdAt: string;
  publishedRevision: number;
}

// Запрос и ответ навигации
export interface RouteRequest {
  fromPoiId?: string;
  toPoiId?: string;
  fromCoords?: { floorId: string; x: number; y: number };
  toCoords?: { floorId: string; x: number; y: number };
  accessibleOnly?: boolean; // Исключить лестницы
}

export interface RouteLeg {
  floorId: string;
  floorLevel: number;
  // Точки полилинии [[x1, y1], [x2, y2], ...]
  points: [number, number][];
}

export interface RouteResponse {
  totalDistanceMeters: number;
  estimatedDurationSeconds: number;
  legs: RouteLeg[];
  // Упорядоченный список ID панорам для режима «Виртуальная прогулка»
  panoramas: string[];
  // Человекочитаемые подсказки
  steps: string[];
}
