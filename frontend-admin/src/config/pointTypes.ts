import {
  Accessibility,
  DoorOpen,
  Info,
  MapPin,
  PanelsTopLeft,
  Shirt,
  Sparkles,
  Tv,
  Utensils,
  Wifi,
  type LucideIcon,
} from 'lucide-react';
import type { POI, PointCategory } from '../types/venue';

export interface PointTypeDefinition {
  category: PointCategory;
  label: string;
  shortLabel: string;
  color: string;
  softColor: string;
  description: string;
  icon: LucideIcon;
  supportsPanorama?: boolean;
  createSettings: () => Partial<POI>;
}

const base = { isPublic: true };

export const POINT_TYPES: Record<PointCategory, PointTypeDefinition> = {
  wifi: {
    category: 'wifi',
    label: 'Wi-Fi',
    shortLabel: 'Wi',
    color: '#06b6d4',
    softColor: '#083344',
    description: 'Точка доступа к беспроводной сети',
    icon: Wifi,
    createSettings: () => ({ ...base, wifi: { security: 'WPA2', hidden: false } }),
  },
  panorama: {
    category: 'panorama',
    label: 'Панорама',
    shortLabel: '360',
    color: '#a855f7',
    softColor: '#2e1065',
    description: '360° панорама помещения',
    icon: PanelsTopLeft,
    supportsPanorama: true,
    createSettings: () => ({ ...base }),
  },
  info: {
    category: 'info',
    label: 'Информация',
    shortLabel: 'i',
    color: '#38bdf8',
    softColor: '#082f49',
    description: 'Информационная точка или стенд',
    icon: Info,
    createSettings: () => ({ ...base, info: {} }),
  },
  entrance: {
    category: 'entrance',
    label: 'Вход / выход',
    shortLabel: '↔',
    color: '#22c55e',
    softColor: '#052e16',
    description: 'Вход и выход павильона',
    icon: DoorOpen,
    createSettings: () => ({ ...base, entrance: { direction: 'both', accessible: false } }),
  },
  wardrobe: {
    category: 'wardrobe',
    label: 'Гардероб',
    shortLabel: 'Г',
    color: '#f59e0b',
    softColor: '#451a03',
    description: 'Гардероб и хранение вещей',
    icon: Shirt,
    createSettings: () => ({ ...base, wardrobe: {} }),
  },
  service: {
    category: 'service',
    label: 'Сервис',
    shortLabel: 'S',
    color: '#94a3b8',
    softColor: '#1e293b',
    description: 'Ресепшн, справка, служебная зона',
    icon: Accessibility,
    createSettings: () => ({ ...base }),
  },
  sponsor: {
    category: 'sponsor',
    label: 'Стенд',
    shortLabel: 'ТТК',
    color: '#E30613',
    softColor: '#450a0a',
    description: 'Стенд компании или партнёра',
    icon: Sparkles,
    createSettings: () => ({ ...base }),
  },
  hall: {
    category: 'hall',
    label: 'Зал / сцена',
    shortLabel: 'A',
    color: '#f97316',
    softColor: '#431407',
    description: 'Конференц-зал, сцена, лекторий',
    icon: Tv,
    createSettings: () => ({ ...base }),
  },
  food: {
    category: 'food',
    label: 'Еда',
    shortLabel: 'F',
    color: '#eab308',
    softColor: '#422006',
    description: 'Кофе-брейк, буфет, ресторан',
    icon: Utensils,
    createSettings: () => ({ ...base }),
  },
  wc: {
    category: 'wc',
    label: 'Санузел',
    shortLabel: 'WC',
    color: '#64748b',
    softColor: '#1e293b',
    description: 'Санузлы, в том числе для МГН',
    icon: MapPin,
    createSettings: () => ({ ...base }),
  },
  other: {
    category: 'other',
    label: 'Другое',
    shortLabel: '?',
    color: '#e879f9',
    softColor: '#4a044e',
    description: 'Расширяемый пользовательский тип',
    icon: MapPin,
    createSettings: () => ({ ...base, other: { label: 'Другое', settings: {} } }),
  },
};

export const POINT_TYPE_LIST = Object.values(POINT_TYPES);
