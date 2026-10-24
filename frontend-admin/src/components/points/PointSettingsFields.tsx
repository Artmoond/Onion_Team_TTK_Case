import { useEditorStore } from '../../store/editorStore';
import type { POI } from '../../types/venue';

interface PointSettingsFieldsProps {
  point: POI;
}

export function PointSettingsFields({ point }: PointSettingsFieldsProps) {
  const updatePoint = useEditorStore((state) => state.updatePoint);
  const beginTransaction = useEditorStore((state) => state.beginTransaction);
  const commitTransaction = useEditorStore((state) => state.commitTransaction);
  const focusProps = { onFocus: beginTransaction, onBlur: commitTransaction };

  if (point.category === 'wifi') {
    return (
      <div className="space-y-2 rounded-lg border border-cyan-900/40 bg-cyan-950/10 p-2.5">
        <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">Параметры Wi-Fi</div>
        <div>
          <label className="label">SSID</label>
          <input
            className="field"
            value={point.wifi?.ssid ?? ''}
            {...focusProps}
            onChange={(event) => updatePoint(point.id, { wifi: { ...point.wifi, ssid: event.target.value } }, false)}
            placeholder="TTK-EXPO"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Пароль</label>
            <input
              className="field font-mono"
              value={point.wifi?.password ?? ''}
              {...focusProps}
              onChange={(event) => updatePoint(point.id, { wifi: { ...point.wifi, password: event.target.value } }, false)}
              placeholder="expo2026"
            />
          </div>
          <div>
            <label className="label">Защита</label>
            <select
              className="field"
              value={point.wifi?.security ?? 'WPA2'}
              onChange={(event) =>
                updatePoint(point.id, { wifi: { ...point.wifi, security: event.target.value as 'open' | 'WPA2' | 'WPA3' | 'enterprise' } })
              }
            >
              <option value="open">Открытая</option>
              <option value="WPA2">WPA2</option>
              <option value="WPA3">WPA3</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>
        </div>
        <label className="flex items-center gap-2 text-[11px] text-slate-400">
          <input
            type="checkbox"
            checked={Boolean(point.wifi?.hidden)}
            onChange={(event) => updatePoint(point.id, { wifi: { ...point.wifi, hidden: event.target.checked } })}
          />
          Скрытая сеть
        </label>
      </div>
    );
  }

  if (point.category === 'info') {
    return (
      <div className="space-y-2 rounded-lg border border-sky-900/40 bg-sky-950/10 p-2.5">
        <div className="text-[10px] font-bold uppercase tracking-wider text-sky-400">Информация</div>
        <div>
          <label className="label">Ссылка</label>
          <input
            className="field"
            value={point.info?.link ?? ''}
            {...focusProps}
            onChange={(event) => updatePoint(point.id, { info: { ...point.info, link: event.target.value } }, false)}
            placeholder="https://…"
          />
        </div>
        <div>
          <label className="label">Расписание / режим работы</label>
          <input
            className="field"
            value={point.info?.schedule ?? ''}
            {...focusProps}
            onChange={(event) => updatePoint(point.id, { info: { ...point.info, schedule: event.target.value } }, false)}
            placeholder="09:00–20:00"
          />
        </div>
      </div>
    );
  }

  if (point.category === 'entrance') {
    return (
      <div className="space-y-2 rounded-lg border border-emerald-900/40 bg-emerald-950/10 p-2.5">
        <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Вход / выход</div>
        <div>
          <label className="label">Направление</label>
          <select
            className="field"
            value={point.entrance?.direction ?? 'both'}
            onChange={(event) =>
              updatePoint(point.id, {
                entrance: { ...point.entrance, direction: event.target.value as 'in' | 'out' | 'both' },
              })
            }
          >
            <option value="both">Вход и выход</option>
            <option value="in">Только вход</option>
            <option value="out">Только выход</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-[11px] text-slate-400">
          <input
            type="checkbox"
            checked={Boolean(point.entrance?.accessible)}
            onChange={(event) => updatePoint(point.id, { entrance: { ...point.entrance, accessible: event.target.checked } })}
          />
          Доступно для МГН
        </label>
      </div>
    );
  }

  if (point.category === 'wardrobe') {
    return (
      <div className="space-y-2 rounded-lg border border-amber-900/40 bg-amber-950/10 p-2.5">
        <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Гардероб</div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Часы работы</label>
            <input
              className="field"
              value={point.wardrobe?.openHours ?? ''}
              {...focusProps}
              onChange={(event) => updatePoint(point.id, { wardrobe: { ...point.wardrobe, openHours: event.target.value } }, false)}
              placeholder="09:00–21:00"
            />
          </div>
          <div>
            <label className="label">Вместимость</label>
            <input
              type="number"
              min={0}
              className="field"
              value={point.wardrobe?.capacity ?? ''}
              {...focusProps}
              onChange={(event) =>
                updatePoint(
                  point.id,
                  { wardrobe: { ...point.wardrobe, capacity: event.target.value ? Number(event.target.value) : undefined } },
                  false
                )
              }
            />
          </div>
        </div>
      </div>
    );
  }

  if (point.category === 'other') {
    return (
      <div className="space-y-2 rounded-lg border border-fuchsia-900/40 bg-fuchsia-950/10 p-2.5">
        <div className="text-[10px] font-bold uppercase tracking-wider text-fuchsia-400">Пользовательский тип</div>
        <div>
          <label className="label">Название типа</label>
          <input
            className="field"
            value={point.other?.label ?? ''}
            {...focusProps}
            onChange={(event) => updatePoint(point.id, { other: { ...point.other, label: event.target.value } }, false)}
            placeholder="Например, фотозона"
          />
        </div>
        <p className="text-[10px] text-slate-500">
          Расширяйте реестр типов в <span className="font-mono">src/config/pointTypes.ts</span> — холст не потребует изменений.
        </p>
      </div>
    );
  }

  return null;
}
