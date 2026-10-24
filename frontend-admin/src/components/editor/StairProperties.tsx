import { ArrowLeftRight, Footprints, Link2, Trash2, Unlink } from 'lucide-react';
import { useState } from 'react';
import { useActiveFloor, useEditorStore, useSelectedStair } from '../../store/editorStore';
import type { StairDirection } from '../../types/venue';
import { stairLengthMeters, stairWidthMeters } from '../../utils/geometry';
import { ConfirmDialog } from '../layout/ConfirmDialog';

export function StairProperties() {
  const stair = useSelectedStair();
  const floor = useActiveFloor();
  const venue = useEditorStore((state) => state.venue);
  const updateStair = useEditorStore((state) => state.updateStair);
  const deleteStair = useEditorStore((state) => state.deleteStair);
  const linkStairs = useEditorStore((state) => state.linkStairs);
  const createLinkedStair = useEditorStore((state) => state.createLinkedStair);
  const beginTransaction = useEditorStore((state) => state.beginTransaction);
  const commitTransaction = useEditorStore((state) => state.commitTransaction);
  const showToast = useEditorStore((state) => state.showToast);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [targetFloorChoice, setTargetFloorChoice] = useState('');

  if (!stair || !floor || !venue) return null;

  const otherFloors = venue.floors.filter((item) => item.id !== floor.id);
  const linkedFloor = venue.floors.find((item) => item.id === stair.targetFloorId);
  const linkedStair = venue.floors
    .flatMap((item) => item.stairs ?? [])
    .find((item) => item.id === stair.targetStairId);
  const targetFloor = otherFloors.find((item) => item.id === targetFloorChoice);
  const targetStairs = targetFloor?.stairs ?? [];
  const focus = { onFocus: beginTransaction, onBlur: commitTransaction };

  const numeric = (key: 'x1' | 'y1' | 'x2' | 'y2') => ({
    type: 'number',
    className: 'field',
    value: Math.round(stair[key]),
    ...focus,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      updateStair(stair.id, { [key]: Number(event.target.value) }, false),
  });

  const goToLinked = () => {
    if (!linkedFloor || !linkedStair) return;
    const state = useEditorStore.getState();
    state.setActiveFloor(linkedFloor.id);
    state.select({ kind: 'stair', id: linkedStair.id });
  };

  const createOnTargetFloor = () => {
    if (!targetFloor) return;
    const created = createLinkedStair(stair.id, targetFloor.id);
    if (created) showToast('success', 'Лестница создана', `${targetFloor.name} · связь установлена`);
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-400">
          <Footprints className="h-3.5 w-3.5" /> Лестница
        </div>
        <h3 className="mt-1 text-sm font-bold text-white">{stair.name}</h3>
        <p className="text-[10px] text-slate-500">
          {stairLengthMeters(stair, floor.metersPerPixel)} м · ширина {stairWidthMeters(stair, floor.metersPerPixel)} м
        </p>
      </div>

      <div>
        <label className="label">Название</label>
        <input
          className="field"
          value={stair.name}
          onFocus={beginTransaction}
          onBlur={commitTransaction}
          onChange={(event) => updateStair(stair.id, { name: event.target.value }, false)}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label">Направление</label>
          <select
            className="field"
            value={stair.direction}
            onChange={(event) => updateStair(stair.id, { direction: event.target.value as StairDirection })}
          >
            <option value="up">Вверх</option>
            <option value="down">Вниз</option>
            <option value="both">В обе стороны</option>
          </select>
        </div>
        <div>
          <label className="label">Ширина, px</label>
          <input
            type="number"
            min={10}
            className="field"
            value={Math.round(stair.width)}
            {...focus}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (Number.isFinite(value) && value > 0) updateStair(stair.id, { width: value }, false);
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label">X1</label>
          <input {...numeric('x1')} />
        </div>
        <div>
          <label className="label">Y1</label>
          <input {...numeric('y1')} />
        </div>
        <div>
          <label className="label">X2</label>
          <input {...numeric('x2')} />
        </div>
        <div>
          <label className="label">Y2</label>
          <input {...numeric('y2')} />
        </div>
      </div>

      <div className="rounded-lg border border-amber-900/40 bg-amber-950/10 p-2.5 text-[10px] text-slate-500">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-400">Длина марша</span>
          <span className="font-mono text-lg font-bold text-white">{stairLengthMeters(stair, floor.metersPerPixel)} м</span>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span>Ширина</span>
          <span className="font-mono text-slate-300">{stairWidthMeters(stair, floor.metersPerPixel)} м</span>
        </div>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5">
        <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          <Link2 className="h-3.5 w-3.5" /> Связь с этажом
        </div>

        {linkedStair && linkedFloor ? (
          <div className="space-y-2">
            <div className="rounded-md border border-emerald-900/60 bg-emerald-950/20 px-2 py-1.5">
              <div className="text-[10px] text-slate-500">Связана с</div>
              <div className="truncate text-xs font-semibold text-emerald-300">
                {linkedFloor.name} · {linkedStair.name}
              </div>
            </div>
            <div className="flex gap-2">
              <button className="btn flex-1" onClick={goToLinked}>
                <ArrowLeftRight className="h-3.5 w-3.5" /> Перейти
              </button>
              <button className="btn flex-1" onClick={() => linkStairs(stair.id, null)}>
                <Unlink className="h-3.5 w-3.5" /> Отвязать
              </button>
            </div>
          </div>
        ) : otherFloors.length === 0 ? (
          <p className="text-[10px] text-slate-500">Добавьте второй этаж, чтобы связать лестницы.</p>
        ) : (
          <div className="space-y-2">
            <div>
              <label className="label">Этаж назначения</label>
              <select
                className="field"
                value={targetFloorChoice}
                onChange={(event) => setTargetFloorChoice(event.target.value)}
              >
                <option value="">Выберите этаж</option>
                {otherFloors.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            {targetFloor && targetStairs.length > 0 && (
              <div>
                <label className="label">Лестница на этаже</label>
                <select
                  key={targetFloor.id}
                  className="field"
                  defaultValue=""
                  onChange={(event) => {
                    if (event.target.value) linkStairs(stair.id, event.target.value);
                  }}
                >
                  <option value="" disabled>
                    Выберите лестницу
                  </option>
                  {targetStairs.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {targetFloor && (
              <button className="btn w-full" onClick={createOnTargetFloor}>
                <Footprints className="h-3.5 w-3.5" />
                {targetStairs.length > 0 ? 'Создать ещё одну лестницу' : 'Создать ответную лестницу'}
              </button>
            )}
          </div>
        )}

        <p className="mt-2 text-[9px] leading-relaxed text-slate-500">
          Связанные лестницы попадут в опубликованную карту как единый переход между этажами.
        </p>
      </div>

      <button className="btn w-full border-red-900/60 text-red-300 hover:bg-red-950/40" onClick={() => setConfirmDelete(true)}>
        <Trash2 className="h-4 w-4" /> Удалить лестницу
      </button>

      <ConfirmDialog
        open={confirmDelete}
        title="Удалить лестницу?"
        text={
          linkedStair
            ? `Лестница «${stair.name}» будет удалена, а связь с «${linkedStair.name}» очистится. Вторая лестница останется на карте.`
            : `Лестница «${stair.name}» будет удалена с текущего этажа.`
        }
        confirmLabel="Удалить"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          deleteStair(stair.id);
          setConfirmDelete(false);
        }}
      />
    </div>
  );
}
