import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  HelpCircle,
  Footprints
} from 'lucide-react';

interface InteractiveMapProps {
  floor: Floor;
  pois: POI[];
  selectedPoi: POI | null;
  onSelectPoi: (poi: POI) => void;
  activeRoute: RouteResponse | null;
  onOpenPanorama: (panoId: string) => void;
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

  // Состояние трансформации (масштаб и смещение)
  const [scale, setScale] = useState<number>(1);
  const [translate, setTranslate] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const translateStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Мультитач для pinch-to-zoom
  const touchDistRef = useRef<number | null>(null);

  // Сброс масштаба в центр
  const handleResetView = useCallback(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, []);

  // Зум кнопками
  const handleZoom = (delta: number) => {
    setScale(prev => Math.min(3.5, Math.max(0.65, Number((prev + delta).toFixed(2)))));
  };

  // Колесо мыши (зум относительно центра)
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 0.15 : -0.15;
    handleZoom(zoomFactor);
  };

  // Мышь / Указатель - начало перетаскивания
  const handlePointerDown = (e: React.PointerEvent) => {
    // Игнорируем клики по интерактивным элементам карты
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
        // pointer already released
      }
    }
  };

  // Мобильные тач-события для плавного pinch-to-zoom
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
        setScale(prev => Math.min(3.5, Math.max(0.65, prev + factor)));
        touchDistRef.current = newDist;
      }
    }
  };

  const handleTouchEnd = () => {
    touchDistRef.current = null;
  };

  // Центрирование камеры на выбранном POI
  useEffect(() => {
    if (!selectedPoi) return;
    // Координаты центра карты: 600, 400
    // Вычисляем смещение так, чтобы POI оказался в центре
    const targetScale = Math.max(scale, 1.25);
    const offsetX = (600 - selectedPoi.x) * (targetScale / 1.5);
    const offsetY = (400 - selectedPoi.y) * (targetScale / 1.5);

    setScale(targetScale);
    setTranslate({ x: offsetX * 0.4, y: offsetY * 0.4 });
  }, [selectedPoi?.id]);

  // Цвета и иконки категорий для меток
  const getCategoryStyles = (category: string) => {
    switch (category) {
      case 'sponsor':
        return { bg: '#E30613', text: 'text-white', icon: Award, label: 'Стенд ТТК' };
      case 'hall':
        return { bg: '#6366f1', text: 'text-white', icon: Presentation, label: 'Зал' };
      case 'food':
        return { bg: '#f59e0b', text: 'text-white', icon: Coffee, label: 'Кофе' };
      case 'wc':
        return { bg: '#06b6d4', text: 'text-white', icon: Bath, label: 'Санузел' };
      case 'wifi':
        return { bg: '#3b82f6', text: 'text-white', icon: Wifi, label: 'Wi-Fi' };
      case 'entrance':
      case 'service':
      default:
        return { bg: '#10b981', text: 'text-white', icon: DoorOpen, label: 'Сервис' };
    }
  };

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

      {/* Кнопки управления зумом (Плавающие) */}
      <div className="absolute top-4 right-3 z-20 flex flex-col items-center gap-1.5 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-2xl border border-slate-700/60 shadow-xl">
        <button
          onClick={() => handleZoom(0.25)}
          className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors active:scale-90"
          title="Приблизить"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <span className="text-[10px] font-bold text-slate-400 py-0.5 select-none">
          {Math.round(scale * 100)}%
        </span>
        <button
          onClick={() => handleZoom(-0.25)}
          className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors active:scale-90"
          title="Отдалить"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <div className="w-full h-px bg-slate-800 my-0.5" />
        <button
          onClick={handleResetView}
          className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors active:scale-90"
          title="Сбросить вид"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Подсказка жестов снизу слева */}
      <div className="absolute top-4 left-3 z-20 pointer-events-none bg-slate-900/70 backdrop-blur-md px-2.5 py-1 rounded-full border border-slate-700/40 text-[10px] text-slate-400 flex items-center gap-1.5 shadow-md">
        <span className="w-1.5 h-1.5 rounded-full bg-[#E30613]" />
        <span>{floor.name}</span>
      </div>

      {/* SVG Холст карты с плавным transform */}
      <div
        className="w-full h-full flex items-center justify-center transition-transform duration-75 ease-out"
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
            {/* Неоновое свечение для активного маршрута ТТК */}
            <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Градиент для стенда ТТК */}
            <radialGradient id="ttkGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#E30613" stopOpacity="0.35" />
              <stop offset="70%" stopColor="#E30613" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#E30613" stopOpacity="0" />
            </radialGradient>

            {/* Паттерн плитки коридора */}
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

              {/* Зоны коридоров с плиткой */}
              {/* Вертикальный центральный проспект */}
              <rect x="480" y="160" width="240" height="580" fill="url(#floorTile)" opacity="0.8" />
              {/* Горизонтальный северный коридор */}
              <rect x="180" y="240" width="840" height="120" fill="url(#floorTile)" opacity="0.8" />

              {/* Зал «Сириус» (Слева) */}
              <g className="room-sirius">
                <rect
                  x="100"
                  y="100"
                  width="340"
                  height="400"
                  rx="16"
                  fill="#1e1b4b"
                  fillOpacity="0.4"
                  stroke="#4f46e5"
                  strokeWidth="2.5"
                  strokeDasharray="6 3"
                />
                <rect x="120" y="120" width="300" height="60" rx="8" fill="#312e81" fillOpacity="0.6" />
                <text x="270" y="155" textAnchor="middle" fill="#c7d2fe" fontSize="16" fontWeight="bold">
                  СЦЕНА И ЭКРАН
                </text>
                <text x="270" y="240" textAnchor="middle" fill="#818cf8" fontSize="20" fontWeight="800">
                  Конференц-зал «Сириус»
                </text>
                <text x="270" y="270" textAnchor="middle" fill="#94a3b8" fontSize="13">
                  500 мест • Доклады и защита
                </text>
              </g>

              {/* Зона Кофе-брейка и Lounge (Справа) */}
              <g className="room-food">
                <rect
                  x="780"
                  y="100"
                  width="320"
                  height="400"
                  rx="16"
                  fill="#451a03"
                  fillOpacity="0.3"
                  stroke="#d97706"
                  strokeWidth="2.5"
                  strokeDasharray="6 3"
                />
                <text x="940" y="230" textAnchor="middle" fill="#fbbf24" fontSize="20" fontWeight="800">
                  Кофе-брейк & Lounge
                </text>
                <text x="940" y="260" textAnchor="middle" fill="#94a3b8" fontSize="13">
                  Напитки • Снеки • Нетворкинг
                </text>
              </g>

              {/* Центральная зона ТТК (Флагман) */}
              <g className="zone-ttk">
                <circle cx="600" cy="400" r="140" fill="url(#ttkGlow)" />
                <circle
                  cx="600"
                  cy="400"
                  r="95"
                  fill="#1e293b"
                  stroke="#E30613"
                  strokeWidth="3"
                  strokeDasharray="8 4"
                />
                <rect x="530" y="380" width="140" height="40" rx="8" fill="#E30613" />
                <text x="600" y="405" textAnchor="middle" fill="white" fontSize="15" fontWeight="900" letterSpacing="2">
                  ТТК ЭКСПО
                </text>
                <text x="600" y="445" textAnchor="middle" fill="#f87171" fontSize="12" fontWeight="600">
                  Квантовые сети & Indoor
                </text>
              </g>

              {/* Зона Wi-Fi 6 ТТК */}
              <g className="zone-wifi" opacity="0.7">
                <circle cx="600" cy="570" r="45" fill="none" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="4 4" />
                <text x="600" y="575" textAnchor="middle" fill="#38bdf8" fontSize="11" fontWeight="bold">
                  Wi-Fi 6 ТТК
                </text>
              </g>

              {/* Зона Регистрации и Входа (Внизу по центру) */}
              <g className="zone-entrance">
                <rect x="420" y="680" width="360" height="60" rx="12" fill="#064e3b" fillOpacity="0.4" stroke="#10b981" strokeWidth="2" />
                <text x="600" y="718" textAnchor="middle" fill="#6ee7b7" fontSize="16" fontWeight="bold">
                  ВХОДНАЯ ГРУППА & РЕГИСТРАЦИЯ
                </text>
              </g>

              {/* Лестница на 2 этаж (Внизу слева) */}
              <g className="zone-stairs">
                <rect x="180" y="600" width="220" height="90" rx="10" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
                <line x1="210" y1="620" x2="370" y2="620" stroke="#94a3b8" strokeWidth="2" />
                <line x1="210" y1="645" x2="370" y2="645" stroke="#94a3b8" strokeWidth="2" />
                <line x1="210" y1="670" x2="370" y2="670" stroke="#94a3b8" strokeWidth="2" />
                <text x="290" y="612" textAnchor="middle" fill="#94a3b8" fontSize="12" fontWeight="bold">
                  Лестница на 2 этаж ▲
                </text>
              </g>

              {/* Санузлы (Внизу справа) */}
              <g className="zone-wc">
                <rect x="940" y="640" width="160" height="90" rx="10" fill="#083344" fillOpacity="0.6" stroke="#0891b2" strokeWidth="2" />
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
              <rect x="420" y="140" width="360" height="340" rx="16" fill="#4c0519" fillOpacity="0.4" stroke="#e11d48" strokeWidth="2.5" />
              <text x="600" y="290" textAnchor="middle" fill="#fda4af" fontSize="22" fontWeight="bold">
                VIP Lounge ТТК
              </text>
              <text x="600" y="325" textAnchor="middle" fill="#94a3b8" fontSize="13">
                Пресс-центр & Партнеры
              </text>

              {/* Переговорная А */}
              <rect x="120" y="180" width="260" height="280" rx="16" fill="#1e293b" stroke="#475569" strokeWidth="2" />
              <text x="250" y="320" textAnchor="middle" fill="#e2e8f0" fontSize="18" fontWeight="bold">
                Переговорная «Байкал»
              </text>
              <text x="250" y="350" textAnchor="middle" fill="#94a3b8" fontSize="12">
                ВКС ТТК • 16 мест
              </text>

              {/* Переговорная Б */}
              <rect x="820" y="180" width="260" height="280" rx="16" fill="#1e293b" stroke="#475569" strokeWidth="2" />
              <text x="950" y="320" textAnchor="middle" fill="#e2e8f0" fontSize="18" fontWeight="bold">
                Переговорная «Енисей»
              </text>
              <text x="950" y="350" textAnchor="middle" fill="#94a3b8" fontSize="12">
                Презентации • 12 мест
              </text>

              {/* Спуск на 1 этаж */}
              <rect x="180" y="600" width="220" height="90" rx="10" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
              <line x1="210" y1="620" x2="370" y2="620" stroke="#94a3b8" strokeWidth="2" />
              <line x1="210" y1="645" x2="370" y2="645" stroke="#94a3b8" strokeWidth="2" />
              <line x1="210" y1="670" x2="370" y2="670" stroke="#94a3b8" strokeWidth="2" />
              <text x="290" y="650" textAnchor="middle" fill="#94a3b8" fontSize="13" fontWeight="bold">
                Спуск на 1 этаж ▼
              </text>
            </g>
          )}

          {/* ================= ОТРИСОВКА МАРШРУТА ================= */}
          {routePoints.length > 1 && (
            <g id="navigation-path" className="pointer-events-none">
              {/* Фоновая неоновая подложка пути */}
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

              {/* Основная линия маршрута с анимацией импульса */}
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

              {/* Точка старта маршрута */}
              <g transform={`translate(${routePoints[0][0]}, ${routePoints[0][1]})`}>
                <circle cx="0" cy="0" r="14" fill="#10b981" stroke="white" strokeWidth="3" />
                <circle cx="0" cy="0" r="5" fill="white" />
                <rect x="-35" y="-36" width="70" height="20" rx="6" fill="#10b981" />
                <text x="0" y="-22" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">
                  ВЫ ЗДЕСЬ
                </text>
              </g>

              {/* Точка финиша маршрута */}
              <g
                transform={`translate(${routePoints[routePoints.length - 1][0]}, ${
                  routePoints[routePoints.length - 1][1]
                })`}
              >
                <circle cx="0" cy="0" r="16" fill="#E30613" stroke="white" strokeWidth="3" />
                <circle cx="0" cy="0" r="6" fill="white" />
                <rect x="-35" y="-38" width="70" height="22" rx="6" fill="#E30613" />
                <text x="0" y="-23" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">
                  ФИНИШ
                </text>
              </g>
            </g>
          )}

          {/* ================= МЕТКИ 360° ПАНОРАМ ================= */}
          {floor.panoramas.map(pano => (
            <g
              key={pano.id}
              transform={`translate(${pano.x}, ${pano.y})`}
              onClick={() => onOpenPanorama(pano.id)}
              className="interactive-pin cursor-pointer group"
            >
              {/* Пульсирующее кольцо панорамы */}
              <circle
                cx="0"
                cy="0"
                r="22"
                fill="#38bdf8"
                fillOpacity="0.25"
                className="animate-ping"
              />
              <circle
                cx="0"
                cy="0"
                r="18"
                fill="#0284c7"
                stroke="white"
                strokeWidth="2.5"
                className="transition-transform group-hover:scale-125"
              />
              <Camera className="w-5 h-5 text-white -translate-x-2.5 -translate-y-2.5 pointer-events-none" />
              {/* Бейдж 360 */}
              <rect
                x="-18"
                y="-32"
                width="36"
                height="15"
                rx="4"
                fill="#0f172a"
                stroke="#38bdf8"
                strokeWidth="1"
              />
              <text x="0" y="-21" textAnchor="middle" fill="#38bdf8" fontSize="9" fontWeight="900">
                360°
              </text>
            </g>
          ))}

          {/* ================= POI МАРКЕРЫ ================= */}
          {pois.map(poi => {
            const isSelected = selectedPoi?.id === poi.id;
            const style = getCategoryStyles(poi.category);

            return (
              <g
                key={poi.id}
                transform={`translate(${poi.x}, ${poi.y})`}
                onClick={() => onSelectPoi(poi)}
                className="interactive-pin cursor-pointer transition-transform duration-200"
                style={{
                  transform: `translate(${poi.x}px, ${poi.y}px) ${isSelected ? 'scale(1.35)' : 'scale(1)'}`,
                }}
              >
                {/* Анимация выбора */}
                {isSelected && (
                  <circle
                    cx="0"
                    cy="0"
                    r="28"
                    fill={style.bg}
                    fillOpacity="0.3"
                    className="animate-ping"
                  />
                )}

                {/* Основной пин */}
                <circle
                  cx="0"
                  cy="0"
                  r="16"
                  fill={style.bg}
                  stroke="white"
                  strokeWidth="2.5"
                  className="shadow-xl"
                />
                <circle cx="0" cy="0" r="5" fill="white" />

                {/* Название точки над пином */}
                <g transform="translate(0, -24)">
                  <rect
                    x={-((poi.name.length * 7) / 2 + 10)}
                    y="-12"
                    width={poi.name.length * 7 + 20}
                    height="20"
                    rx="6"
                    fill={isSelected ? '#E30613' : '#0f172a'}
                    stroke={isSelected ? 'white' : '#334155'}
                    strokeWidth="1.5"
                    className="shadow-lg"
                  />
                  <text
                    x="0"
                    y="2"
                    textAnchor="middle"
                    fill="white"
                    fontSize="10"
                    fontWeight={isSelected ? 'bold' : '600'}
                  >
                    {poi.name}
                  </text>
                </g>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
