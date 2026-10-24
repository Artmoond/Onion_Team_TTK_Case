import { Venue } from '../types';

export const mockVenue: Venue = {
  id: 'venue-ttk-expo-2026',
  slug: 'ttk-expo',
  title: 'Инновационный Экспоцентр ТТК',
  description: 'Ежегодный технологический форум ТрансТелеКом. Интерактивная навигация, квантовые сети и виртуальные туры.',
  coverUrl: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&q=80',
  publishedRevision: 1,
  createdAt: '2026-10-24T10:00:00Z',
  floors: [
    {
      id: 'floor-1',
      venueId: 'venue-ttk-expo-2026',
      level: 1,
      name: '1 этаж — Главный павильон',
      width: 1200,
      height: 800,
      metersPerPixel: 0.05,
      points: [
        {
          id: 'poi-entrance',
          floorId: 'floor-1',
          name: 'Главный вход & Регистрация',
          category: 'entrance',
          description: 'Выдача бейджей участников, справочная служба ТТК, гардероб и навигационные терминалы.',
          x: 600,
          y: 740,
          isPublic: true,
          panoramaId: 'pano-entrance',
          tags: ['вход', 'регистрация', 'ресепшн', 'бейдж', 'гардероб']
        },
        {
          id: 'poi-ttk-stand',
          floorId: 'floor-1',
          name: 'Центральный стенд ТТК',
          category: 'sponsor',
          description: 'Флагманский стенд ТрансТелеКом: демонстрация indoor-навигации, квантовых каналов, IoT решений и приватных сетей.',
          x: 600,
          y: 400,
          isPublic: true,
          panoramaId: 'pano-ttk',
          tags: ['ттк', 'стенд', 'инновации', 'квантовые', 'indoor']
        },
        {
          id: 'poi-main-hall',
          floorId: 'floor-1',
          name: 'Конференц-зал «Сириус»',
          category: 'hall',
          description: 'Главная сцена: ключевые пленарные сессии, круглые столы, защита хакатон-проектов (вместимость 500 чел).',
          x: 250,
          y: 300,
          isPublic: true,
          panoramaId: 'pano-hall',
          tags: ['зал', 'сцена', 'сириус', 'доклады', 'спикеры']
        },
        {
          id: 'poi-food',
          floorId: 'floor-1',
          name: 'Кофе-брейк и Lounge-зона',
          category: 'food',
          description: 'Свежесваренный кофе, чай, выпечка, мягкие пуфы и зона нетворкинга участников.',
          x: 950,
          y: 300,
          isPublic: true,
          panoramaId: 'pano-food',
          tags: ['кофе', 'еда', 'чай', 'обед', 'лаундж', 'перерыв']
        },
        {
          id: 'poi-wc-1',
          floorId: 'floor-1',
          name: 'Санузлы (1 этаж)',
          category: 'wc',
          description: 'Мужской, женский и специально оборудованный санузел для маломобильных групп граждан (МГН).',
          x: 1050,
          y: 700,
          isPublic: true,
          tags: ['wc', 'туалет', 'санузел', 'уборная']
        },
        {
          id: 'poi-wifi-1',
          floorId: 'floor-1',
          name: 'Зона High-Speed Wi-Fi 6 ТТК',
          category: 'wifi',
          description: 'Зона усиленного радиопокрытия гигабитным беспроводным интернетом от магистрального провайдера ТТК.',
          x: 600,
          y: 570,
          isPublic: true,
          tags: ['wifi', 'интернет', 'вайфай', 'сеть']
        },
        {
          id: 'poi-stairs-1',
          floorId: 'floor-1',
          name: 'Лестница на 2 этаж',
          category: 'service',
          description: 'Широкая парадная лестница с выходом к переговорным залам и VIP-лаунджу второго яруса.',
          x: 300,
          y: 650,
          isPublic: true,
          tags: ['лестница', '2 этаж', 'подъем', 'переход']
        }
      ],
      panoramas: [
        {
          id: 'pano-entrance',
          floorId: 'floor-1',
          title: '360° Входная группа и Регистрация',
          x: 600,
          y: 700,
          url: '/demo-pano.webp',
          previewUrl: '/demo-pano.webp',
          yawOffset: 0,
          hotspots: [
            {
              id: 'h-to-ttk',
              panoramaId: 'pano-entrance',
              yaw: 0,
              pitch: -3,
              type: 'scene',
              text: 'Пройти к стенду ТТК',
              targetPanoramaId: 'pano-ttk'
            },
            {
              id: 'h-info-reg',
              panoramaId: 'pano-entrance',
              yaw: -30,
              pitch: 2,
              type: 'info',
              text: 'Стойка регистрации ТТК',
              poiId: 'poi-entrance'
            }
          ]
        },
        {
          id: 'pano-ttk',
          floorId: 'floor-1',
          title: '360° Центральный стенд ТТК',
          x: 600,
          y: 400,
          url: '/demo-pano-2.webp',
          previewUrl: '/demo-pano-2.webp',
          yawOffset: 0,
          hotspots: [
            {
              id: 'h-to-hall',
              panoramaId: 'pano-ttk',
              yaw: -95,
              pitch: -2,
              type: 'scene',
              text: 'Пройти в зал «Сириус»',
              targetPanoramaId: 'pano-hall'
            },
            {
              id: 'h-to-food',
              panoramaId: 'pano-ttk',
              yaw: 85,
              pitch: -2,
              type: 'scene',
              text: 'Пройти в зону Кофе-брейка',
              targetPanoramaId: 'pano-food'
            },
            {
              id: 'h-to-entrance',
              panoramaId: 'pano-ttk',
              yaw: 180,
              pitch: -4,
              type: 'scene',
              text: 'Назад к выходу и гардеробу',
              targetPanoramaId: 'pano-entrance'
            },
            {
              id: 'h-info-ttk',
              panoramaId: 'pano-ttk',
              yaw: 5,
              pitch: 5,
              type: 'info',
              text: 'Флагманские решения ТТК',
              poiId: 'poi-ttk-stand'
            }
          ]
        },
        {
          id: 'pano-hall',
          floorId: 'floor-1',
          title: '360° Конференц-зал «Сириус»',
          x: 250,
          y: 300,
          url: '/demo-pano.webp',
          previewUrl: '/demo-pano.webp',
          yawOffset: 90,
          hotspots: [
            {
              id: 'h-hall-to-ttk',
              panoramaId: 'pano-hall',
              yaw: 85,
              pitch: -3,
              type: 'scene',
              text: 'Выйти к стенду ТТК',
              targetPanoramaId: 'pano-ttk'
            },
            {
              id: 'h-hall-info',
              panoramaId: 'pano-hall',
              yaw: -10,
              pitch: 4,
              type: 'info',
              text: 'Главная трибуна и экран',
              poiId: 'poi-main-hall'
            }
          ]
        },
        {
          id: 'pano-food',
          floorId: 'floor-1',
          title: '360° Кофе-брейк зона',
          x: 950,
          y: 300,
          url: '/demo-pano-2.webp',
          previewUrl: '/demo-pano-2.webp',
          yawOffset: -90,
          hotspots: [
            {
              id: 'h-food-to-ttk',
              panoramaId: 'pano-food',
              yaw: -95,
              pitch: -3,
              type: 'scene',
              text: 'Выйти в центральный холл',
              targetPanoramaId: 'pano-ttk'
            },
            {
              id: 'h-food-info',
              panoramaId: 'pano-food',
              yaw: 0,
              pitch: 3,
              type: 'info',
              text: 'Кофейная станция и десерты',
              poiId: 'poi-food'
            }
          ]
        }
      ],
      graph: {
        nodes: [
          { id: 'n-entrance', floorId: 'floor-1', x: 600, y: 740, kind: 'door' },
          { id: 'n-cross-main', floorId: 'floor-1', x: 600, y: 600, kind: 'corridor' },
          { id: 'n-wifi', floorId: 'floor-1', x: 600, y: 570, kind: 'corridor' },
          { id: 'n-ttk-stand', floorId: 'floor-1', x: 600, y: 400, kind: 'corridor' },
          { id: 'n-cross-north', floorId: 'floor-1', x: 600, y: 300, kind: 'corridor' },
          { id: 'n-hall-door', floorId: 'floor-1', x: 250, y: 300, kind: 'door' },
          { id: 'n-food-door', floorId: 'floor-1', x: 950, y: 300, kind: 'door' },
          { id: 'n-stairs-1', floorId: 'floor-1', x: 300, y: 650, kind: 'stairs' },
          { id: 'n-wc-1', floorId: 'floor-1', x: 1050, y: 700, kind: 'door' }
        ],
        edges: [
          { id: 'e1', fromId: 'n-entrance', toId: 'n-cross-main', lengthMeters: 7, kind: 'walk', bidirectional: true },
          { id: 'e-wifi', fromId: 'n-cross-main', toId: 'n-wifi', lengthMeters: 2, kind: 'walk', bidirectional: true },
          { id: 'e2', fromId: 'n-wifi', toId: 'n-ttk-stand', lengthMeters: 8, kind: 'walk', bidirectional: true },
          { id: 'e3', fromId: 'n-ttk-stand', toId: 'n-cross-north', lengthMeters: 5, kind: 'walk', bidirectional: true },
          { id: 'e4', fromId: 'n-cross-north', toId: 'n-hall-door', lengthMeters: 17, kind: 'walk', bidirectional: true },
          { id: 'e5', fromId: 'n-cross-north', toId: 'n-food-door', lengthMeters: 17, kind: 'walk', bidirectional: true },
          { id: 'e6', fromId: 'n-cross-main', toId: 'n-stairs-1', lengthMeters: 15, kind: 'walk', bidirectional: true },
          { id: 'e7', fromId: 'n-cross-main', toId: 'n-wc-1', lengthMeters: 22, kind: 'walk', bidirectional: true }
        ]
      }
    },
    {
      id: 'floor-2',
      venueId: 'venue-ttk-expo-2026',
      level: 2,
      name: '2 этаж — VIP-зона & Переговорные',
      width: 1200,
      height: 800,
      metersPerPixel: 0.05,
      points: [
        {
          id: 'poi-stairs-2',
          floorId: 'floor-2',
          name: 'Лестничный спуск на 1 этаж',
          category: 'service',
          description: 'Спуск в центральный холл 1 этажа.',
          x: 300,
          y: 650,
          isPublic: true,
          tags: ['лестница', '1 этаж', 'спуск']
        },
        {
          id: 'poi-vip-lounge',
          floorId: 'floor-2',
          name: 'VIP Lounge & Пресс-центр',
          category: 'sponsor',
          description: 'Закрытая зона для стратегических партнеров ТТК, интервью и деловых переговоров.',
          x: 600,
          y: 350,
          isPublic: true,
          tags: ['vip', 'партнеры', 'вип', 'переговоры']
        },
        {
          id: 'poi-room-a',
          floorId: 'floor-2',
          name: 'Переговорная «Байкал»',
          category: 'hall',
          description: 'Зал для деловых встреч на 16 персон с ВКС-системой от ТТК.',
          x: 250,
          y: 350,
          isPublic: true,
          tags: ['переговорная', 'встречи', 'байкал']
        },
        {
          id: 'poi-room-b',
          floorId: 'floor-2',
          name: 'Переговорная «Енисей»',
          category: 'hall',
          description: 'Зал для презентаций продуктов и круглых столов.',
          x: 950,
          y: 350,
          isPublic: true,
          tags: ['переговорная', 'енисей', 'встречи']
        }
      ],
      panoramas: [],
      graph: {
        nodes: [
          { id: 'n2-stairs', floorId: 'floor-2', x: 300, y: 650, kind: 'stairs' },
          { id: 'n2-corridor', floorId: 'floor-2', x: 600, y: 550, kind: 'corridor' },
          { id: 'n2-vip', floorId: 'floor-2', x: 600, y: 350, kind: 'door' },
          { id: 'n2-room-a', floorId: 'floor-2', x: 250, y: 350, kind: 'door' },
          { id: 'n2-room-b', floorId: 'floor-2', x: 950, y: 350, kind: 'door' }
        ],
        edges: [
          { id: 'e2-1', fromId: 'n2-stairs', toId: 'n2-corridor', lengthMeters: 16, kind: 'walk', bidirectional: true },
          { id: 'e2-2', fromId: 'n2-corridor', toId: 'n2-vip', lengthMeters: 10, kind: 'walk', bidirectional: true },
          { id: 'e2-3', fromId: 'n2-corridor', toId: 'n2-room-a', lengthMeters: 20, kind: 'walk', bidirectional: true },
          { id: 'e2-4', fromId: 'n2-corridor', toId: 'n2-room-b', lengthMeters: 20, kind: 'walk', bidirectional: true }
        ]
      }
    }
  ]
};
