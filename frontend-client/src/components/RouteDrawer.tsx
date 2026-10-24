import React, { useState } from 'react';
import { RouteResponse, POI } from '../types';
import {
  Navigation,
  Footprints,
  Compass,
  X,
  ChevronDown,
  ChevronUp,
  Clock,
  MapPin,
  Sparkles
} from 'lucide-react';

interface RouteDrawerProps {
  route: RouteResponse | null;
  targetPoi: POI | null;
  onClearRoute: () => void;
  onStartVirtualWalk: () => void;
}

export const RouteDrawer: React.FC<RouteDrawerProps> = ({
  route,
  targetPoi,
  onClearRoute,
  onStartVirtualWalk,
}) => {
  const [showSteps, setShowSteps] = useState<boolean>(false);

  if (!route) return null;

  const hasPanoramas = route.panoramas && route.panoramas.length > 0;

  return (
    <div className="absolute bottom-0 left-0 right-0 z-30 bg-slate-900/98 backdrop-blur-xl border-t border-cyan-500/40 rounded-t-3xl shadow-2xl p-4 sm:p-5 max-w-lg mx-auto transition-transform animate-in slide-in-from-bottom duration-200">
      {/* Декоративная полоса */}
      <div className="w-12 h-1.5 bg-slate-700/80 rounded-full mx-auto mb-3" />

      {/* Верхняя плашка маршрута */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-cyan-950 border border-cyan-500/30 text-cyan-400 flex items-center gap-1">
              <Navigation className="w-3 h-3 text-cyan-400 animate-pulse" /> Активный маршрут
            </span>
            <span className="text-xs text-slate-400">ТТК Навигатор</span>
          </div>
          <h3 className="text-base font-extrabold text-white mt-1">
            {targetPoi ? `К цели: ${targetPoi.name}` : 'Построенный маршрут'}
          </h3>
        </div>

        <button
          onClick={onClearRoute}
          className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          title="Завершить маршрут"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Индикаторы дистанции и времени */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-2.5 flex items-center gap-2.5">
          <div className="p-2 bg-cyan-950 text-cyan-400 rounded-lg">
            <Footprints className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-slate-400 font-medium uppercase">Дистанция</div>
            <div className="text-sm font-black text-cyan-300">
              {route.totalDistanceMeters} метров
            </div>
          </div>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-2.5 flex items-center gap-2.5">
          <div className="p-2 bg-slate-900 text-amber-400 rounded-lg">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-slate-400 font-medium uppercase">Время пешком</div>
            <div className="text-sm font-black text-amber-300">
              ~{route.estimatedDurationSeconds} сек
            </div>
          </div>
        </div>
      </div>

      {/* Пошаговые подсказки (раскрывающийся аккордеон) */}
      <div className="mb-3.5">
        <button
          onClick={() => setShowSteps(!showSteps)}
          className="w-full flex items-center justify-between py-1.5 px-2 text-xs font-semibold text-slate-300 hover:text-white rounded-lg hover:bg-slate-800/60 transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-cyan-400" />
            <span>Пошаговые подсказки ({route.steps.length})</span>
          </span>
          {showSteps ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showSteps && (
          <div className="mt-2 space-y-1.5 max-h-36 overflow-y-auto pr-1">
            {route.steps.map((step, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2 text-xs bg-slate-800/60 p-2 rounded-lg border border-slate-700/40"
              >
                <span className="w-4 h-4 rounded-full bg-[#E30613] text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                <span className="text-slate-200">{step}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Кнопка запуска 360° Прогулки (Киллер-фича хакатона) */}
      <button
        onClick={onStartVirtualWalk}
        disabled={!hasPanoramas}
        className={`w-full flex items-center justify-center gap-2 font-black text-xs py-3.5 px-4 rounded-xl shadow-xl transition-all ${
          hasPanoramas
            ? 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 active:scale-95 shadow-cyan-950/50'
            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
        }`}
      >
        <Compass className="w-4 h-4 animate-spin text-slate-950" />
        <span>Виртуальная 360° прогулка по маршруту</span>
        <Sparkles className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
