import React, { useState } from 'react';
import { POI, Floor } from '../types';
import {
  Navigation,
  Eye,
  X,
  Share2,
  Check,
  MapPin,
  Sparkles,
  Award,
  Presentation,
  Coffee,
  Bath,
  Wifi,
  DoorOpen
} from 'lucide-react';

interface PoiSheetProps {
  poi: POI | null;
  floor: Floor;
  onClose: () => void;
  onBuildRoute: (poi: POI) => void;
  onOpenPanorama: (panoId: string) => void;
}

export const PoiSheet: React.FC<PoiSheetProps> = ({
  poi,
  floor,
  onClose,
  onBuildRoute,
  onOpenPanorama,
}) => {
  const [copied, setCopied] = useState<boolean>(false);

  if (!poi) return null;

  // Поиск связанной панорамы
  const linkedPano = poi.panoramaId
    ? floor.panoramas.find(p => p.id === poi.panoramaId)
    : floor.panoramas[0];

  const handleCopyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?poi=${poi.id}`;
    navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'sponsor':
        return { label: 'Стенд ТТК', color: 'bg-red-950/80 text-red-300 border-red-500/30' };
      case 'hall':
        return { label: 'Конференц-зал', color: 'bg-indigo-950/80 text-indigo-300 border-indigo-500/30' };
      case 'food':
        return { label: 'Кофе & Еда', color: 'bg-amber-950/80 text-amber-300 border-amber-500/30' };
      case 'wc':
        return { label: 'Санузел', color: 'bg-cyan-950/80 text-cyan-300 border-cyan-500/30' };
      case 'wifi':
        return { label: 'Wi-Fi 6', color: 'bg-blue-950/80 text-blue-300 border-blue-500/30' };
      default:
        return { label: 'Сервис', color: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/30' };
    }
  };

  const badge = getCategoryBadge(poi.category);

  return (
    <div className="absolute bottom-0 left-0 right-0 z-30 bg-slate-900/98 backdrop-blur-xl border-t border-slate-700/80 rounded-t-3xl shadow-2xl p-4 sm:p-5 max-w-lg mx-auto transition-transform animate-in slide-in-from-bottom duration-200">
      {/* Декоративная полоса перетаскивания шторки */}
      <div className="w-12 h-1.5 bg-slate-700/80 rounded-full mx-auto mb-3" />

      {/* Верхняя строка: Категория, Этаж и Кнопка закрытия */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${badge.color}`}>
            {badge.label}
          </span>
          <span className="text-[11px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md flex items-center gap-1">
            <MapPin className="w-3 h-3 text-[#E30613]" /> {floor.name.split('—')[0].trim()}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleCopyLink}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
            title="Скопировать ссылку"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
          </button>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Заголовок и описание */}
      <h2 className="text-lg font-black text-white tracking-tight leading-snug mb-1.5">
        {poi.name}
      </h2>
      <p className="text-xs text-slate-300 leading-relaxed mb-4">
        {poi.description || 'Точка интереса на плане пространства.'}
      </p>

      {/* Теги */}
      {poi.tags && poi.tags.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap mb-4">
          {poi.tags.map(t => (
            <span key={t} className="text-[10px] text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-md">
              #{t}
            </span>
          ))}
        </div>
      )}

      {/* Кнопки действий */}
      <div className="grid grid-cols-2 gap-2.5">
        <button
          onClick={() => onBuildRoute(poi)}
          className="flex items-center justify-center gap-2 bg-[#E30613] hover:bg-red-700 active:scale-95 text-white font-bold text-xs py-3 px-4 rounded-xl shadow-lg shadow-red-950/50 transition-all"
        >
          <Navigation className="w-4 h-4" />
          <span>Маршрут сюда</span>
        </button>

        {linkedPano ? (
          <button
            onClick={() => onOpenPanorama(linkedPano.id)}
            className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-cyan-300 border border-cyan-500/30 font-bold text-xs py-3 px-4 rounded-xl transition-all"
          >
            <Eye className="w-4 h-4 text-cyan-400" />
            <span>Обзор 360°</span>
          </button>
        ) : (
          <button
            disabled
            className="flex items-center justify-center gap-2 bg-slate-800/50 text-slate-500 font-bold text-xs py-3 px-4 rounded-xl cursor-not-allowed"
          >
            <span>Панорама недоступна</span>
          </button>
        )}
      </div>
    </div>
  );
};
