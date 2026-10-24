import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Floor, POI, RouteResponse, Panorama } from '../types';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Camera,
  Award,
  Presentation,
  Coffee,
  Bath,
  Wifi,
  DoorOpen,
  ArrowLeft,
  Footprints
} from 'lucide-react';

interface InteractiveMapProps {
  floor: Floor;
  pois: POI[];
  selectedPoi: POI | null;
  onSelectPoi: (poi: POI) => void;
  onClearSelectedPoi: () => void;
  activeRoute: RouteResponse | null;
  onOpenPanorama: (panoId: string) => void;
  activeZoneId: string | null;
  onZoneChange: (zoneId: string | null) => void;
}

interface MapZone {
  id: string;
  name: string;
  floorLevel: number;
  shape: 'rect' | 'circle';
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  cx?: number;
  cy?: number;
  r?: number;
  centerX: number;
  centerY: number;
  zoomScale: number;
  poiIds: string[];
  panoIds: string[];
  color: string;
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  floor,
  pois,
  selectedPoi,
  onSelectPoi,
  onClearSelectedPoi,
  activeRoute,
  onOpenPanorama,
  activeZoneId,
  onZoneChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Базовый масштаб по умолчанию: 1.0 (ровно 100%, весь план полностью виден)
  const BASE_SCALE = 1.0;
  const MAX_SCALE = 3.5;

  // Состояние трансформации (масштаб и смещение)
  const [scale, setScale] = useState<number>(BASE_SCALE);
  const [translate, setTranslate] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const translateStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Состояния наведения
  const [hoveredZoneId, setHoveredZoneId] = useState<string | null>(null);
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);

  // Мультитач для pinch-to-zoom
  const touchDistRef = useRef<number | null>(null);

  // Конфигурация кликабельных зон/прямоугольников
  const zones: MapZone[] = useMemo(() => {
    if (floor.level === 1) {
      return [
        {
          id: 'zone-sirius',
          name: 'Конференц-зал «Сириус»',
          floorLevel: 1,
          shape: 'rect',
          x: 50,
          y: 50,
          width: 380,
          height: 430,
          centerX: 240,
          centerY: 265,
          zoomScale: 1.8,
          poiIds: ['poi-main-hall'],
          panoIds: ['pano-hall'],
          color: '#6366f1',
        },
        {
          id: 'zone-food',
          name: 'Кофе-брейк & Lounge',
          floorLevel: 1,
          shape: 'rect',
          x: 770,
          y: 50,
          width: 380,
          height: 430,
          centerX: 960,
          centerY: 265,
          zoomScale: 1.8,
          poiIds: ['poi-food'],
          panoIds: ['pano-food'],
          color: '#f59e0b',
        },
        {
          id: 'zone-ttk',
          name: 'Центральный стенд ТТК',
          floorLevel: 1,
          shape: 'circle',
          cx: 600,
          cy: 360,
          r: 115,
          centerX: 600,
          centerY: 360,
          zoomScale: 1.9,
          poiIds: ['poi-ttk-stand'],
          panoIds: ['pano-ttk'],
          color: '#E30613',
        },
        {
          id: 'zone-wifi-1',
          name: 'Зона Wi-Fi 6 ТТК',
          floorLevel: 1,
          shape: 'circle',
          cx: 600,
          cy: 540,
          r: 45,
          centerX: 600,
          centerY: 540,
          zoomScale: 2.1,
          poiIds: ['poi-wifi-1'],
          panoIds: [],
          color: '#3b82f6',
        },
        {
          id: 'zone-entrance',
          name: 'Входная группа & Регистрация',
          floorLevel: 1,
          shape: 'rect',
          x: 430,
          y: 650,
          width: 340,
          height: 95,
          centerX: 600,
          centerY: 697,
          zoomScale: 1.9,
          poiIds: ['poi-entrance'],
          panoIds: ['pano-entrance'],
          color: '#10b981',
        },
        {
          id: 'zone-stairs-1',
          name: 'Лестница на 2 этаж',
          floorLevel: 1,
          shape: 'rect',
          x: 60,
          y: 600,
          width: 340,
          height: 145,
          centerX: 230,
          centerY: 672,
          zoomScale: 1.9,
          poiIds: ['poi-stairs-1'],
          panoIds: [],
          color: '#64748b',
        },
        {
          id: 'zone-wc-1',
          name: 'Санузлы WC',
          floorLevel: 1,
          shape: 'rect',
          x: 800,
          y: 600,
          width: 340,
          height: 145,
          centerX: 970,
          centerY: 672,
          zoomScale: 1.9,
          poiIds: ['poi-wc-1'],
          panoIds: [],
          color: '#06b6d4',
        },
      ];
    } else {
      return [
        {
          id: 'zone-vip',
          name: 'VIP Lounge ТТК',
          floorLevel: 2,
          shape: 'rect',
          x: 430,
          y: 90,
          width: 340,
          height: 420,
          centerX: 600,
          centerY: 300,
          zoomScale: 2.2,
          poiIds: ['poi-vip-lounge'],
          panoIds: [],
          color: '#e11d48',
        },
        {
          id: 'zone-room-a',
          name: 'Переговорная «Байкал»',
          floorLevel: 2,
          shape: 'rect',
          x: 60,
          y: 110,
          width: 340,
          height: 400,
          centerX: 230,
          centerY: 310,
          zoomScale: 2.25,
          poiIds: ['poi-room-a'],
          panoIds: [],
          color: '#6366f1',
        },
        {
          id: 'zone-room-b',
          name: 'Переговорная «Енисей»',
          floorLevel: 2,
          shape: 'rect',
          x: 800,
          y: 110,
          width: 340,
          height: 400,
          centerX: 970,
          centerY: 310,
          zoomScale: 2.25,
          poiIds: ['poi-room-b'],
          panoIds: [],
          color: '#6366f1',
        },
        {
          id: 'zone-stairs-2',
          name: 'Спуск на 1 этаж',
          floorLevel: 2,
          shape: 'rect',
          x: 60,
          y: 600,
          width: 340,
          height: 145,
          centerX: 230,
          centerY: 672,
          zoomScale: 2.4,
          poiIds: ['poi-stairs-2'],
          panoIds: [],
          color: '#64748b',
        },
      ];
    }
  }, [floor.level]);

  // Сброс масштаба в центр (возврат к общему плану 100%)
  const handleResetView = useCallback(() => {
    setScale(BASE_SCALE);
    setTranslate({ x: 0, y: 0 });
    onZoneChange(null);
    onClearSelectedPoi();
  }, [onZoneChange, onClearSelectedPoi]);

  // Зум к конкретной зоне
  const handleZoomToZone = (zone: MapZone) => {
    onZoneChange(zone.id);
    const targetScale = zone.zoomScale;
    const offsetX = (600 - zone.centerX) * (targetScale * 0.85);
    const offsetY = (400 - zone.centerY) * (targetScale * 0.85);

    // Ограничение смещения, чтобы не улететь
    const maxBoundX = (targetScale - 1) * 450;
    const maxBoundY = (targetScale - 1) * 350;
    const clampedX = Math.max(-maxBoundX, Math.min(maxBoundX, offsetX));
    const clampedY = Math.max(-maxBoundY, Math.min(maxBoundY, offsetY));

    setScale(targetScale);
    setTranslate({ x: clampedX, y: clampedY });
  };

  // Зум кнопками
  const handleZoom = (delta: number) => {
    if (delta < 0) {
      // Пользователь отдаляется — убираем карточку информации!
      onClearSelectedPoi();
    }
    setScale(prev => {
      const next = Math.min(MAX_SCALE, Math.max(BASE_SCALE, Number((prev + delta).toFixed(2))));
      if (next <= BASE_SCALE) {
        setTranslate({ x: 0, y: 0 });
        onZoneChange(null);
        onClearSelectedPoi();
      }
      return next;
    });
  };

  // Колесо мыши (зум с ограничением)
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 0.15 : -0.15;
    if (zoomFactor < 0) {
      // Отдаление колесиком — убираем карточку информации
      onClearSelectedPoi();
    }
    handleZoom(zoomFactor);
  };

  // Перетаскивание карты: ЗАПРЕЩЕНО при 100% зуме!
  const handlePointerDown = (e: React.PointerEvent) => {
    // При 100% зуме интерфейс заблокирован и двигать его нельзя!
    if (scale <= BASE_SCALE) return;
    if ((e.target as HTMLElement).closest('.interactive-pin')) return;

    setIsPanning(true);
    panStartRef.current = { x: e.clientX, y: e.clientY };
    translateStartRef.current = { ...translate };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isPanning || scale <= BASE_SCALE) return;

    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    const newX = translateStartRef.current.x + dx;
    const newY = translateStartRef.current.y + dy;

    // Границы, чтобы не улететь за рамки здания
    const maxBoundX = (scale - 1) * 480;
    const maxBoundY = (scale - 1) * 380;
    const clampedX = Math.max(-maxBoundX, Math.min(maxBoundX, newX));
    const clampedY = Math.max(-maxBoundY, Math.min(maxBoundY, newY));

    setTranslate({ x: clampedX, y: clampedY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isPanning) {
      setIsPanning(false);
      try {
        (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      } catch {
        // ignore
      }
    }
  };

  // Мультитач для pinch-to-zoom
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchDistRef.current = dist;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchDistRef.current !== null) {
      const newDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const diff = newDist - touchDistRef.current;
      if (Math.abs(diff) > 2) {
        if (diff < 0) {
          onClearSelectedPoi();
        }
        const factor = diff > 0 ? 0.03 : -0.03;
        setScale(prev => {
          const next = Math.min(MAX_SCALE, Math.max(BASE_SCALE, prev + factor));
          if (next <= BASE_SCALE) {
            setTranslate({ x: 0, y: 0 });
            onZoneChange(null);
          }
          return next;
        });
        touchDistRef.current = newDist;
      }
    }
  };

  const handleTouchEnd = () => {
    touchDistRef.current = null;
  };

  // Автоматический зум к зоне при выборе POI из поиска
  useEffect(() => {
    if (!selectedPoi) return;
    const parentZone = zones.find(z => z.poiIds.includes(selectedPoi.id));
    if (parentZone && parentZone.id !== activeZoneId) {
      handleZoomToZone(parentZone);
    }
  }, [selectedPoi?.id, zones]);

  // Иконки категорий (соответствуют верхней панели)
  const getCategoryDetails = (category: string) => {
    switch (category) {
      case 'sponsor':
        return { bg: '#E30613', border: '#f87171', icon: Award, label: 'Стенд ТТК' };
      case 'hall':
        return { bg: '#6366f1', border: '#a5b4fc', icon: Presentation, label: 'Конференц-зал' };
      case 'food':
        return { bg: '#f59e0b', border: '#fde68a', icon: Coffee, label: 'Кофе-брейк' };
      case 'wc':
        return { bg: '#06b6d4', border: '#67e8f9', icon: Bath, label: 'Санузел WC' };
      case 'wifi':
        return { bg: '#3b82f6', border: '#93c5fd', icon: Wifi, label: 'Wi-Fi 6 ТТК' };
      case 'entrance':
      case 'service':
      default:
        return { bg: '#10b981', border: '#6ee7b7', icon: DoorOpen, label: 'Сервис & Вход' };
    }
  };

  // Активная зона
  const currentActiveZone = zones.find(z => z.id === activeZoneId);

  // Значки эмблем POI появляются ТОЛЬКО внутри выбранного зала (или при активном маршруте)
  const visiblePois = useMemo(() => {
    if (activeRoute) return pois;
    if (!currentActiveZone) return [];
    return pois.filter(p => currentActiveZone.poiIds.includes(p.id));
  }, [currentActiveZone, pois, activeRoute]);

  // Значки эмблем 360° панорам появляются ТОЛЬКО внутри выбранного зала
  const visiblePanos = useMemo(() => {
    if (activeRoute) return floor.panoramas;
    if (!currentActiveZone) return [];
    return floor.panoramas.filter(p => currentActiveZone.panoIds.includes(p.id));
  }, [currentActiveZone, floor.panoramas, activeRoute]);

  const routePoints = activeRoute?.legs?.[0]?.points || [];

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={`relative flex-1 w-full h-full bg-slate-950 overflow-hidden select-none ${
        scale > BASE_SCALE ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
      }`}
    >
      {/* Сетка фона */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.8) 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Кнопка быстрого возврата ко всей карте */}
      {activeZoneId && (
        <button
          onClick={handleResetView}
          className="absolute top-4 left-3 z-10 flex items-center gap-2 bg-slate-900/95 hover:bg-slate-800 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl border border-slate-700/80 shadow-2xl backdrop-blur-md active:scale-95 transition-all animate-in fade-in"
        >
          <ArrowLeft className="w-4 h-4 text-[#E30613]" />
          <span>Вся карта</span>
        </button>
      )}

      {/* Кнопки управления зумом */}
      <div className="absolute top-4 right-3 z-10 flex flex-col items-center gap-1.5 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-2xl border border-slate-700/60 shadow-xl">
        <button
          onClick={() => handleZoom(0.25)}
          className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors active:scale-90"
          title="Приблизить"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <span className="text-[10px] font-bold text-slate-300 py-0.5 select-none">
          {Math.round((scale / BASE_SCALE) * 100)}%
        </span>
        <button
          onClick={() => handleZoom(-0.25)}
          disabled={scale <= BASE_SCALE}
          className={`p-2 rounded-xl transition-colors active:scale-90 ${
            scale <= BASE_SCALE
              ? 'text-slate-600 cursor-not-allowed opacity-40'
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
          title="Отдалить"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <div className="w-full h-px bg-slate-800 my-0.5" />
        <button
          onClick={handleResetView}
          className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors active:scale-90"
          title="Сбросить к общему плану"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* SVG Холст карты — масштабируется с отступами от краев */}
      <div
        className="w-full h-full flex items-center justify-center transition-transform duration-300 ease-out p-3 sm:p-5"
        style={{
          transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
          transformOrigin: 'center center',
        }}
      >
        <svg
          viewBox="0 0 1200 800"
          className="w-full h-full max-w-[1200px] max-h-[800px] object-contain drop-shadow-2xl"
        >
          <defs>
            <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <filter id="dropShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="6" stdDeviation="6" floodOpacity="0.5" floodColor="#000" />
            </filter>

            <pattern id="floorTile" width="30" height="30" patternUnits="userSpaceOnUse">
              <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#334155" strokeWidth="0.5" strokeOpacity="0.35" />
            </pattern>
          </defs>

          {/* ================= 1 ЭТАЖ ================= */}
          {floor.level === 1 && (
            <g id="floor-1-geometry">
              {/* Растянутый внешний контур здания (ровно по сетке) */}
              <rect
                x="20"
                y="20"
                width="1160"
                height="760"
                rx="20"
                fill="#0f172a"
                stroke="#334155"
                strokeWidth="4"
              />

              {/* Коридорная сетка */}
              {/* Центральная вертикальная аллея */}
              <rect x="460" y="50" width="280" height="700" fill="url(#floorTile)" opacity="0.8" />
              {/* Горизонтальный соединительный коридор */}
              <rect x="150" y="220" width="900" height="110" fill="url(#floorTile)" opacity="0.8" />

              {/* 1. Прямоугольник: Зал «Сириус» (Слева) */}
              <g
                className="cursor-pointer transition-all"
                onClick={() => {
                  const z = zones.find(z => z.id === 'zone-sirius');
                  if (z) handleZoomToZone(z);
                }}
                onPointerEnter={() => setHoveredZoneId('zone-sirius')}
                onPointerLeave={() => setHoveredZoneId(null)}
              >
                <rect
                  x="50"
                  y="50"
                  width="380"
                  height="430"
                  rx="18"
                  fill="#1e1b4b"
                  fillOpacity={activeZoneId === 'zone-sirius' ? 0.75 : hoveredZoneId === 'zone-sirius' ? 0.6 : 0.45}
                  stroke={activeZoneId === 'zone-sirius' ? '#818cf8' : hoveredZoneId === 'zone-sirius' ? '#a5b4fc' : '#4f46e5'}
                  strokeWidth={activeZoneId === 'zone-sirius' || hoveredZoneId === 'zone-sirius' ? 3.5 : 2}
                  strokeDasharray="6 3"
                  className="transition-all duration-200"
                />
                {/* Верхняя плашка сцены */}
                <rect x="70" y="70" width="340" height="45" rx="8" fill="#312e81" fillOpacity="0.6" />
                <text x="240" y="98" textAnchor="middle" fill="#c7d2fe" fontSize="14" fontWeight="bold">
                  СЦЕНА И ЭКРАН
                </text>
                <text
                  x="240"
                  y="190"
                  textAnchor="middle"
                  fill={activeZoneId === 'zone-sirius' || hoveredZoneId === 'zone-sirius' ? '#ffffff' : '#c7d2fe'}
                  fontSize="22"
                  fontWeight="800"
                  className="pointer-events-none"
                >
                  Конференц-зал «Сириус»
                </text>
              </g>

              {/* 2. Прямоугольник: Кофе-брейк & Lounge (Справа, симметрично) */}
              <g
                className="cursor-pointer transition-all"
                onClick={() => {
                  const z = zones.find(z => z.id === 'zone-food');
                  if (z) handleZoomToZone(z);
                }}
                onPointerEnter={() => setHoveredZoneId('zone-food')}
                onPointerLeave={() => setHoveredZoneId(null)}
              >
                <rect
                  x="770"
                  y="50"
                  width="380"
                  height="430"
                  rx="18"
                  fill="#451a03"
                  fillOpacity={activeZoneId === 'zone-food' ? 0.75 : hoveredZoneId === 'zone-food' ? 0.6 : 0.45}
                  stroke={activeZoneId === 'zone-food' ? '#fbbf24' : hoveredZoneId === 'zone-food' ? '#fde68a' : '#d97706'}
                  strokeWidth={activeZoneId === 'zone-food' || hoveredZoneId === 'zone-food' ? 3.5 : 2}
                  strokeDasharray="6 3"
                  className="transition-all duration-200"
                />
                <rect x="790" y="70" width="340" height="45" rx="8" fill="#78350f" fillOpacity="0.6" />
                <text x="960" y="98" textAnchor="middle" fill="#fde68a" fontSize="14" fontWeight="bold">
                  ЗОНА ОТДЫХА И КОФЕ
                </text>
                <text
                  x="960"
                  y="190"
                  textAnchor="middle"
                  fill={activeZoneId === 'zone-food' || hoveredZoneId === 'zone-food' ? '#ffffff' : '#fde68a'}
                  fontSize="22"
                  fontWeight="800"
                  className="pointer-events-none"
                >
                  Кофе-брейк & Lounge
                </text>
              </g>

              {/* 3. Центр: Центральный стенд ТТК (Идеально отцентрован на X=600, Y=360) */}
              <g
                className="cursor-pointer transition-all"
                onClick={() => {
                  const z = zones.find(z => z.id === 'zone-ttk');
                  if (z) handleZoomToZone(z);
                }}
                onPointerEnter={() => setHoveredZoneId('zone-ttk')}
                onPointerLeave={() => setHoveredZoneId(null)}
              >
                <circle
                  cx="600"
                  cy="360"
                  r="115"
                  fill="#1e293b"
                  fillOpacity={activeZoneId === 'zone-ttk' ? 0.9 : 0.75}
                  stroke="#E30613"
                  strokeWidth={activeZoneId === 'zone-ttk' || hoveredZoneId === 'zone-ttk' ? 4 : 2.5}
                  strokeDasharray="8 4"
                  className="transition-all duration-200"
                />
                {/* Выровненный логотип ТТК по центру (сдвинут выше, чтобы не перекрывать эмблемы) */}
                <rect x="505" y="315" width="190" height="44" rx="10" fill="#E30613" filter="url(#dropShadow)" />
                <text
                  x="600"
                  y="343"
                  textAnchor="middle"
                  fill="white"
                  fontSize="16"
                  fontWeight="900"
                  letterSpacing="2"
                  className="pointer-events-none"
                >
                  ТТК ЭКСПО
                </text>
              </g>

              {/* 4. Центр: Зона Wi-Fi 6 ТТК (На центральной оси X=600, Y=540) */}
              <g
                className="cursor-pointer transition-all"
                onClick={() => {
                  const z = zones.find(z => z.id === 'zone-wifi-1');
                  if (z) handleZoomToZone(z);
                }}
                onPointerEnter={() => setHoveredZoneId('zone-wifi-1')}
                onPointerLeave={() => setHoveredZoneId(null)}
              >
                <circle
                  cx="600"
                  cy="540"
                  r="45"
                  fill="#0369a1"
                  fillOpacity={activeZoneId === 'zone-wifi-1' ? 0.45 : 0.2}
                  stroke="#38bdf8"
                  strokeWidth={activeZoneId === 'zone-wifi-1' || hoveredZoneId === 'zone-wifi-1' ? 3 : 1.5}
                  strokeDasharray="4 4"
                />
                <text x="600" y="520" textAnchor="middle" fill="#38bdf8" fontSize="11" fontWeight="bold">
                  Wi-Fi 6 ТТК
                </text>
              </g>

              {/* 5. Внизу: Входная группа & Регистрация (Отцентрована на X=600) */}
              <g
                className="cursor-pointer transition-all"
                onClick={() => {
                  const z = zones.find(z => z.id === 'zone-entrance');
                  if (z) handleZoomToZone(z);
                }}
                onPointerEnter={() => setHoveredZoneId('zone-entrance')}
                onPointerLeave={() => setHoveredZoneId(null)}
              >
                <rect
                  x="430"
                  y="650"
                  width="340"
                  height="95"
                  rx="14"
                  fill="#064e3b"
                  fillOpacity={activeZoneId === 'zone-entrance' ? 0.75 : hoveredZoneId === 'zone-entrance' ? 0.6 : 0.45}
                  stroke="#10b981"
                  strokeWidth={activeZoneId === 'zone-entrance' || hoveredZoneId === 'zone-entrance' ? 3.5 : 2}
                  className="transition-all duration-200"
                />
                <text x="600" y="675" textAnchor="middle" fill="#6ee7b7" fontSize="14" fontWeight="bold">
                  ВХОДНАЯ ГРУППА & РЕГИСТРАЦИЯ
                </text>
              </g>

              {/* 6. Внизу слева: Лестница на 2 этаж (Симметрично) */}
              <g
                className="cursor-pointer transition-all"
                onClick={() => {
                  const z = zones.find(z => z.id === 'zone-stairs-1');
                  if (z) handleZoomToZone(z);
                }}
                onPointerEnter={() => setHoveredZoneId('zone-stairs-1')}
                onPointerLeave={() => setHoveredZoneId(null)}
              >
                <rect
                  x="60"
                  y="600"
                  width="340"
                  height="145"
                  rx="14"
                  fill="#1e293b"
                  stroke="#64748b"
                  strokeWidth={activeZoneId === 'zone-stairs-1' || hoveredZoneId === 'zone-stairs-1' ? 3 : 2}
                />
                <line x1="100" y1="655" x2="360" y2="655" stroke="#94a3b8" strokeWidth="2" />
                <line x1="100" y1="680" x2="360" y2="680" stroke="#94a3b8" strokeWidth="2" />
                <line x1="100" y1="705" x2="360" y2="705" stroke="#94a3b8" strokeWidth="2" />
                <text x="230" y="628" textAnchor="middle" fill="#94a3b8" fontSize="13" fontWeight="bold">
                  Лестница на 2 этаж ▲
                </text>
              </g>

              {/* 7. Внизу справа: Санузлы WC (Симметрично) */}
              <g
                className="cursor-pointer transition-all"
                onClick={() => {
                  const z = zones.find(z => z.id === 'zone-wc-1');
                  if (z) handleZoomToZone(z);
                }}
                onPointerEnter={() => setHoveredZoneId('zone-wc-1')}
                onPointerLeave={() => setHoveredZoneId(null)}
              >
                <rect
                  x="800"
                  y="600"
                  width="340"
                  height="145"
                  rx="14"
                  fill="#083344"
                  fillOpacity={activeZoneId === 'zone-wc-1' ? 0.8 : hoveredZoneId === 'zone-wc-1' ? 0.65 : 0.5}
                  stroke="#0891b2"
                  strokeWidth={activeZoneId === 'zone-wc-1' || hoveredZoneId === 'zone-wc-1' ? 3 : 2}
                />
                <text x="970" y="635" textAnchor="middle" fill="#67e8f9" fontSize="15" fontWeight="bold">
                  Санузлы WC (М / Ж / МГН)
                </text>
              </g>
            </g>
          )}

          {/* ================= 2 ЭТАЖ ================= */}
          {floor.level === 2 && (
            <g id="floor-2-geometry">
              <rect
                x="20"
                y="20"
                width="1160"
                height="760"
                rx="20"
                fill="#0f172a"
                stroke="#334155"
                strokeWidth="4"
              />
              <rect x="150" y="500" width="900" height="150" fill="url(#floorTile)" opacity="0.8" />

              {/* VIP Lounge */}
              <g
                className="cursor-pointer"
                onClick={() => {
                  const z = zones.find(z => z.id === 'zone-vip');
                  if (z) handleZoomToZone(z);
                }}
                onPointerEnter={() => setHoveredZoneId('zone-vip')}
                onPointerLeave={() => setHoveredZoneId(null)}
              >
                <rect
                  x="430"
                  y="90"
                  width="340"
                  height="420"
                  rx="18"
                  fill="#4c0519"
                  fillOpacity={activeZoneId === 'zone-vip' ? 0.75 : hoveredZoneId === 'zone-vip' ? 0.6 : 0.45}
                  stroke="#e11d48"
                  strokeWidth={activeZoneId === 'zone-vip' || hoveredZoneId === 'zone-vip' ? 3.5 : 2}
                />
                <text x="600" y="210" textAnchor="middle" fill="#fda4af" fontSize="22" fontWeight="bold">
                  VIP Lounge ТТК
                </text>
              </g>

              {/* Переговорная «Байкал» */}
              <g
                className="cursor-pointer"
                onClick={() => {
                  const z = zones.find(z => z.id === 'zone-room-a');
                  if (z) handleZoomToZone(z);
                }}
                onPointerEnter={() => setHoveredZoneId('zone-room-a')}
                onPointerLeave={() => setHoveredZoneId(null)}
              >
                <rect
                  x="60"
                  y="110"
                  width="340"
                  height="400"
                  rx="18"
                  fill="#1e293b"
                  stroke="#6366f1"
                  strokeWidth={activeZoneId === 'zone-room-a' || hoveredZoneId === 'zone-room-a' ? 3 : 2}
                />
                <text x="230" y="210" textAnchor="middle" fill="#e2e8f0" fontSize="20" fontWeight="bold">
                  Переговорная «Байкал»
                </text>
              </g>

              {/* Переговорная «Енисей» */}
              <g
                className="cursor-pointer"
                onClick={() => {
                  const z = zones.find(z => z.id === 'zone-room-b');
                  if (z) handleZoomToZone(z);
                }}
                onPointerEnter={() => setHoveredZoneId('zone-room-b')}
                onPointerLeave={() => setHoveredZoneId(null)}
              >
                <rect
                  x="800"
                  y="110"
                  width="340"
                  height="400"
                  rx="18"
                  fill="#1e293b"
                  stroke="#6366f1"
                  strokeWidth={activeZoneId === 'zone-room-b' || hoveredZoneId === 'zone-room-b' ? 3 : 2}
                />
                <text x="970" y="210" textAnchor="middle" fill="#e2e8f0" fontSize="20" fontWeight="bold">
                  Переговорная «Енисей»
                </text>
              </g>

              {/* Спуск на 1 этаж */}
              <g
                className="cursor-pointer"
                onClick={() => {
                  const z = zones.find(z => z.id === 'zone-stairs-2');
                  if (z) handleZoomToZone(z);
                }}
                onPointerEnter={() => setHoveredZoneId('zone-stairs-2')}
                onPointerLeave={() => setHoveredZoneId(null)}
              >
                <rect
                  x="60"
                  y="600"
                  width="340"
                  height="145"
                  rx="14"
                  fill="#1e293b"
                  stroke="#64748b"
                  strokeWidth={activeZoneId === 'zone-stairs-2' || hoveredZoneId === 'zone-stairs-2' ? 3 : 2}
                />
                <line x1="100" y1="655" x2="360" y2="655" stroke="#94a3b8" strokeWidth="2" />
                <line x1="100" y1="680" x2="360" y2="680" stroke="#94a3b8" strokeWidth="2" />
                <line x1="100" y1="705" x2="360" y2="705" stroke="#94a3b8" strokeWidth="2" />
                <text x="230" y="628" textAnchor="middle" fill="#94a3b8" fontSize="13" fontWeight="bold">
                  Спуск на 1 этаж ▼
                </text>
              </g>
            </g>
          )}

          {/* ================= ЛИНИЯ МАРШРУТА ================= */}
          {routePoints.length > 1 && (
            <g id="navigation-path" className="pointer-events-none">
              <polyline
                points={routePoints.map(p => p.join(',')).join(' ')}
                fill="none"
                stroke="#38bdf8"
                strokeWidth="12"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.3"
                filter="url(#neonGlow)"
              />
              <polyline
                points={routePoints.map(p => p.join(',')).join(' ')}
                fill="none"
                stroke="#38bdf8"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="10 8"
                className="animate-pulse"
              />
              <g transform={`translate(${routePoints[0][0]}, ${routePoints[0][1]})`}>
                <circle cx="0" cy="0" r="10" fill="#10b981" stroke="white" strokeWidth="2.5" />
              </g>
              <g transform={`translate(${routePoints[routePoints.length - 1][0]}, ${routePoints[routePoints.length - 1][1]})`}>
                <circle cx="0" cy="0" r="12" fill="#E30613" stroke="white" strokeWidth="2.5" />
              </g>
            </g>
          )}

          {/* ================= ЭМБЛЕМЫ 360° ПАНОРАМ (ПОЯВЛЯЮТСЯ ВНУТРИ ВЫБРАННОЙ ЗОНЫ) ================= */}
          {visiblePanos.map(pano => {
            const isHovered = hoveredItemId === pano.id;

            return (
              <g
                key={pano.id}
                transform={`translate(${pano.x}, ${pano.y})`}
                onClick={e => {
                  e.stopPropagation();
                  onOpenPanorama(pano.id);
                }}
                onPointerEnter={() => setHoveredItemId(pano.id)}
                onPointerLeave={() => setHoveredItemId(null)}
                className="interactive-pin cursor-pointer transition-all duration-200"
                style={{
                  transform: `translate(${pano.x}px, ${pano.y}px) ${isHovered ? 'scale(1.4)' : 'scale(1)'}`,
                }}
              >
                {/* Идеально выровненная эмблема 360 */}
                <circle
                  cx="0"
                  cy="0"
                  r="16"
                  fill="#0284c7"
                  stroke="white"
                  strokeWidth="2.5"
                  className="shadow-xl"
                />
                <g transform="translate(-9, -9)" pointerEvents="none">
                  <Camera size={18} color="white" strokeWidth={2.2} />
                </g>

                {/* Всплывающий текст СНИЗУ («снизу появляется текст что это да кто это») */}
                {isHovered && (
                  <g transform="translate(0, 24)" className="pointer-events-none animate-in fade-in duration-150">
                    <rect
                      x="-85"
                      y="0"
                      width="170"
                      height="28"
                      rx="8"
                      fill="#0f172a"
                      stroke="#38bdf8"
                      strokeWidth="1.5"
                      className="shadow-2xl"
                    />
                    <text x="0" y="14" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="bold">
                      {pano.title || '360° Виртуальный тур'}
                    </text>
                    <text x="0" y="23" textAnchor="middle" fill="#38bdf8" fontSize="8" fontWeight="600">
                      Нажмите для просмотра сферы
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* ================= ЭМБЛЕМЫ POI (ПОЯВЛЯЮТСЯ ВНУТРИ ВЫБРАННОЙ ЗОНЫ) ================= */}
          {visiblePois.map(poi => {
            const isSelected = selectedPoi?.id === poi.id;
            const isHovered = hoveredItemId === poi.id;
            const showTooltip = isHovered || isSelected;
            const details = getCategoryDetails(poi.category);
            const Icon = details.icon;

            return (
              <g
                key={poi.id}
                transform={`translate(${poi.x}, ${poi.y})`}
                onClick={e => {
                  e.stopPropagation();
                  onSelectPoi(poi);
                }}
                onPointerEnter={() => setHoveredItemId(poi.id)}
                onPointerLeave={() => setHoveredItemId(null)}
                className="interactive-pin cursor-pointer transition-all duration-200"
                style={{
                  transform: `translate(${poi.x}px, ${poi.y}px) ${
                    isSelected || isHovered ? 'scale(1.4)' : 'scale(1)'
                  }`,
                }}
              >
                {/* Пульсирующий круг при выборе */}
                {isSelected && (
                  <circle
                    cx="0"
                    cy="0"
                    r="22"
                    fill={details.bg}
                    fillOpacity="0.35"
                    className="animate-ping"
                  />
                )}

                {/* Идеально выровненная эмблема категории */}
                <circle
                  cx="0"
                  cy="0"
                  r="16"
                  fill={details.bg}
                  stroke="white"
                  strokeWidth="2.5"
                  className="shadow-lg"
                />
                <g transform="translate(-9, -9)" pointerEvents="none">
                  <Icon size={18} color="white" strokeWidth={2.2} />
                </g>

                {/* Всплывающий текст СНИЗУ («снизу появляется текст что это да кто это») */}
                {showTooltip && (
                  <g transform="translate(0, 24)" className="pointer-events-none animate-in fade-in duration-150">
                    <rect
                      x={-((poi.name.length * 7.5) / 2 + 12)}
                      y="0"
                      width={poi.name.length * 7.5 + 24}
                      height="32"
                      rx="8"
                      fill="#0f172a"
                      stroke={isSelected ? '#E30613' : details.border}
                      strokeWidth="1.5"
                      className="shadow-2xl"
                    />
                    <text
                      x="0"
                      y="14"
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize="10"
                      fontWeight="bold"
                    >
                      {poi.name}
                    </text>
                    <text
                      x="0"
                      y="25"
                      textAnchor="middle"
                      fill="#94a3b8"
                      fontSize="8"
                      fontWeight="600"
                    >
                      {details.label} • Нажмите для карточки
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
