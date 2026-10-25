import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  X, 
  Camera, 
  CameraOff, 
  Upload, 
  SwitchCamera, 
  Zap, 
  ZapOff, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  Sparkles, 
  ArrowRight,
  QrCode
} from 'lucide-react';
import jsQR from 'jsqr';
import { parseQrTarget, ParsedQrResult } from '../utils/qrParser';
import { API_URL } from '../lib/auth';

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMap: (target: ParsedQrResult) => Promise<{ success: boolean; error?: string }>;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({
  isOpen,
  onClose,
  onSelectMap,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchEnabled, setTorchEnabled] = useState<boolean>(false);
  const [hasTorch, setHasTorch] = useState<boolean>(false);

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [scanStatus, setScanStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');

  const [manualSlug, setManualSlug] = useState<string>('');
  const [showManualInput, setShowManualInput] = useState<boolean>(false);

  // Список доступных опубликованных карт с бэкенда
  const [publicVenues, setPublicVenues] = useState<Array<{ slug: string; title: string }>>([
    { slug: 'ttk-expo', title: 'ТТК Экспо 2026' },
    { slug: 'test', title: 'Test' },
  ]);

  useEffect(() => {
    fetch(`${API_URL}/api/public/venues/list`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setPublicVenues(data.map((item) => ({ slug: item.slug, title: item.title || item.slug })));
        }
      })
      .catch(() => {
        // fallback to default
      });
  }, []);

  // Остановка видеопотока
  const stopMediaStream = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      setStream(null);
    }
  }, [stream]);

  // Запуск камеры
  const startCamera = useCallback(async (mode: 'environment' | 'user') => {
    setCameraError(null);
    setScanStatus('idle');
    setStatusMessage('');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Ваш браузер или контекст (требуется HTTPS) не поддерживает доступ к камере.');
      return;
    }

    // Останавливаем предыдущий стрим
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
    }

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      setStream(newStream);

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        await videoRef.current.play().catch(() => {});
      }

      // Проверка поддержки фонарика (torch)
      const track = newStream.getVideoTracks()[0];
      if (track && 'getCapabilities' in track) {
        const capabilities = (track as any).getCapabilities?.();
        setHasTorch(Boolean(capabilities?.torch));
      } else {
        setHasTorch(false);
      }
    } catch (err: any) {
      console.warn('Camera access failed:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Доступ к камере заблокирован. Разрешите использование камеры в настройках браузера или используйте фото/ручной ввод.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('Камера не обнаружена на этом устройстве.');
      } else {
        setCameraError('Не удалось запустить камеру: ' + (err.message || 'неизвестная ошибка'));
      }
    }
  }, [stream]);

  // Переключение фонарика
  const toggleTorch = async () => {
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    if (track && hasTorch) {
      try {
        const nextState = !torchEnabled;
        await (track as any).applyConstraints({
          advanced: [{ torch: nextState }],
        });
        setTorchEnabled(nextState);
      } catch (e) {
        console.warn('Torch toggle failed:', e);
      }
    }
  };

  // Переключение камеры (передняя / задняя)
  const toggleFacingMode = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  // Запуск камеры при открытии модала
  useEffect(() => {
    if (isOpen) {
      startCamera(facingMode);
    } else {
      stopMediaStream();
      setScanStatus('idle');
      setStatusMessage('');
      setIsProcessing(false);
    }

    return () => {
      stopMediaStream();
    };
  }, [isOpen]);

  // Обработка распознанного текста
  const handleQrDetected = useCallback(async (text: string) => {
    if (isProcessing) return;
    setIsProcessing(true);

    // Тактильный отклик (вибрация) на мобильных устройствах
    if (navigator.vibrate) {
      try {
        navigator.vibrate(120);
      } catch {
        // ignore
      }
    }

    const parsed = parseQrTarget(text);
    if (!parsed) {
      setScanStatus('error');
      setStatusMessage(`Не удалось определить площадку в QR-коде: "${text.slice(0, 45)}"`);
      setIsProcessing(false);
      return;
    }

    setScanStatus('success');
    setStatusMessage(`Найдена площадка «${parsed.slug}». Загружаем карту…`);

    const result = await onSelectMap(parsed);
    if (result.success) {
      // Успешно загружено — закрываем модал
      onClose();
    } else {
      setScanStatus('error');
      setStatusMessage(result.error || 'Ошибка загрузки карты с сервера');
      setIsProcessing(false);
    }
  }, [isProcessing, onSelectMap, onClose]);

  // Непрерывный цикл сканирования кадров видеопотока
  useEffect(() => {
    if (!isOpen || !stream || isProcessing || scanStatus === 'success') return;

    let animationFrameId: number;
    let lastScanTime = 0;

    const scanFrame = async (timestamp: number) => {
      // Ограничиваем частоту анализа до 1 раза в 120 мс для экономии батареи и CPU
      if (timestamp - lastScanTime > 120 && videoRef.current && videoRef.current.readyState >= 2) {
        lastScanTime = timestamp;
        const video = videoRef.current;

        // 1. Попытка использования нативного BarcodeDetector (быстрее в Chrome/Edge/Android)
        if ('BarcodeDetector' in window) {
          try {
            const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
            const barcodes = await detector.detect(video);
            if (barcodes && barcodes.length > 0 && barcodes[0]?.rawValue) {
              handleQrDetected(barcodes[0].rawValue);
              return;
            }
          } catch {
            // fallback к jsQR
          }
        }

        // 2. Универсальный jsQR сканер через Canvas
        if (canvasRef.current) {
          const canvas = canvasRef.current;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 480;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'attemptBoth',
            });

            if (code && code.data) {
              handleQrDetected(code.data);
              return;
            }
          }
        }
      }

      animationFrameId = requestAnimationFrame(scanFrame);
    };

    animationFrameId = requestAnimationFrame(scanFrame);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isOpen, stream, isProcessing, scanStatus, handleQrDetected]);

  // Загрузка фото/скриншота с QR-кодом
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setScanStatus('idle');
    setStatusMessage('Анализ загруженного изображения…');

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setIsProcessing(false);
          return;
        }
        ctx.drawImage(img, 0, 0, img.width, img.height);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth',
        });

        if (code && code.data) {
          handleQrDetected(code.data);
        } else {
          setIsProcessing(false);
          setScanStatus('error');
          setStatusMessage('На этом фото QR-код не найден. Попробуйте более чёткий снимок или введите название карты вручную.');
        }
      };
      img.onerror = () => {
        setIsProcessing(false);
        setScanStatus('error');
        setStatusMessage('Не удалось прочитать файл изображения.');
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    // сбрасываем input
    e.target.value = '';
  };

  // Ручной переход по slug
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualSlug.trim()) return;
    handleQrDetected(manualSlug.trim());
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: '92vh' }}
      >
        {/* Верхняя шапка */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-red-500 to-[#E30613] flex items-center justify-center shadow-lg shadow-red-950/50">
              <QrCode className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-1.5">
                Сканировать QR-код
                <span className="text-[10px] bg-red-950/80 border border-red-500/30 text-red-400 px-1.5 py-0.5 rounded font-mono">
                  ТТК
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Наведите камеру на QR-код карты или стенда
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
            title="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Область видоискателя камеры */}
        <div className="relative w-full aspect-square bg-black overflow-hidden flex items-center justify-center">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              cameraError ? 'opacity-20' : 'opacity-100'
            }`}
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Визуальная рамка сканирования */}
          {!cameraError && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-8">
              {/* Рамка прицела */}
              <div className="relative w-56 h-56 sm:w-64 sm:h-64 rounded-2xl border-2 border-red-500/40 shadow-[0_0_0_9999px_rgba(15,23,42,0.65)]">
                {/* Угловые акцентные скобки */}
                <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-[#E30613] rounded-tl-lg" />
                <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-[#E30613] rounded-tr-lg" />
                <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-[#E30613] rounded-bl-lg" />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-[#E30613] rounded-br-lg" />

                {/* Бегущий луч сканера */}
                <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-[#E30613] to-transparent shadow-[0_0_12px_#E30613] animate-pulse top-1/2 -translate-y-1/2" />

                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-10 h-10 border border-red-500/20 rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-[#E30613]/50 animate-ping" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Плавающие кнопки управления камерой */}
          {!cameraError && (
            <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
              {hasTorch && (
                <button
                  onClick={toggleTorch}
                  className={`p-2 rounded-full backdrop-blur-md border transition-all ${
                    torchEnabled 
                      ? 'bg-amber-500/90 text-white border-amber-400 shadow-lg shadow-amber-950/50' 
                      : 'bg-slate-900/70 text-slate-300 border-slate-700/60 hover:text-white'
                  }`}
                  title={torchEnabled ? 'Выключить фонарик' : 'Включить фонарик'}
                >
                  {torchEnabled ? <Zap className="w-4 h-4 fill-white" /> : <ZapOff className="w-4 h-4" />}
                </button>
              )}
              <button
                onClick={toggleFacingMode}
                className="p-2 rounded-full bg-slate-900/70 backdrop-blur-md text-slate-300 border border-slate-700/60 hover:text-white transition-all shadow"
                title="Переключить камеру"
              >
                <SwitchCamera className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Сообщение об ошибке камеры */}
          {cameraError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-950/90 z-20">
              <CameraOff className="w-12 h-12 text-slate-500 mb-3" />
              <p className="text-xs text-slate-300 max-w-xs mb-4 leading-relaxed">
                {cameraError}
              </p>
              <button
                onClick={() => startCamera(facingMode)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-all flex items-center gap-1.5"
              >
                <Camera className="w-3.5 h-3.5" /> Попробовать снова
              </button>
            </div>
          )}

          {/* Оверлей при успехе / загрузке */}
          {isProcessing && (
            <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-30 animate-in fade-in">
              {scanStatus === 'success' ? (
                <>
                  <div className="w-14 h-14 rounded-full bg-emerald-950/80 border-2 border-emerald-500 flex items-center justify-center mb-3 animate-bounce">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                  </div>
                  <h3 className="text-sm font-bold text-white mb-1">Код успешно распознан!</h3>
                  <p className="text-xs text-emerald-400 font-medium max-w-xs">{statusMessage}</p>
                </>
              ) : scanStatus === 'error' ? (
                <>
                  <div className="w-14 h-14 rounded-full bg-red-950/80 border-2 border-red-500 flex items-center justify-center mb-3">
                    <AlertCircle className="w-8 h-8 text-red-400" />
                  </div>
                  <h3 className="text-sm font-bold text-white mb-1">Ошибка</h3>
                  <p className="text-xs text-red-300 mb-4 max-w-xs">{statusMessage}</p>
                  <button
                    onClick={() => {
                      setIsProcessing(false);
                      setScanStatus('idle');
                      setStatusMessage('');
                    }}
                    className="px-4 py-2 bg-[#E30613] hover:bg-red-600 text-white text-xs font-bold rounded-xl shadow-lg transition-all"
                  >
                    Сканировать заново
                  </button>
                </>
              ) : (
                <>
                  <Loader2 className="w-10 h-10 text-[#E30613] animate-spin mb-3" />
                  <p className="text-xs text-slate-300 font-medium">{statusMessage || 'Обработка данных…'}</p>
                </>
              )}
            </div>
          )}
        </div>

        {/* Блок действий: загрузка фото или ввод вручную */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />

          <div className="flex gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-slate-800 hover:bg-slate-700/80 active:scale-95 text-xs font-semibold text-slate-200 rounded-xl border border-slate-700 transition-all disabled:opacity-50"
            >
              <Upload className="w-4 h-4 text-red-400" />
              <span>Загрузить фото QR</span>
            </button>

            <button
              onClick={() => setShowManualInput(!showManualInput)}
              className="px-3 py-2.5 bg-slate-800/80 hover:bg-slate-700/80 text-xs font-semibold text-slate-300 rounded-xl border border-slate-700/70 transition-all"
            >
              {showManualInput ? 'Скрыть ввод' : 'Ввести вручную'}
            </button>
          </div>

          {/* Форма ручного ввода slug или URL */}
          {showManualInput && (
            <form onSubmit={handleManualSubmit} className="pt-2 animate-in slide-in-from-top-2 duration-150">
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={manualSlug}
                  onChange={(e) => setManualSlug(e.target.value)}
                  placeholder="Например: ttk-expo или ссылка"
                  className="flex-1 bg-slate-800 text-xs text-white placeholder-slate-500 px-3 py-2.5 rounded-xl border border-slate-700 focus:outline-none focus:border-[#E30613] focus:ring-1 focus:ring-[#E30613] transition-all"
                />
                <button
                  type="submit"
                  disabled={!manualSlug.trim() || isProcessing}
                  className="px-3.5 py-2.5 bg-[#E30613] hover:bg-red-600 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1"
                >
                  <span>Открыть</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          )}

          {/* Быстрый выбор доступных опубликованных карт */}
          <div className="pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
              <span className="font-semibold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-[#E30613]" /> Выбрать карту:
              </span>
              <span className="text-[10px] text-slate-500">или наведите камеру на QR</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {publicVenues.map((v) => (
                <button
                  key={v.slug}
                  onClick={() => handleQrDetected(v.slug)}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 hover:text-white rounded-xl text-xs font-medium border border-slate-700/80 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <span className="font-bold text-white">{v.title}</span>
                  <span className="text-[10px] text-red-400 font-mono">({v.slug})</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
