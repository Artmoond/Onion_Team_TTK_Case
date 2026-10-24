import React, { useEffect, useRef, useState } from 'react';
import 'pannellum/build/pannellum.css';
import 'pannellum';
import { Panorama, POI } from '../types';
import {
  X,
  Compass,
  Smartphone,
  RotateCw,
  Maximize,
  Info,
  Navigation,
  Sparkles
} from 'lucide-react';

interface PanoModalProps {
  panorama: Panorama;
  allPanoramas: Panorama[];
  onSelectPanorama: (panoId: string) => void;
  onClose: () => void;
  onSelectPoiById?: (poiId: string) => void;
}

export const PanoModal: React.FC<PanoModalProps> = ({
  panorama,
  allPanoramas,
  onSelectPanorama,
  onClose,
  onSelectPoiById,
}) => {
  const viewerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [gyroActive, setGyroActive] = useState<boolean>(false);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [activeInfoText, setActiveInfoText] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const pannellum = (window as any).pannellum;
    if (!pannellum) return;

    // Очищаем предыдущий вьюер, если был
    try {
      viewerRef.current?.destroy();
    } catch {
      // ignore
    }

    // Подготовка хотспотов для Pannellum
    const formattedHotspots = (panorama.hotspots || []).map(h => {
      if (h.type === 'scene' && h.targetPanoramaId) {
        return {
          pitch: h.pitch,
          yaw: h.yaw,
          type: 'scene',
          text: h.text,
          sceneId: h.targetPanoramaId,
          clickHandlerFunc: () => {
            onSelectPanorama(h.targetPanoramaId!);
          },
        };
      }
      return {
        pitch: h.pitch,
        yaw: h.yaw,
        type: 'info',
        text: h.text,
        clickHandlerFunc: () => {
          setActiveInfoText(h.text);
          if (h.poiId && onSelectPoiById) {
            onSelectPoiById(h.poiId);
          }
        },
      };
    });

    try {
      viewerRef.current = pannellum.viewer(containerRef.current, {
        type: 'equirectangular',
        panorama: panorama.url,
        preview: panorama.previewUrl || panorama.url,
        autoLoad: true,
        autoRotate: autoRotate ? -2 : 0,
        compass: true,
        showZoomCtrl: true,
        showFullscreenCtrl: false,
        hotSpots: formattedHotspots,
        yaw: panorama.yawOffset || 0,
        pitch: 0,
        hfov: 100,
        minHfov: 50,
        maxHfov: 120,
      });
    } catch (err) {
      console.error('Error initializing Pannellum viewer:', err);
    }

    return () => {
      try {
        viewerRef.current?.destroy();
      } catch {
        // ignore
      }
      viewerRef.current = null;
    };
  }, [panorama.id, panorama.url]);

  // Управление гироскопом (DeviceOrientation API)
  const toggleGyroscope = async () => {
    if (!viewerRef.current) return;

    if (gyroActive) {
      try {
        viewerRef.current.stopOrientation();
      } catch {
        // ignore
      }
      setGyroActive(false);
      return;
    }

    // Запрос разрешения для iOS 13+
    if (
      typeof DeviceOrientationEvent !== 'undefined' &&
      typeof (DeviceOrientationEvent as any).requestPermission === 'function'
    ) {
      try {
        const permissionState = await (DeviceOrientationEvent as any).requestPermission();
        if (permissionState === 'granted') {
          viewerRef.current.startOrientation();
          setGyroActive(true);
        } else {
          alert('Доступ к гироскопу отклонен пользователем');
        }
      } catch (err) {
        console.warn('Gyroscope permission error:', err);
      }
    } else {
      // Android & обычные браузеры
      try {
        viewerRef.current.startOrientation();
        setGyroActive(true);
      } catch (err) {
        console.warn('Could not start orientation:', err);
      }
    }
  };

  // Переключение авто-вращения
  const toggleAutoRotate = () => {
    if (!viewerRef.current) return;
    if (autoRotate) {
      viewerRef.current.stopAutoRotate();
      setAutoRotate(false);
    } else {
      viewerRef.current.startAutoRotate(-2);
      setAutoRotate(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col animate-in fade-in duration-200">
      {/* Верхняя плавающая панель управления */}
      <div className="absolute top-4 left-3 right-3 z-20 flex items-center justify-between pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-700/60 shadow-xl max-w-[70%]">
          <Compass className="w-4 h-4 text-[#E30613] shrink-0 animate-spin" />
          <span className="text-xs font-bold text-white truncate">
            {panorama.title || '360° Виртуальный тур ТТК'}
          </span>
        </div>

        <div className="pointer-events-auto flex items-center gap-1.5">
          {/* Кнопка Гироскопа */}
          <button
            onClick={toggleGyroscope}
            className={`p-2 rounded-full border backdrop-blur-md shadow-xl transition-all active:scale-90 ${
              gyroActive
                ? 'bg-[#E30613] text-white border-red-500 shadow-red-950/60'
                : 'bg-slate-900/90 text-slate-300 border-slate-700/60 hover:text-white'
            }`}
            title="Включить гироскоп (вращение телефоном)"
          >
            <Smartphone className="w-4 h-4" />
          </button>

          {/* Кнопка авто-вращения */}
          <button
            onClick={toggleAutoRotate}
            className={`p-2 rounded-full border backdrop-blur-md shadow-xl transition-all active:scale-90 ${
              autoRotate
                ? 'bg-cyan-600 text-white border-cyan-400 shadow-cyan-950/60'
                : 'bg-slate-900/90 text-slate-300 border-slate-700/60 hover:text-white'
            }`}
            title="Авто-вращение"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          {/* Закрыть */}
          <button
            onClick={onClose}
            className="p-2 bg-slate-900/90 hover:bg-red-600 text-white rounded-full border border-slate-700/60 backdrop-blur-md shadow-xl active:scale-90 transition-colors"
            title="Закрыть 360°"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Информационный всплывающий тост при клике на инфо-хотспот */}
      {activeInfoText && (
        <div className="absolute bottom-20 left-4 right-4 z-20 max-w-sm mx-auto bg-slate-900/95 backdrop-blur-md border border-cyan-500/50 p-3 rounded-2xl shadow-2xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom duration-150">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="text-xs text-white font-medium">{activeInfoText}</span>
          </div>
          <button
            onClick={() => setActiveInfoText(null)}
            className="text-slate-400 hover:text-white p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Нижняя подсказка для мобильных устройств */}
      <div className="absolute bottom-4 left-4 right-4 z-20 pointer-events-none flex items-center justify-center">
        <div className="bg-black/60 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/10 text-[11px] text-slate-300 flex items-center gap-2">
          <span>👆 Вращайте экран пальцем или нажмите</span>
          <span className="font-bold text-[#E30613]">📱 Гироскоп</span>
        </div>
      </div>

      {/* Контейнер Pannellum */}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
};
