import React from 'react';
import { PointCategory } from '../types';
import { Award, Presentation, Coffee, Bath, Wifi, HelpCircle, Layers, DoorOpen } from 'lucide-react';

interface CategoryFiltersProps {
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  categoryCounts: Record<string, number>;
}

const CATEGORIES: { id: string; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'all', label: 'Все', icon: Layers },
  { id: 'sponsor', label: 'Стенды ТТК', icon: Award },
  { id: 'hall', label: 'Залы', icon: Presentation },
  { id: 'food', label: 'Кофе & Еда', icon: Coffee },
  { id: 'wc', label: 'Санузлы', icon: Bath },
  { id: 'wifi', label: 'Wi-Fi', icon: Wifi },
  { id: 'entrance', label: 'Вход', icon: DoorOpen },
  { id: 'service', label: 'Сервис', icon: HelpCircle },
];

export const CategoryFilters: React.FC<CategoryFiltersProps> = ({
  selectedCategory,
  onSelectCategory,
  categoryCounts,
}) => {
  return (
    <div className="flex items-center space-x-1.5 px-3 py-2 bg-slate-900/90 border-b border-slate-800/80 overflow-x-auto no-scrollbar z-20 shadow-sm">
      {CATEGORIES.map(({ id, label, icon: Icon }) => {
        const isSelected = selectedCategory === id;
        const count = categoryCounts[id] ?? 0;

        // Если точек такой категории нет на этаже, можно скрыть или показать 0
        if (id !== 'all' && count === 0) return null;

        return (
          <button
            key={id}
            onClick={() => onSelectCategory(id)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full shrink-0 transition-all font-medium ${
              isSelected
                ? 'bg-[#E30613] text-white shadow-md font-bold scale-[1.02]'
                : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700/40'
            }`}
          >
            <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
            <span>{label}</span>
            {count > 0 && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  isSelected ? 'bg-black/30 text-white' : 'bg-slate-700 text-slate-300'
                }`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
