import React, { useState, useEffect } from 'react';
import { Compass, Navigation, Eye, MapPin, Search, Layers, X, Coffee, Award, DoorOpen, Users } from 'lucide-react';

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

export default function App() {
  const [selectedPoi, setSelectedPoi] = useState<POI | null>(null);
  const [activeRoute, setActiveRoute] = useState<RouteInfo | null>(null);
  const [showPanoModal, setShowPanoModal] = useState<boolean>(false);
  const [activePanoUrl, setActivePanoUrl] = useState<string>('https://pannellum.org/images/alma.jpg');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Базовые точки на плане (1200x800)
  const pois: POI[] = [
    { id: 'poi-entrance', name: 'Главный вход & Регистрация', category: 'service', description: 'Стойка регистрации участников, гардероб и навигационный стенд ТТК.', x: 600, y: 740 },
    { id: 'poi-ttk-stand', name: 'Центральный стенд ТТК', category: 'sponsor', description: 'Инновации indoor-навигации, квантовые сети и цифровые сервисы ТрансТелеКом.', x: 600, y: 400 },
    { id: 'poi-main-hall', name: 'Конференц-зал «Сириус»', category: 'hall', description: 'Главная сцена: пленарные сессии, защита проектов хакатона.', x: 250, y: 300 },
    { id: 'poi-food', name: 'Кофе-брейк и зона отдыха', category: 'food', description: 'Свежий кофе, снеки, зарядные станции и комфортные диваны.', x: 950, y: 300 },
    { id: 'poi-wc', name: 'Санузлы', category: 'wc', description: 'Мужской, женский и санузел для маломобильных групп.', x: 1050, y: 700 }
  ];

  const handleSelectPoi = (poi: POI) => {
    setSelectedPoi(poi);
  };

  const buildRouteTo = async (poi: POI) => {
    try {
      const res = await fetch('http://localhost:8000/api/public/ttk-expo/route', {
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
        });
      } else {
        throw new Error('Fallback to client route');
      }
    } catch {
      // Клиентский фолбэк для автономного демо
      setActiveRoute({
        totalDistanceMeters: 28.5,
        estimatedDurationSeconds: 24,
        points: [[600, 740], [600, 500], [poi.x, poi.y]]
      });
    }
  };

  const openPanorama = (url?: string) => {
    if (url) setActivePanoUrl(url);
    setShowPanoModal(true);
    setTimeout(() => {
      // @ts-ignore
      if (window.pannellum) {
        // @ts-ignore
        window.pannellum.viewer('pano-container', {
          type: 'equirectangular',
          panorama: url || activePanoUrl,
          autoLoad: true,
          compass: true
        });
      }
    }, 100);
  };

  const filteredPois = pois.filter(p => {
    const matchCat = filterCategory === 'all' || p.category === filterCategory;
    const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 font-sans text-slate-100">
      {/* Верхняя мобильная шапка */}
      <header className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 z-10 shadow-md">
        <div className="flex items-center space-x-2">
          <span className="bg-[#E30613] text-white font-black text-sm px-2 py-0.5 rounded tracking-wider">ТТК</span>
          <span className="font-bold text-sm tracking-tight text-white">Карта Пространства</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-xs bg-slate-800 text-slate-300 px-2.5 py-1 rounded-full border border-slate-700 flex items-center gap-1">
            <Layers className="w-3 h-3 text-[#E30613]" /> 1 этаж
          </span>
        </div>
      </header>

      {/* Быстрые фильтры категорий */}
      <div className="flex space-x-2 px-3 py-2 bg-slate-900/90 border-b border-slate-800/80 overflow-x-auto no-scrollbar z-10">
        <button onClick={() => setFilterCategory('all')} className={`text-xs px-3 py-1 rounded-full shrink-0 transition-colors ${filterCategory === 'all' ? 'bg-[#E30613] text-white font-bold' : 'bg-slate-800 text-slate-300'}`}>Все</button>
        <button onClick={() => setFilterCategory('sponsor')} className={`text-xs px-3 py-1 rounded-full shrink-0 transition-colors ${filterCategory === 'sponsor' ? 'bg-[#E30613] text-white font-bold' : 'bg-slate-800 text-slate-300'}`}>Стенды</button>
        <button onClick={() => setFilterCategory('hall')} className={`text-xs px-3 py-1 rounded-full shrink-0 transition-colors ${filterCategory === 'hall' ? 'bg-[#E30613] text-white font-bold' : 'bg-slate-800 text-slate-300'}`}>Залы</button>
        <button onClick={() => setFilterCategory('food')} className={`text-xs px-3 py-1 rounded-full shrink-0 transition-colors ${filterCategory === 'food' ? 'bg-[#E30613] text-white font-bold' : 'bg-slate-800 text-slate-300'}`}>Кофе</button>
      </div>

      {/* Интерактивная 2D Карта (SVG с масштабированием) */}
      <main className="flex-1 relative overflow-hidden flex items-center justify-center p-2">
        <div className="w-full h-full max-w-4xl max-h-[85vh] bg-slate-900 rounded-xl border border-slate-800 relative shadow-2xl overflow-hidden flex items-center justify-center">
          <svg viewBox="0 0 1200 800" className="w-full h-full object-contain">
            {/* Сетка и план здания */}
            <rect x="50" y="50" width="1100" height="700" rx="16" fill="#0f172a" stroke="#334155" strokeWidth="3" />
            
            {/* Коридоры */}
            <rect x="500" y="250" width="200" height="490" fill="#1e293b" opacity="0.6" />
            <rect x="200" y="260" width="800" height="90" fill="#1e293b" opacity="0.6" />

            {/* Зоны помещений */}
            <rect x="100" y="100" width="350" height="350" rx="10" fill="#1e293b" stroke="#475569" strokeWidth="2" />
            <text x="275" y="220" textAnchor="middle" fill="#94a3b8" fontSize="18" fontWeight="bold">Зал «Сириус»</text>

            <rect x="800" y="100" width="300" height="350" rx="10" fill="#1e293b" stroke="#475569" strokeWidth="2" />
            <text x="950" y="220" textAnchor="middle" fill="#94a3b8" fontSize="18" fontWeight="bold">Кофе-брейк</text>

            <circle cx="600" cy="400" r="110" fill="#e30613" fillOpacity="0.1" stroke="#e30613" strokeWidth="2" strokeDasharray="6,4" />
            <text x="600" y="470" textAnchor="middle" fill="#e30613" fontSize="16" fontWeight="bold">Стенд ТТК</text>

            {/* Отрисовка маршрута, если построен */}
            {activeRoute && activeRoute.points.length > 1 && (
              <polyline
                points={activeRoute.points.map(p => p.join(',')).join(' ')}
                fill="none"
                stroke="#38bdf8"
                strokeWidth="6"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="animate-pulse"
              />
            )}

            {/* Точки панорам (глазки 360) */}
            <g onClick={() => openPanorama('https://pannellum.org/images/alma.jpg')} className="cursor-pointer">
              <circle cx="600" cy="700" r="18" fill="#0284c7" />
              <text x="600" y="705" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">360</text>
            </g>
            <g onClick={() => openPanorama('https://pannellum.org/images/jfk.jpg')} className="cursor-pointer">
              <circle cx="600" cy="400" r="18" fill="#e30613" />
              <text x="600" y="405" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">360</text>
            </g>

            {/* POI Маркеры */}
            {filteredPois.map(poi => (
              <g 
                key={poi.id} 
                transform={`translate(${poi.x}, ${poi.y})`}
                onClick={() => handleSelectPoi(poi)}
                className="cursor-pointer transition-transform hover:scale-125"
              >
                <circle cx="0" cy="0" r="14" fill={poi.category === 'sponsor' ? '#E30613' : '#38bdf8'} stroke="white" strokeWidth="2" />
                <circle cx="0" cy="0" r="5" fill="white" />
              </g>
            ))}
          </svg>
        </div>
      </main>

      {/* Нижняя карточка выбранной точки (Bottom Sheet) */}
      {selectedPoi && (
        <div className="absolute bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-700 p-4 rounded-t-2xl shadow-2xl z-20 transition-transform">
          <div className="flex justify-between items-start mb-2">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                {selectedPoi.category}
              </span>
              <h2 className="text-base font-bold text-white mt-1">{selectedPoi.name}</h2>
            </div>
            <button onClick={() => setSelectedPoi(null)} className="text-slate-400 hover:text-white p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-xs text-slate-400 mb-4">{selectedPoi.description}</p>
          <div className="grid grid-cols-2 gap-2">
            <button 
              onClick={() => buildRouteTo(selectedPoi)} 
              className="flex items-center justify-center gap-1.5 bg-[#E30613] hover:bg-red-700 text-white font-bold text-xs py-2.5 px-3 rounded-lg shadow-lg active:scale-95 transition-all"
            >
              <Navigation className="w-4 h-4" /> Маршрут сюда
            </button>
            <button 
              onClick={() => openPanorama()} 
              className="flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-cyan-500/30 font-bold text-xs py-2.5 px-3 rounded-lg active:scale-95 transition-all"
            >
              <Eye className="w-4 h-4" /> В панораму 360°
            </button>
          </div>
          {activeRoute && (
            <div className="mt-3 pt-2 border-t border-slate-800 flex justify-between text-xs text-slate-300">
              <span>Расстояние: <strong className="text-cyan-400">{activeRoute.totalDistanceMeters} м</strong></span>
              <span>Время в пути: <strong className="text-cyan-400">~{activeRoute.estimatedDurationSeconds} сек</strong></span>
            </div>
          )}
        </div>
      )}

      {/* Полноэкранная модалка 360 Панорамы */}
      {showPanoModal && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
          <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-10 pointer-events-auto">
            <span className="bg-black/60 backdrop-blur-md text-white text-xs px-3 py-1.5 rounded-full border border-white/20 flex items-center gap-2">
              <Compass className="w-4 h-4 text-[#E30613] animate-spin" /> 360° Виртуальный тур
            </span>
            <button 
              onClick={() => setShowPanoModal(false)}
              className="bg-black/60 backdrop-blur-md text-white p-2 rounded-full border border-white/20 active:scale-95"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div id="pano-container" className="w-full h-full"></div>
        </div>
      )}
    </div>
  );
}
