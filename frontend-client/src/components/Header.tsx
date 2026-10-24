import React from 'react';
import { Search, Layers, X, Sparkles, Wifi } from 'lucide-react';
import { Floor } from '../types';

interface HeaderProps {
  floors: Floor[];
  activeFloorId: string;
  onSelectFloor: (floorId: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isBackendConnected: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  floors,
  activeFloorId,
  onSelectFloor,
  searchQuery,
  onSearchChange,
  isBackendConnected,
}) => {
  return (
    <header className="flex flex-col bg-slate-900/95 backdrop-blur-md border-b border-slate-800 z-30 shadow-lg">
      {/* Верхняя строка с логотипом ТТК и селектором этажа */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2">
          {/* Логотип ТТК */}
          <div className="flex items-center bg-[#E30613] text-white font-black text-xs px-2 py-1 rounded shadow-md tracking-wider">
            <span>ТТК</span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-sm tracking-tight text-white">Карта Пространства</span>
              <span className="text-[10px] bg-red-950/70 border border-red-500/30 text-red-400 px-1.5 py-0.2 rounded font-semibold flex items-center gap-0.5">
                <Sparkles className="w-2.5 h-2.5" /> 2026
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-slate-400">
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${isBackendConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <span>{isBackendConnected ? 'API онлайн' : 'Автономный режим'}</span>
            </div>
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

      {/* Поисковая строка */}
      <div className="px-3 pb-2.5 pt-0.5">
        <div className="relative flex items-center">
          <Search className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
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
      </div>
    </header>
  );
};
