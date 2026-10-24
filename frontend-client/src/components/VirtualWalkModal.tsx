import React, { useState, useEffect, useRef } from 'react';
import 'pannellum/build/pannellum.css';
import 'pannellum';
import { Panorama, RouteResponse } from '../types';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Compass,
  Sparkles,
  Footprints,
  CheckCircle2
} from 'lucide-react';

interface VirtualWalkModalProps {
  route: RouteResponse;
  allPanoramas: Panorama[];
  onClose: () => void;
}

export const VirtualWalkModal: React.FC<VirtualWalkModalProps> = ({
  route,
  allPanoramas,
  onClose,
}) => {
  // Список панорам вдоль маршрута
  const walkPanos = route.panoramas
    .map(id => allPanoramas.find(p => p.id === id))
    .filter((p): p is Panorama => Boolean(p));

  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const viewerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentPano = walkPanos[currentIndex] || walkPanos[0];

  // Инициализация Pannellum при смене точки маршрута
  useEffect(() => {
    if (!containerRef.current || !currentPano) return;

    const pannellum = (window as any).pannellum;
    if (!pannellum) return;

    try {
      viewerRef.current?.destroy();
    } catch {
      // ignore
    }

    try {
      viewerRef.current = pannellum.viewer(containerRef.current, {
        type: 'equirectangular',
        panorama: currentPano.url,
        preview: currentPano.previewUrl || currentPano.url,
        autoLoad: true,
        autoRotate: -2,
        compass: true,
        showZoomCtrl: false,
        showFullscreenCtrl: false,
        yaw: currentPano.yawOffset || 0,
        pitch: 0,
        hfov: 105,
      });
    } catch (err) {
      console.error('Error init walk viewer:', err);
    }

    return () => {
      try {
        viewerRef.current?.destroy();
      } catch {
        // ignore
      }
      viewerRef.current = null;
    };
  }, [currentIndex, currentPano?.id]);

  // Автопроигрывание прогулки
  useEffect(() => {
    if (!isPlaying) return;

    const timer = setInterval(() => {
      setCurrentIndex(prev => {
        if (prev + 1 < walkPanos.length) {
          return prev + 1;
        } else {
          setIsPlaying(false);
          return prev;
        }
      });
    }, 6000);

    return () => clearInterval(timer);
  }, [isPlaying, walkPanos.length]);

  const handleNext = () => {
    if (currentIndex + 1 < walkPanos.length) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  if (!currentPano) return null;

  const isLastStep = currentIndex === walkPanos.length - 1;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col animate-in fade-in duration-200">
      {/* Верхняя плашка тура */}
      <div className="absolute top-4 left-3 right-3 z-20 flex items-center justify-between pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2 bg-slate-900/95 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-cyan-500/40 shadow-2xl">
          <Footprints className="w-4 h-4 text-cyan-400 animate-pulse" />
          <span className="text-xs font-black text-white">
            Шаг {currentIndex + 1} из {walkPanos.length}
          </span>
          <span className="text-[11px] text-slate-300 border-l border-slate-700 pl-2 truncate max-w-[160px]">
            {currentPano.title || `Точка ${currentIndex + 1}`}
          </span>
        </div>

        <button
          onClick={onClose}
          className="pointer-events-auto p-2 bg-slate-900/90 hover:bg-red-600 text-white rounded-full border border-slate-700/60 backdrop-blur-md shadow-xl active:scale-90 transition-colors"
          title="Завершить прогулку"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Прогресс-индикатор по точкам */}
      <div className="absolute top-16 left-4 right-4 z-20 pointer-events-none flex gap-1.5 max-w-sm mx-auto">
        {walkPanos.map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              i <= currentIndex ? 'bg-cyan-400 shadow-sm shadow-cyan-400' : 'bg-slate-700/60'
            }`}
          />
        ))}
      </div>

      {/* Нижняя панель управления прогулкой */}
      <div className="absolute bottom-6 left-4 right-4 z-20 flex items-center justify-center gap-3">
        <div className="flex items-center gap-2 bg-slate-900/95 backdrop-blur-md px-3 py-2 rounded-2xl border border-slate-700/60 shadow-2xl">
          {/* Предыдущий шаг */}
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className={`p-2 rounded-xl transition-all ${
              currentIndex > 0
                ? 'text-white hover:bg-slate-800 active:scale-95'
                : 'text-slate-600 cursor-not-allowed'
            }`}
            title="Предыдущая панорама"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          {/* Авто-плей / Пауза */}
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs transition-all active:scale-95 ${
              isPlaying
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-950/50'
                : 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-950/50 hover:bg-cyan-400'
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4 fill-current" />
                <span>Пауза</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Автотур</span>
              </>
            )}
          </button>

          {/* Следующий шаг */}
          <button
            onClick={handleNext}
            disabled={isLastStep}
            className={`p-2 rounded-xl transition-all ${
              !isLastStep
                ? 'text-white hover:bg-slate-800 active:scale-95'
                : 'text-slate-600 cursor-not-allowed'
            }`}
            title="Следующая панорама"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Если дошли до финиша */}
        {isLastStep && (
          <div className="bg-emerald-950/90 border border-emerald-500/50 px-3 py-2 rounded-2xl flex items-center gap-1.5 text-xs font-bold text-emerald-300 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Вы у цели!</span>
          </div>
        )}
      </div>

      {/* Контейнер Pannellum */}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
};
