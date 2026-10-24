import React, { useState, useEffect } from 'react';
import { MousePointerClick } from 'lucide-react';

interface OnboardingHintProps {
  activeZoneId: string | null;
}

/**
 * Подсказка для первого пользователя — исчезает после первого нажатия на зону
 * или через 5 секунд автоматически.
 */
export const OnboardingHint: React.FC<OnboardingHintProps> = ({ activeZoneId }) => {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Показываем подсказку через 800ms после загрузки (даём карте нарисоваться)
  useEffect(() => {
    const show = setTimeout(() => {
      if (!dismissed) setVisible(true);
    }, 800);
    // Автоматически скрываем через 5 секунд
    const hide = setTimeout(() => {
      setVisible(false);
      setDismissed(true);
    }, 5800);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, []);

  // Скрываем при первом клике на зону
  useEffect(() => {
    if (activeZoneId) {
      setVisible(false);
      setDismissed(true);
    }
  }, [activeZoneId]);

  if (!visible || dismissed) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none z-40 flex items-center justify-center"
      aria-hidden="true"
    >
      {/* Затемнение по краям */}
      <div className="absolute inset-0 bg-gradient-radial from-transparent to-slate-950/60" />

      {/* Центральная подсказка */}
      <div
        className="relative flex flex-col items-center gap-3 animate-bounce-slow"
        style={{ animation: 'onboarding-pulse 2s ease-in-out infinite' }}
      >
        {/* Стрелки, указывающие на разные части карты */}
        <div className="flex flex-col items-center gap-2 bg-slate-900/95 border border-[#E30613]/50 rounded-2xl px-6 py-4 shadow-2xl backdrop-blur-md"
          style={{ boxShadow: '0 0 40px rgba(227, 6, 19, 0.2)' }}
        >
          <div className="flex items-center gap-2.5">
            <MousePointerClick className="w-5 h-5 text-[#E30613] shrink-0" />
            <span className="text-white font-bold text-base tracking-wide">
              Нажмите на любое помещение
            </span>
          </div>
          <span className="text-slate-400 text-xs text-center leading-relaxed">
            Залы, стенды и сервисы — всё кликабельно!
          </span>
          {/* Пульсирующий индикатор */}
          <div className="flex gap-1 mt-1">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-[#E30613]"
                style={{ animation: `pulse 1.2s ease-in-out ${i * 0.3}s infinite` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
