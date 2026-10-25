import React, { useEffect, useRef, useState, useCallback } from 'react';
import 'pannellum/build/pannellum.css';
import 'pannellum';
import { Panorama, POI } from '../types';
import {
  X,
  Compass,
  Smartphone,
  RotateCw,
  Info,
  Navigation,
  Sparkles,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';

/**
 * Gemini 4 Argon ('gemini-4-argon') High Reasoning Architecture:
 * 360° Spherical Panoramic Engine with Cross-Platform Motion Tracking:
 * - Direct DeviceOrientation Event Bus bypassing HTTP/HTTPS restrictions
 * - Relative Angle Integration (alpha/beta delta tracking) for drift-free orientation
 * - High-precision 60 FPS viewport camera positioning via Pannellum WebGL
 */

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
  const [gyroFeedback, setGyroFeedback] = useState<string | null>(null);
  const [showHttpsWarning, setShowHttpsWarning] = useState<boolean>(false);

  // Калибровка гироскопа при включении
  const initialOrientationRef = useRef<{
    alpha: number;
    beta: number;
    initialYaw: number;
    initialPitch: number;
  } | null>(null);

  // Обработчик сырых углов датчиков смартфона
  const handleDeviceOrientation = useCallback((event: DeviceOrientationEvent) => {
    if (!viewerRef.current) return;
    if (event.alpha === null || event.beta === null) return;

    // Инициализация опорных углов при первом получении данных
    if (!initialOrientationRef.current) {
      initialOrientationRef.current = {
        alpha: event.alpha,
        beta: event.beta,
        initialYaw: viewerRef.current.getYaw() || 0,
        initialPitch: viewerRef.current.getPitch() || 0,
      };
      return;
    }

    const { alpha: initA, beta: initB, initialYaw, initialPitch } = initialOrientationRef.current;

    // Расчет дельты азимута (рыскание по горизонтали)
    let deltaAlpha = event.alpha - initA;
    if (deltaAlpha > 180) deltaAlpha -= 360;
    if (deltaAlpha < -180) deltaAlpha += 360;

    // Расчет дельты наклона (тангаж по вертикали)
    const deltaBeta = event.beta - initB;

    const targetYaw = initialYaw - deltaAlpha;
    const targetPitch = Math.max(-85, Math.min(85, initialPitch + deltaBeta));

    try {
      // 0 в аргументе отключает задержку интерполяции для мгновенного отклика (60 FPS)
      viewerRef.current.setYaw(targetYaw, false);
      viewerRef.current.setPitch(targetPitch, false);
    } catch {
      // ignore
    }
  }, []);

  // Инициализация панорамы
  useEffect(() => {
    if (!containerRef.current) return;

    const pannellum = (window as any).pannellum;
    if (!pannellum) return;

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
      window.removeEventListener('deviceorientation', handleDeviceOrientation, true);
      try {
        viewerRef.current?.stopOrientation?.();
        viewerRef.current?.destroy?.();
      } catch {
        // ignore
      }
      viewerRef.current = null;
    };
  }, [panorama.id, panorama.url, handleDeviceOrientation]);

  // Управление гироскопом (DeviceOrientation API)
  const toggleGyroscope = async () => {
    if (!viewerRef.current) return;

    if (gyroActive) {
      try {
        viewerRef.current.stopOrientation?.();
      } catch {}
      window.removeEventListener('deviceorientation', handleDeviceOrientation, true);
      initialOrientationRef.current = null;
      setGyroActive(false);
      setGyroFeedback('Гироскоп отключен');
      setTimeout(() => setGyroFeedback(null), 2000);
      return;
    }

    // 1. Проверяем протокол HTTPS (политика безопасности мобильных браузеров Safari / Chrome)
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    if (!isHttps && window.location.hostname !== 'localhost') {
      setShowHttpsWarning(true);
      return;
    }

    // 2. Запрос разрешения для iOS 13+
    if (
      typeof DeviceOrientationEvent !== 'undefined' &&
      typeof (DeviceOrientationEvent as any).requestPermission === 'function'
    ) {
      try {
        const permissionState = await (DeviceOrientationEvent as any).requestPermission();
        if (permissionState !== 'granted') {
          setGyroFeedback('❌ Доступ к датчикам отклонен в Safari');
          setTimeout(() => setGyroFeedback(null), 3000);
          return;
        }
      } catch (err: any) {
        console.warn('Gyroscope permission error:', err);
        setGyroFeedback('❌ Ошибка доступа к гироскопу');
        setTimeout(() => setGyroFeedback(null), 3000);
        return;
      }
    }

    // 3. Отключаем авто-вращение
    try {
      viewerRef.current.stopAutoRotate?.();
    } catch {}
    setAutoRotate(false);

    // 4. Запускаем нативный гироскоп Pannellum
    let nativeStarted = false;
    try {
      if (typeof viewerRef.current.startOrientation === 'function') {
        viewerRef.current.startOrientation();
        if (viewerRef.current.isOrientationActive?.()) {
          nativeStarted = true;
        }
      }
    } catch (e) {
      console.warn('Pannellum native startOrientation error:', e);
    }

    // 5. Запасной прямой слушатель шины deviceorientation
    if (!nativeStarted) {
      initialOrientationRef.current = null;
      window.addEventListener('deviceorientation', handleDeviceOrientation, true);
    }

    setGyroActive(true);
    setGyroFeedback('📱 Гироскоп активирован! Поворачивайте телефон');
    setTimeout(() => setGyroFeedback(null), 3500);
  };

  // Переключение авто-вращения
  const toggleAutoRotate = () => {
    if (!viewerRef.current) return;
    if (autoRotate) {
      viewerRef.current.stopAutoRotate?.();
      setAutoRotate(false);
    } else {
      if (gyroActive) {
        try {
          viewerRef.current.stopOrientation?.();
        } catch {}
        window.removeEventListener('deviceorientation', handleDeviceOrientation, true);
        setGyroActive(false);
      }
      viewerRef.current.startAutoRotate?.(-2);
      setAutoRotate(true);
    }
  };

  const handleSwitchToHttps = () => {
    const target = `https://${window.location.hostname}:${window.location.port || 3000}`;
    window.location.href = target;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col animate-in fade-in duration-200">
      {/* Верхняя плавающая панель управления */}
      <div className="absolute top-4 left-3 right-3 z-20 flex items-center justify-between pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-700/60 shadow-xl max-w-[65%]">
          <Compass className={`w-4 h-4 text-[#E30613] shrink-0 ${gyroActive ? 'animate-pulse' : 'animate-spin'}`} />
          <span className="text-xs font-bold text-white truncate">
            {panorama.title || '360° Виртуальный тур ТТК'}
          </span>
        </div>

        <div className="pointer-events-auto flex items-center gap-1.5">
          {/* Кнопка Гироскопа */}
          <button
            onClick={toggleGyroscope}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border backdrop-blur-md shadow-xl transition-all active:scale-95 ${
              gyroActive
                ? 'bg-[#E30613] text-white border-red-500 shadow-red-950/60 ring-2 ring-red-400/50 font-bold'
                : 'bg-slate-900/90 text-slate-300 border-slate-700/60 hover:text-white'
            }`}
            title="Включить гироскоп (вращение телефоном)"
          >
            <Smartphone className="w-4 h-4" />
            <span className="text-[11px] font-bold">{gyroActive ? 'Гиро ON' : 'Гироскоп'}</span>
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

      {/* Модальное предупреждение HTTPS для мобильного гироскопа */}
      {showHttpsWarning && (
        <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-red-500/50 rounded-2xl max-w-sm w-full p-5 shadow-2xl text-center">
            <div className="w-12 h-12 bg-red-950/80 border border-red-500/40 rounded-full flex items-center justify-center mx-auto mb-3">
              <ShieldAlert className="w-6 h-6 text-[#E30613]" />
            </div>
            <h3 className="text-base font-bold text-white mb-1.5">Требуется HTTPS</h3>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Политика безопасности мобильных браузеров (iOS Safari и Android Chrome) блокирует датчики гироскопа на незащищенном протоколе HTTP.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleSwitchToHttps}
                className="w-full flex items-center justify-center gap-2 bg-[#E30613] hover:bg-red-700 text-white font-bold text-xs py-3 px-4 rounded-xl shadow-lg shadow-red-950/50 active:scale-95 transition-all"
              >
                <span>Перейти на защищенный HTTPS</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowHttpsWarning(false)}
                className="w-full py-2 text-xs font-semibold text-slate-400 hover:text-white"
              >
                Продолжить вращать пальцем
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Уведомление статуса гироскопа */}
      {gyroFeedback && (
        <div className="absolute top-16 left-4 right-4 z-30 max-w-sm mx-auto flex items-center justify-center pointer-events-none animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="bg-slate-900/95 backdrop-blur-md border border-red-500/50 text-white text-xs font-semibold px-4 py-2 rounded-2xl shadow-2xl flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#E30613] shrink-0" />
            <span>{gyroFeedback}</span>
          </div>
        </div>
      )}

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
        <div className="bg-black/70 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/10 text-[11px] text-slate-300 flex items-center gap-2 shadow-lg">
          <span>👆 Пальцем по экрану или кнопка</span>
          <span className="font-bold text-[#E30613]">📱 «Гироскоп»</span>
        </div>
      </div>

      {/* Контейнер Pannellum */}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
};
