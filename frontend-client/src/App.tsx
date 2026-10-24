import React, { useState, useEffect, useRef } from 'react';
import 'pannellum/build/pannellum.css';
import 'pannellum';
import { Compass, Navigation, Eye, MapPin, Search, Layers, X, Coffee, Award, DoorOpen, Users, LogOut, UserRound } from 'lucide-react';
import AuthScreen from './components/AuthScreen';
import { API_URL, clearSession, logoutSession, restoreSession, type Session } from './lib/auth';

interface POI {
  id: string;
  name: string;
  category: string;
  description?: string;
  x: number;
  y: number;
}

interface RouteInfo {
  totalDistanceMeters: number;
  estimatedDurationSeconds: number;
  points: [number, number][];
}
import React, { useState, useEffect, useMemo } from 'react';
import { Venue, Floor, POI, RouteResponse, Panorama } from './types';
import { mockVenue } from './data/mockData';
import { calculateClientRoute } from './utils/pathfinder';
import { Header } from './components/Header';
import { CategoryFilters } from './components/CategoryFilters';
import { InteractiveMap } from './components/InteractiveMap';
import { PoiSheet } from './components/PoiSheet';
import { RouteDrawer } from './components/RouteDrawer';
import { PanoModal } from './components/PanoModal';
import { VirtualWalkModal } from './components/VirtualWalkModal';

export default function App() {
  const [venue, setVenue] = useState<Venue>(mockVenue);
  const [activeFloorId, setActiveFloorId] = useState<string>('floor-1');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [session, setSession] = useState<Session | null>(null);
  const [booting, setBooting] = useState<boolean>(true);
  const viewerRef = useRef<any>(null);

  useEffect(() => {
    let active = true;
    restoreSession()
      .then((restored) => {
        if (!active) return;
        if (restored && restored.user.role !== 'user') {
          clearSession();
          setSession(null);
          return;
        }
        setSession(restored);
      })
      .finally(() => {
        if (active) setBooting(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!showPanoModal) return;

  const [selectedPoi, setSelectedPoi] = useState<POI | null>(null);
  const [activeRoute, setActiveRoute] = useState<RouteResponse | null>(null);
  const [routeTargetPoi, setRouteTargetPoi] = useState<POI | null>(null);
  const [activeZoneId, setActiveZoneId] = useState<string | null>(null);

  const [activePanoId, setActivePanoId] = useState<string | null>(null);
  const [showPanoModal, setShowPanoModal] = useState<boolean>(false);
  const [showVirtualWalk, setShowVirtualWalk] = useState<boolean>(false);

  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(false);

  // Активный этаж
  const activeFloor: Floor = useMemo(() => {
    return venue.floors.find(f => f.id === activeFloorId) || venue.floors[0];
  }, [venue, activeFloorId]);

  // Проверка связи с бэкендом при старте
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/health', { method: 'GET' });
        if (res.ok) {
          setIsBackendConnected(true);
          // Попытка загрузить актуальную площадку с бэкенда
          const venueRes = await fetch('http://localhost:8000/api/public/ttk-expo');
          if (venueRes.ok) {
            const data = await venueRes.json();
            if (data && data.floors && data.floors.length > 0) {
              setVenue(data);
            }
          }
        }
      } catch {
        // Бэкенд офлайн — продолжаем в автономном режиме
        setIsBackendConnected(false);
      }
    };
    checkBackend();
  }, []);

  const buildRouteTo = async (poi: POI) => {
    try {
      const res = await fetch(`${API_URL}/api/public/ttk-expo/route`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromPoiId: 'poi-entrance', toPoiId: poi.id })
      });
      if (res.ok) {
        const data = await res.json();
        setActiveRoute({
          totalDistanceMeters: data.totalDistanceMeters,
          estimatedDurationSeconds: data.estimatedDurationSeconds,
          points: data.legs[0].points
  // Поддержка query-параметров (?poi=poi-ttk-stand)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const poiParam = params.get('poi');
    if (poiParam) {
      for (const fl of venue.floors) {
        const found = fl.points.find(p => p.id === poiParam);
        if (found) {
          setActiveFloorId(fl.id);
          setSelectedPoi(found);
          break;
        }
      }
    }
  }, [venue]);

  // Закрытие окон по Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showVirtualWalk) setShowVirtualWalk(false);
        else if (showPanoModal) setShowPanoModal(false);
        else if (selectedPoi) setSelectedPoi(null);
        else if (activeRoute) {
          setActiveRoute(null);
          setRouteTargetPoi(null);
        } else if (activeZoneId) {
          setActiveZoneId(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showVirtualWalk, showPanoModal, selectedPoi, activeRoute, activeZoneId]);

  // Закрываем карточку POI при выходе из комнаты (отдалении к общему плану)
  useEffect(() => {
    if (!activeZoneId) {
      setSelectedPoi(null);
    }
  }, [activeZoneId]);

  // Подсчет количества точек по категориям для текущего этажа
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: activeFloor.points.length };
    for (const p of activeFloor.points) {
      counts[p.category] = (counts[p.category] || 0) + 1;
    }
    return counts;
  }, [activeFloor]);

  // Фильтрация точек интереса для поиска
  const searchFilteredPois = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return activeFloor.points;
    return activeFloor.points.filter(poi =>
      poi.name.toLowerCase().includes(q) ||
      (poi.description && poi.description.toLowerCase().includes(q)) ||
      (poi.tags && poi.tags.some(t => t.toLowerCase().includes(q)))
    );
  }, [activeFloor, searchQuery]);

  // Автозум к зоне при поиске: если нашли 1 уникальный результат — автоматически выбираем
  useEffect(() => {
    if (!searchQuery.trim()) return;
    if (searchFilteredPois.length === 1) {
      // Единственный результат — выбираем его автоматически (InteractiveMap сам зумирует)
      setSelectedPoi(searchFilteredPois[0]);
    }
  }, [searchQuery, searchFilteredPois.length]);

  // Построение маршрута
  const handleBuildRoute = async (target: POI) => {
    setSelectedPoi(null);
    setRouteTargetPoi(target);

    // Координаты старта: точка входа на текущем этаже
    const entrancePoi = activeFloor.points.find(p => p.category === 'entrance') || activeFloor.points[0];
    const fromX = entrancePoi ? entrancePoi.x : 600;
    const fromY = entrancePoi ? entrancePoi.y : 740;

    // 1. Попытка запроса к бэкенду
    if (isBackendConnected) {
      try {
        const res = await fetch('http://localhost:8000/api/public/ttk-expo/route', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fromPoiId: entrancePoi?.id || 'poi-entrance',
            toPoiId: target.id,
          }),
        });
        if (res.ok) {
          const data: RouteResponse = await res.json();
          setActiveRoute(data);
          return;
        }
      } catch (err) {
        console.warn('Backend route calculation failed, using client pathfinder:', err);
      }
    }

    // 2. Автономный расчет маршрута (Client-Side A* Pathfinder)
    const clientRoute = calculateClientRoute(
      activeFloor,
      fromX,
      fromY,
      target.x,
      target.y,
      entrancePoi?.name || 'Главный вход',
      target.name
    );
    setActiveRoute(clientRoute);
  };

  const handleClearRoute = () => {
    setActiveRoute(null);
    setRouteTargetPoi(null);
  };

  // Открытие панорамы 360°
  const handleOpenPanorama = (panoId: string) => {
    setActivePanoId(panoId);
    setShowPanoModal(true);
  };

  const activePanorama: Panorama | undefined = useMemo(() => {
    if (!activePanoId) return activeFloor.panoramas[0];
    for (const fl of venue.floors) {
      const found = fl.panoramas.find(p => p.id === activePanoId);
      if (found) return found;
    }
    return activeFloor.panoramas[0];
  }, [activePanoId, activeFloor, venue]);

  const handleLogout = async () => {
    await logoutSession();
    setSession(null);
  };

  if (booting) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-slate-100">
        <div className="flex items-center gap-3 text-sm text-slate-400">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-700 border-t-[#E30613]" />
          Проверяем сессию…
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <AuthScreen
        mode="user"
        alternateUrl={import.meta.env.VITE_ADMIN_URL || 'http://localhost:3001'}
        onAuthenticated={setSession}
      />
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 font-sans text-slate-100">
      {/* Верхняя мобильная шапка */}
      <header className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 z-10 shadow-md">
        <div className="flex items-center space-x-2">
          <span className="bg-[#E30613] text-white font-black text-sm px-2 py-0.5 rounded tracking-wider">ТТК</span>
          <span className="font-bold text-sm tracking-tight text-white">Карта Пространства</span>
        </div>
        <div className="flex items-center space-x-2">
          <div
            className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-full pl-1.5 pr-1 py-0.5"
            title={session.user.email}
          >
            <span className="w-6 h-6 rounded-full bg-[#E30613] flex items-center justify-center">
              <UserRound className="w-3.5 h-3.5 text-white" />
            </span>
            <span className="text-[11px] text-slate-200 max-w-[90px] truncate">{session.user.fullName}</span>
            <button
              onClick={() => { void handleLogout(); }}
              title="Выйти"
              className="text-slate-400 hover:text-red-400 p-1 rounded-full hover:bg-slate-700/70 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
          <span className="text-xs bg-slate-800 text-slate-300 px-2.5 py-1 rounded-full border border-slate-700 flex items-center gap-1">
            <Layers className="w-3 h-3 text-[#E30613]" /> 1 этаж
          </span>
    <div className="flex flex-col h-screen w-screen bg-slate-950 font-sans text-slate-100 overflow-hidden relative">
      {/* 1. Верхний адаптивный хедер с поиском и этажами */}
      <Header
        floors={venue.floors}
        activeFloorId={activeFloorId}
        onSelectFloor={id => {
          setActiveFloorId(id);
          setSelectedPoi(null);
          setActiveRoute(null);
          setActiveZoneId(null);
        }}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        isBackendConnected={isBackendConnected}
        searchResults={searchFilteredPois}
        onSelectSearchResult={poi => {
          setSelectedPoi(poi);
          setSearchQuery('');
        }}
      />

      {/* 2. Область карты с плавающим вертикальным меню фильтров слева */}
      <div className="relative flex-1 w-full h-full overflow-hidden">
        <InteractiveMap
          floor={activeFloor}
          pois={activeFloor.points}
          selectedPoi={selectedPoi}
          onSelectPoi={poi => {
            setSelectedPoi(poi);
          }}
          onClearSelectedPoi={() => setSelectedPoi(null)}
          activeRoute={activeRoute}
          onOpenPanorama={handleOpenPanorama}
          activeZoneId={activeZoneId}
          onZoneChange={setActiveZoneId}
          selectedCategory={selectedCategory}
        />

        {/* Вертикальная менюшка категорий слева (сворачивается при зуме в помещение или маршруте) */}
        <div
          className={`absolute left-3 top-4 z-20 transition-all duration-300 ease-in-out ${
            activeZoneId || activeRoute
              ? '-translate-x-56 opacity-0 pointer-events-none'
              : 'translate-x-0 opacity-100'
          }`}
        >
          <CategoryFilters
            selectedCategory={selectedCategory}
            onSelectCategory={cat => setSelectedCategory(cat)}
            categoryCounts={categoryCounts}
          />
        </div>
      </div>

      {/* 4. Шторка информации о выбранной точке (Bottom Sheet) */}
      {selectedPoi && !activeRoute && (
        <PoiSheet
          poi={selectedPoi}
          floor={activeFloor}
          onClose={() => setSelectedPoi(null)}
          onBuildRoute={handleBuildRoute}
          onOpenPanorama={handleOpenPanorama}
        />
      )}

      {/* 5. Шторка активного маршрута с пошаговой навигацией */}
      {activeRoute && (
        <RouteDrawer
          route={activeRoute}
          targetPoi={routeTargetPoi}
          onClearRoute={handleClearRoute}
          onStartVirtualWalk={() => setShowVirtualWalk(true)}
        />
      )}

      {/* 6. Полноэкранный 360° Виртуальный тур (Pannellum + Гироскоп) */}
      {showPanoModal && activePanorama && (
        <PanoModal
          panorama={activePanorama}
          allPanoramas={activeFloor.panoramas}
          onSelectPanorama={id => setActivePanoId(id)}
          onClose={() => setShowPanoModal(false)}
          onSelectPoiById={poiId => {
            const found = activeFloor.points.find(p => p.id === poiId);
            if (found) setSelectedPoi(found);
          }}
        />
      )}

      {/* 7. Режим «Виртуальная 360° прогулка» по цепочке панорам */}
      {showVirtualWalk && activeRoute && (
        <VirtualWalkModal
          route={activeRoute}
          allPanoramas={activeFloor.panoramas}
          onClose={() => setShowVirtualWalk(false)}
        />
      )}
    </div>
  );
}
