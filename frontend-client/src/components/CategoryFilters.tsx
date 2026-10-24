import React from 'react';
import { Award, Presentation, Coffee, Bath, Wifi, HelpCircle, DoorOpen, X } from 'lucide-react';

interface CategoryFiltersProps {
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  categoryCounts: Record<string, number>;
}

const CATEGORIES = [
  { id: 'sponsor', label: 'Стенды ТТК', icon: Award },
  { id: 'hall', label: 'Залы', icon: Presentation },
  { id: 'food', label: 'Кофе & Еда', icon: Coffee },
  { id: 'wc', label: 'Санузлы', icon: Bath },
  { id: 'wifi', label: 'Wi-Fi 6', icon: Wifi },
  { id: 'entrance', label: 'Вход', icon: DoorOpen },
  { id: 'service', label: 'Сервис', icon: HelpCircle },
];

export const CategoryFilters: React.FC<CategoryFiltersProps> = ({
  selectedCategory,
  onSelectCategory,
  categoryCounts,
}) => {
  const isAnyActive = selectedCategory !== 'all';

  return (
    <div className="flex flex-col gap-1.5 bg-slate-900/95 backdrop-blur-md p-2 rounded-2xl border border-slate-700/80 shadow-2xl">
      <div className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 select-none">
        Категории
      </div>
      {CATEGORIES.map(({ id, label, icon: Icon }) => {
        const isSelected = selectedCategory === id;
        const count = categoryCounts[id] ?? 0;

        // Если точек такой категории нет на этаже, скрываем
        if (count === 0) return null;

        return (
          <button
            key={id}
            onClick={() => onSelectCategory(isSelected ? 'all' : id)}
            className={`group flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 select-none ${
              isSelected
                ? 'bg-[#E30613] text-white shadow-lg shadow-red-900/50 font-bold scale-[1.02]'
                : 'bg-slate-800/80 hover:bg-slate-700/90 text-slate-300 hover:text-white border border-slate-700/40'
            }`}
            title={`${label} (${count})`}
          >
            <div className="flex items-center gap-2">
              <Icon
                className={`w-4 h-4 shrink-0 transition-colors ${
                  isSelected ? 'text-white' : 'text-slate-400 group-hover:text-white'
                }`}
              />
              <span className="whitespace-nowrap">{label}</span>
            </div>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-1 transition-colors ${
                isSelected ? 'bg-black/30 text-white' : 'bg-slate-700/90 text-slate-300'
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}

      {isAnyActive && (
        <button
          onClick={() => onSelectCategory('all')}
          className="flex items-center justify-center gap-1.5 px-2 py-1.5 mt-1 rounded-xl text-[11px] font-semibold text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700/50 transition-colors active:scale-95"
          title="Сбросить подсветку"
        >
          <X className="w-3.5 h-3.5 text-red-400" />
          <span>Сбросить</span>
        </button>
      )}
    </div>
  );
};
