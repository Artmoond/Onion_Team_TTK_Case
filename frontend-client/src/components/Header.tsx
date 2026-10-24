import React, { useRef, useEffect } from 'react';
import { Search, Layers, X, Sparkles } from 'lucide-react';
import { Floor, POI } from '../types';

interface HeaderProps {
  venueTitle: string;
  floors: Floor[];
  activeFloorId: string;
  onSelectFloor: (floorId: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isBackendConnected: boolean;
  // Новые пропсы для живого поиска
  searchResults?: POI[];
  onSelectSearchResult?: (poi: POI) => void;
}

export const Header: React.FC<HeaderProps> = ({
  venueTitle,
  floors,
  activeFloorId,
  onSelectFloor,
  searchQuery,
  onSearchChange,
  searchResults = [],
  onSelectSearchResult,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  // Скрываем дропдаун при клике вне хедера
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('#header-search-wrapper')) {
        // не убираем query — пусть пользователь сам очищает
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const showDropdown = searchQuery.trim().length > 0 && searchResults.length > 0;

  return (
    <header className="relative z-50 flex flex-col bg-slate-900/95 backdrop-blur-md border-b border-slate-800 shadow-lg">
      {/* Верхняя строка с логотипом ТТК и селектором этажа */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2">
          {/* Логотип ТТК */}
          <div className="flex items-center bg-[#E30613] text-white font-black text-xs px-2 py-1 rounded shadow-md tracking-wider">
            <span>ТТК</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="max-w-[45vw] truncate font-extrabold text-sm tracking-tight text-white">{venueTitle}</span>
            <span className="text-[10px] bg-red-950/70 border border-red-500/30 text-red-400 px-1.5 py-0.2 rounded font-semibold flex items-center gap-0.5">
              <Sparkles className="w-2.5 h-2.5" /> 2026
            </span>
          </div>
        </div>

        {/* Переключатель этажей */}
        <div className="flex items-center bg-slate-800/80 p-0.5 rounded-lg border border-slate-700/60">
          {floors.map(floor => (
            <button
              key={floor.id}
              onClick={() => onSelectFloor(floor.id)}
              className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-md transition-all font-medium ${
                activeFloorId === floor.id
                  ? 'bg-[#E30613] text-white shadow font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-3 h-3" />
              <span>{floor.level} эт.</span>
            </button>
          ))}
        </div>
      </div>

      {/* Поисковая строка с live-дропдауном */}
      <div className="px-3 pb-2.5 pt-0.5 relative" id="header-search-wrapper">
        <div className="relative flex items-center">
          <Search className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && searchResults.length > 0 && onSelectSearchResult) {
                onSelectSearchResult(searchResults[0]);
                onSearchChange('');
                inputRef.current?.blur();
              }
              if (e.key === 'Escape') {
                onSearchChange('');
                inputRef.current?.blur();
              }
            }}
            placeholder="Поиск стендов, залов, кофе, WC..."
            className="w-full bg-slate-800/90 text-sm text-white placeholder-slate-400 pl-9 pr-9 py-2 rounded-xl border border-slate-700/60 focus:outline-none focus:border-[#E30613] focus:ring-1 focus:ring-[#E30613] transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 text-slate-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Live дропдаун результатов поиска */}
        {showDropdown && (
          <div className="absolute left-3 right-3 top-full mt-1 bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden z-50 max-h-52 overflow-y-auto">
            {searchResults.slice(0, 6).map(poi => (
              <button
                key={poi.id}
                onClick={() => {
                  if (onSelectSearchResult) onSelectSearchResult(poi);
                  onSearchChange('');
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-800 text-left transition-colors border-b border-slate-800/60 last:border-0"
              >
                <div className="w-2 h-2 rounded-full shrink-0 bg-[#E30613]" />
                <div>
                  <div className="text-sm text-white font-medium">{poi.name}</div>
                  {poi.description && (
                    <div className="text-xs text-slate-400 truncate max-w-[200px]">{poi.description}</div>
                  )}
                </div>
                <span className="ml-auto text-xs text-slate-500 shrink-0">→ перейти</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  );
};
