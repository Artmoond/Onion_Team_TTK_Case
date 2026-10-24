import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Floor, POI, RouteResponse, Panorama } from '../types';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Camera,
  Navigation,
  Award,
  Presentation,
  Coffee,
  Bath,
  Wifi,
  DoorOpen,
  ArrowLeft,
  Sparkles
} from 'lucide-react';

interface InteractiveMapProps {
  floor: Floor;
  pois: POI[];
  selectedPoi: POI | null;
  onSelectPoi: (poi: POI) => void;
  activeRoute: RouteResponse | null;
  onOpenPanorama: (panoId: string) => void;
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
  activeRoute,
  onOpenPanorama,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Базовый масштаб по умолчанию: 1.25 (отображается как 100%)
  const BASE_SCALE = 1.25;
  const MAX_SCALE = 3.5;

  // Состояние трансформации (масштаб и смещение)
  const [scale, setScale] = useState<number>(BASE_SCALE);
  const [translate, setTranslate] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const translateStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Активная приближенная зона (зал/прямоугольник)
  const [activeZoneId, setActiveZoneId] = useState<string | null>(null);
  const [hoveredZoneId, setHoveredZoneId] = useState<string | null>(null);
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);

  // Мультитач для pinch-to-zoom
  const touchDistRef = useRef<number | null>(null);

  // Конфигурация кликабельных зон/прямоугольников для этажей
  const zones: MapZone[] = useMemo(() => {
    if (floor.level === 1) {
      return [
        {
          id: 'zone-sirius',
          name: 'Конференц-зал «Сириус»',
          floorLevel: 1,
          shape: 'rect',
          x: 100,
          y: 100,
          width: 340,
          height: 400,
          centerX: 270,
          centerY: 300,
          zoomScale: 2.1,
          poiIds: ['poi-main-hall'],
          panoIds: ['pano-hall'],
          color: '#6366f1',
        },
        {
          id: 'zone-food',
          name: 'Кофе-брейк & Lounge',
          floorLevel: 1,
          shape: 'rect',
          x: 780,
          y: 100,
          width: 320,
          height: 400,
          centerX: 940,
          centerY: 300,
          zoomScale: 2.1,
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
          cy: 400,
          r: 105,
          centerX: 600,
          centerY: 400,
          zoomScale: 2.3,
          poiIds: ['poi-ttk-stand'],
          panoIds: ['pano-ttk'],
          color: '#E30613',
        },
        {
          id: 'zone-entrance',
          name: 'Входная группа & Регистрация',
          floorLevel: 1,
          shape: 'rect',
          x: 420,
          y: 670,
          width: 360,
          height: 80,
          centerX: 600,
          centerY: 710,
          zoomScale: 2.2,
          poiIds: ['poi-entrance'],
          panoIds: ['pano-entrance'],
          color: '#10b981',
        },
        {
          id: 'zone-stairs-1',
          name: 'Лестница на 2 этаж',
          floorLevel: 1,
          shape: 'rect',
          x: 180,
          y: 600,
          width: 220,
          height: 90,
          centerX: 290,
          centerY: 645,
          zoomScale: 2.4,
          poiIds: ['poi-stairs-1'],
          panoIds: [],
          color: '#64748b',
        },
        {
          id: 'zone-wc-1',
          name: 'Санузлы WC',
          floorLevel: 1,
          shape: 'rect',
          x: 940,
          y: 640,
          width: 160,
          height: 90,
          centerX: 1020,
          centerY: 685,
          zoomScale: 2.5,
          poiIds: ['poi-wc-1'],
          panoIds: [],
          color: '#06b6d4',
        },
        {
          id: 'zone-wifi-1',
          name: 'Зона Wi-Fi 6 ТТК',
          floorLevel: 1,
          shape: 'circle',
          cx: 600,
          cy: 570,
          r: 45,
          centerX: 600,
          centerY: 570,
          zoomScale: 2.6,
          poiIds: ['poi-wifi-1'],
          panoIds: [],
          color: '#3b82f6',
        },
      ];
    } else {
      return [
        {
          id: 'zone-vip',
          name: 'VIP Lounge ТТК',
          floorLevel: 2,
          shape: 'rect',
          x: 420,
          y: 140,
          width: 360,
          height: 340,
          centerX: 600,
          centerY: 310,
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
          x: 120,
          y: 180,
          width: 260,
          height: 280,
          centerX: 250,
          centerY: 320,
          zoomScale: 2.3,
          poiIds: ['poi-room-a'],
          panoIds: [],
          color: '#6366f1',
        },
        {
          id: 'zone-room-b',
          name: 'Переговорная «Енисей»',
          floorLevel: 2,
          shape: 'rect',
          x: 820,
          y: 180,
          width: 260,
          height: 280,
          centerX: 950,
          centerY: 320,
          zoomScale: 2.3,
          poiIds: ['poi-room-b'],
          panoIds: [],
          color: '#6366f1',
        },
        {
          id: 'zone-stairs-2',
          name: 'Спуск на 1 этаж',
          floorLevel: 2,
          shape: 'rect',
          x: 180,
          y: 600,
          width: 220,
          height: 90,
          centerX: 290,
          centerY: 645,
          zoomScale: 2.4,
          poiIds: ['poi-stairs-2'],
          panoIds: [],
          color: '#64748b',
        },
      ];
    }
  }, [floor.level]);

  // Сброс масштаба в центр (возврат к 100% и общему виду)
  const handleResetView = useCallback(() => {
    setScale(BASE_SCALE);
    setTranslate({ x: 0, y: 0 });
    setActiveZoneId(null);
  }, []);

  // Зум к конкретной зоне/прямоугольнику
  const handleZoomToZone = (zone: MapZone) => {
    setActiveZoneId(zone.id);
    const targetScale = zone.zoomScale;
    // Смещение центра зоны к центру экрана (600, 400)
    const offsetX = (600 - zone.centerX) * (targetScale * 0.85);
    const offsetY = (400 - zone.centerY) * (targetScale * 0.85);
    setScale(targetScale);
    setTranslate({ x: offsetX, y: offsetY });
  };

  // Зум кнопками
  const handleZoom = (delta: number) => {
    setScale(prev => {
      const next = Math.min(MAX_SCALE, Math.max(BASE_SCALE, Number((prev + delta).toFixed(2))));
      if (next <= BASE_SCALE) {
        setActiveZoneId(null);
      }
      return next;
    });
  };

  // Колесо мыши
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 0.15 : -0.15;
    handleZoom(zoomFactor);
  };

  // Перетаскивание карты
  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('.interactive-pin')) return;

    setIsPanning(true);
    panStartRef.current = { x: e.clientX, y: e.clientY };
    translateStartRef.current = { ...translate };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isPanning) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    setTranslate({
      x: translateStartRef.current.x + dx,
      y: translateStartRef.current.y + dy,
    });
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

  // Мобильный тач pinch-to-zoom
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
        const factor = diff > 0 ? 0.03 : -0.03;
        setScale(prev => Math.min(MAX_SCALE, Math.max(BASE_SCALE, prev + factor)));
        touchDistRef.current = newDist;
      }
    }
  };

  const handleTouchEnd = () => {
    touchDistRef.current = null;
  };

  // Автоматический зум к зоне при выборе POI (например из поиска)
  useEffect(() => {
    if (!selectedPoi) return;
    const parentZone = zones.find(z => z.poiIds.includes(selectedPoi.id));
    if (parentZone) {
      handleZoomToZone(parentZone);
    }
  }, [selectedPoi?.id, zones]);

  // Стили и иконки для категорий
  const getCategoryStyles = (category: string) => {
    switch (category) {
      case 'sponsor':
        return { bg: '#E30613', icon: Award, label: 'Стенд ТТК' };
      case 'hall':
        return { bg: '#6366f1', icon: Presentation, label: 'Зал' };
      case 'food':
        return { bg: '#f59e0b', icon: Coffee, label: 'Кофе' };
      case 'wc':
        return { bg: '#06b6d4', icon: Bath, label: 'Санузел' };
      case 'wifi':
        return { bg: '#3b82f6', icon: Wifi, label: 'Wi-Fi 6' };
      case 'entrance':
      case 'service':
      default:
        return { bg: '#10b981', icon: DoorOpen, label: 'Сервис' };
    }
  };

  // Активная зона и ее содержимое
  const currentActiveZone = zones.find(z => z.id === activeZoneId);

  // Значки POI отображаются ТОЛЬКО если активна их зона (или если строится активный маршрут)
  const visiblePois = useMemo(() => {
    if (activeRoute) return pois;
    if (!currentActiveZone) return [];
    return pois.filter(p => currentActiveZone.poiIds.includes(p.id));
  }, [currentActiveZone, pois, activeRoute]);

  // Значки 360 панорам отображаются ТОЛЬКО если активна их зона
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
      className="relative flex-1 w-full h-full bg-slate-950 overflow-hidden cursor-grab active:cursor-grabbing select-none"
    >
      {/* Сетка фона */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.8) 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Кнопка быстрого возврата ко всей карте (когда мы внутри зоны) */}
      {activeZoneId && (
        <button
          onClick={handleResetView}
          className="absolute top-4 left-3 z-30 flex items-center gap-2 bg-slate-900/95 hover:bg-slate-800 text-white text-xs font-bold px-3.5 py-2 rounded-xl border border-slate-700/80 shadow-2xl backdrop-blur-md active:scale-95 transition-all animate-in fade-in"
        >
          <ArrowLeft className="w-4 h-4 text-[#E30613]" />
          <span>Вся карта (100%)</span>
        </button>
      )}

      {/* Кнопки управления зумом (Плавающие справа) */}
      <div className="absolute top-4 right-3 z-20 flex flex-col items-center gap-1.5 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-2xl border border-slate-700/60 shadow-xl">
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
          title="Сбросить к общему плану (100%)"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Холст карты с плавным зумом */}
      <div
        className="w-full h-full flex items-center justify-center transition-transform duration-300 ease-out"
        style={{
          transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
          transformOrigin: 'center center',
        }}
      >
        <svg
          viewBox="0 0 1200 800"
          className="w-full h-full max-w-[1200px] max-h-[800px] overflow-visible drop-shadow-2xl"
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

            <filter id="boxShadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="4" stdDeviation="6" floodOpacity="0.4" floodColor="#000" />
            </filter>

            <pattern id="floorTile" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#334155" strokeWidth="0.5" strokeOpacity="0.4" />
            </pattern>
          </defs>

          {/* ================= 1 ЭТАЖ ================= */}
          {floor.level === 1 && (
            <g id="floor-1-geometry">
              {/* Внешний контур здания */}
              <rect
                x="60"
                y="60"
                width="1080"
                height="680"
                rx="24"
                fill="#0f172a"
                stroke="#334155"
                strokeWidth="4"
              />

              {/* Коридоры */}
              <rect x="480" y="160" width="240" height="580" fill="url(#floorTile)" opacity="0.8" />
              <rect x="180" y="240" width="840" height="120" fill="url(#floorTile)" opacity="0.8" />

              {/* 1. Кликабельный прямоугольник: Зал «Сириус» */}
              <g
                className="cursor-pointer group transition-all"
                onClick={() => {
                  const z = zones.find(z => z.id === 'zone-sirius');
                  if (z) handleZoomToZone(z);
                }}
                onPointerEnter={() => setHoveredZoneId('zone-sirius')}
                onPointerLeave={() => setHoveredZoneId(null)}
              >
                <rect
                  x="100"
                  y="100"
                  width="340"
                  height="400"
                  rx="16"
                  fill="#1e1b4b"
                  fillOpacity={activeZoneId === 'zone-sirius' ? 0.7 : hoveredZoneId === 'zone-sirius' ? 0.55 : 0.4}
                  stroke={activeZoneId === 'zone-sirius' ? '#818cf8' : hoveredZoneId === 'zone-sirius' ? '#a5b4fc' : '#4f46e5'}
                  strokeWidth={activeZoneId === 'zone-sirius' || hoveredZoneId === 'zone-sirius' ? 3.5 : 2}
                  strokeDasharray="6 3"
                  className="transition-all duration-200"
                />
                <text
                  x="270"
                  y="290"
                  textAnchor="middle"
                  fill={activeZoneId === 'zone-sirius' || hoveredZoneId === 'zone-sirius' ? '#ffffff' : '#c7d2fe'}
                  fontSize="22"
                  fontWeight="800"
                  className="transition-colors pointer-events-none"
                >
                  Конференц-зал «Сириус»
                </text>
              </g>

              {/* 2. Кликабельный прямоугольник: Кофе-брейк & Lounge */}
              <g
                className="cursor-pointer group transition-all"
                onClick={() => {
                  const z = zones.find(z => z.id === 'zone-food');
                  if (z) handleZoomToZone(z);
                }}
                onPointerEnter={() => setHoveredZoneId('zone-food')}
                onPointerLeave={() => setHoveredZoneId(null)}
              >
                <rect
                  x="780"
                  y="100"
                  width="320"
                  height="400"
                  rx="16"
                  fill="#451a03"
                  fillOpacity={activeZoneId === 'zone-food' ? 0.7 : hoveredZoneId === 'zone-food' ? 0.55 : 0.4}
                  stroke={activeZoneId === 'zone-food' ? '#fbbf24' : hoveredZoneId === 'zone-food' ? '#fde68a' : '#d97706'}
                  strokeWidth={activeZoneId === 'zone-food' || hoveredZoneId === 'zone-food' ? 3.5 : 2}
                  strokeDasharray="6 3"
                  className="transition-all duration-200"
                />
                <text
                  x="940"
                  y="290"
                  textAnchor="middle"
                  fill={activeZoneId === 'zone-food' || hoveredZoneId === 'zone-food' ? '#ffffff' : '#fde68a'}
                  fontSize="22"
                  fontWeight="800"
                  className="transition-colors pointer-events-none"
                >
                  Кофе-брейк & Lounge
                </text>
              </g>

              {/* 3. Кликабельный объект: Центральный стенд ТТК */}
              <g
                className="cursor-pointer group transition-all"
                onClick={() => {
                  const z = zones.find(z => z.id === 'zone-ttk');
                  if (z) handleZoomToZone(z);
                }}
                onPointerEnter={() => setHoveredZoneId('zone-ttk')}
                onPointerLeave={() => setHoveredZoneId(null)}
              >
                <circle
                  cx="600"
                  cy="400"
                  r="105"
                  fill="#1e293b"
                  fillOpacity={activeZoneId === 'zone-ttk' ? 0.9 : 0.7}
                  stroke="#E30613"
                  strokeWidth={activeZoneId === 'zone-ttk' || hoveredZoneId === 'zone-ttk' ? 4 : 2.5}
                  strokeDasharray="8 4"
                  className="transition-all duration-200"
                />
                <rect x="525" y="380" width="150" height="40" rx="8" fill="#E30613" />
                <text
                  x="600"
                  y="405"
                  textAnchor="middle"
                  fill="white"
                  fontSize="15"
                  fontWeight="900"
                  letterSpacing="2"
                  className="pointer-events-none"
                >
                  ТТК ЭКСПО
                </text>
              </g>

              {/* 4. Кликабельный объект: Зона Wi-Fi 6 */}
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
                  cy="570"
                  r="45"
                  fill="#0369a1"
                  fillOpacity={activeZoneId === 'zone-wifi-1' ? 0.4 : 0.15}
                  stroke="#38bdf8"
                  strokeWidth={activeZoneId === 'zone-wifi-1' || hoveredZoneId === 'zone-wifi-1' ? 3 : 1.5}
                  strokeDasharray="4 4"
                />
                <text x="600" y="575" textAnchor="middle" fill="#38bdf8" fontSize="11" fontWeight="bold">
                  Wi-Fi 6
                </text>
              </g>

              {/* 5. Кликабельный прямоугольник: Входная группа */}
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
                  x="420"
                  y="670"
                  width="360"
                  height="80"
                  rx="12"
                  fill="#064e3b"
                  fillOpacity={activeZoneId === 'zone-entrance' ? 0.7 : hoveredZoneId === 'zone-entrance' ? 0.55 : 0.4}
                  stroke="#10b981"
                  strokeWidth={activeZoneId === 'zone-entrance' || hoveredZoneId === 'zone-entrance' ? 3.5 : 2}
                  className="transition-all duration-200"
                />
                <text x="600" y="718" textAnchor="middle" fill="#6ee7b7" fontSize="17" fontWeight="bold">
                  ВХОДНАЯ ГРУППА & РЕГИСТРАЦИЯ
                </text>
              </g>

              {/* 6. Кликабельный прямоугольник: Лестница на 2 этаж */}
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
                  x="180"
                  y="600"
                  width="220"
                  height="90"
                  rx="10"
                  fill="#1e293b"
                  stroke="#64748b"
                  strokeWidth={activeZoneId === 'zone-stairs-1' || hoveredZoneId === 'zone-stairs-1' ? 3 : 2}
                />
                <line x1="210" y1="625" x2="370" y2="625" stroke="#94a3b8" strokeWidth="2" />
                <line x1="210" y1="645" x2="370" y2="645" stroke="#94a3b8" strokeWidth="2" />
                <line x1="210" y1="665" x2="370" y2="665" stroke="#94a3b8" strokeWidth="2" />
                <text x="290" y="614" textAnchor="middle" fill="#94a3b8" fontSize="12" fontWeight="bold">
                  Лестница на 2 этаж ▲
                </text>
              </g>

              {/* 7. Кликабельный прямоугольник: Санузлы WC */}
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
                  x="940"
                  y="640"
                  width="160"
                  height="90"
                  rx="10"
                  fill="#083344"
                  fillOpacity={activeZoneId === 'zone-wc-1' ? 0.8 : hoveredZoneId === 'zone-wc-1' ? 0.65 : 0.5}
                  stroke="#0891b2"
                  strokeWidth={activeZoneId === 'zone-wc-1' || hoveredZoneId === 'zone-wc-1' ? 3 : 2}
                />
                <text x="1020" y="692" textAnchor="middle" fill="#67e8f9" fontSize="14" fontWeight="bold">
                  Санузлы WC
                </text>
              </g>
            </g>
          )}

          {/* ================= 2 ЭТАЖ ================= */}
          {floor.level === 2 && (
            <g id="floor-2-geometry">
              <rect
                x="60"
                y="60"
                width="1080"
                height="680"
                rx="24"
                fill="#0f172a"
                stroke="#334155"
                strokeWidth="4"
              />
              <rect x="180" y="480" width="840" height="160" fill="url(#floorTile)" opacity="0.8" />

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
                  x="420"
                  y="140"
                  width="360"
                  height="340"
                  rx="16"
                  fill="#4c0519"
                  fillOpacity={activeZoneId === 'zone-vip' ? 0.7 : hoveredZoneId === 'zone-vip' ? 0.55 : 0.4}
                  stroke="#e11d48"
                  strokeWidth={activeZoneId === 'zone-vip' || hoveredZoneId === 'zone-vip' ? 3.5 : 2}
                />
                <text x="600" y="310" textAnchor="middle" fill="#fda4af" fontSize="22" fontWeight="bold">
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
                  x="120"
                  y="180"
                  width="260"
                  height="280"
                  rx="16"
                  fill="#1e293b"
                  stroke="#6366f1"
                  strokeWidth={activeZoneId === 'zone-room-a' || hoveredZoneId === 'zone-room-a' ? 3 : 2}
                />
                <text x="250" y="325" textAnchor="middle" fill="#e2e8f0" fontSize="18" fontWeight="bold">
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
                  x="820"
                  y="180"
                  width="260"
                  height="280"
                  rx="16"
                  fill="#1e293b"
                  stroke="#6366f1"
                  strokeWidth={activeZoneId === 'zone-room-b' || hoveredZoneId === 'zone-room-b' ? 3 : 2}
                />
                <text x="950" y="325" textAnchor="middle" fill="#e2e8f0" fontSize="18" fontWeight="bold">
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
                  x="180"
                  y="600"
                  width="220"
                  height="90"
                  rx="10"
                  fill="#1e293b"
                  stroke="#64748b"
                  strokeWidth={activeZoneId === 'zone-stairs-2' || hoveredZoneId === 'zone-stairs-2' ? 3 : 2}
                />
                <line x1="210" y1="625" x2="370" y2="625" stroke="#94a3b8" strokeWidth="2" />
                <line x1="210" y1="645" x2="370" y2="645" stroke="#94a3b8" strokeWidth="2" />
                <line x1="210" y1="665" x2="370" y2="665" stroke="#94a3b8" strokeWidth="2" />
                <text x="290" y="650" textAnchor="middle" fill="#94a3b8" fontSize="13" fontWeight="bold">
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

          {/* ================= МАЛЕНЬКИЕ ЗНАЧКИ 360° ПАНОРАМ (ПОЯВЛЯЮТСЯ ВНУТРИ ЗОНЫ) ================= */}
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
                {/* Компактный значок 360 */}
                <circle
                  cx="0"
                  cy="0"
                  r="13"
                  fill="#0284c7"
                  stroke="white"
                  strokeWidth="2"
                  className="shadow-xl"
                />
                <Camera className="w-3.5 h-3.5 text-white -translate-x-1.5 -translate-y-1.5 pointer-events-none" />

                {/* Всплывающий текст СНИЗУ при наведении */}
                {isHovered && (
                  <g transform="translate(0, 24)" className="pointer-events-none animate-in fade-in duration-150">
                    <rect
                      x="-85"
                      y="0"
                      width="170"
                      height="26"
                      rx="8"
                      fill="#0f172a"
                      stroke="#38bdf8"
                      strokeWidth="1.5"
                      className="shadow-2xl"
                    />
                    <text x="0" y="17" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="bold">
                      {pano.title || '360° Виртуальный тур'}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* ================= МАЛЕНЬКИЕ ЗНАЧКИ POI (ПОЯВЛЯЮТСЯ ВНУТРИ ЗОНЫ) ================= */}
          {visiblePois.map(poi => {
            const isSelected = selectedPoi?.id === poi.id;
            const isHovered = hoveredItemId === poi.id;
            const showTooltip = isHovered || isSelected;
            const style = getCategoryStyles(poi.category);

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
                    r="20"
                    fill={style.bg}
                    fillOpacity="0.3"
                    className="animate-ping"
                  />
                )}

                {/* Аккуратный маленький значок */}
                <circle
                  cx="0"
                  cy="0"
                  r="13"
                  fill={style.bg}
                  stroke="white"
                  strokeWidth="2"
                  className="shadow-lg"
                />
                <circle cx="0" cy="0" r="4" fill="white" />

                {/* Всплывающий текст СНИЗУ («снизу появляется текст что это да кто это») */}
                {showTooltip && (
                  <g transform="translate(0, 24)" className="pointer-events-none animate-in fade-in duration-150">
                    <rect
                      x={-((poi.name.length * 7.5) / 2 + 12)}
                      y="0"
                      width={poi.name.length * 7.5 + 24}
                      height="30"
                      rx="8"
                      fill="#0f172a"
                      stroke={isSelected ? '#E30613' : '#38bdf8'}
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
                      y="24"
                      textAnchor="middle"
                      fill="#94a3b8"
                      fontSize="8"
                      fontWeight="600"
                    >
                      {style.label}
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
