import { Ruler, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useActiveFloor, useEditorStore, useSelectedWall } from '../../store/editorStore';
import { pixelDistance } from '../../utils/geometry';
import { ConfirmDialog } from '../layout/ConfirmDialog';

export function WallProperties() {
  const wall = useSelectedWall();
  const floor = useActiveFloor();
  const updateWall = useEditorStore((state) => state.updateWall);
  const deleteWall = useEditorStore((state) => state.deleteWall);
  const beginTransaction = useEditorStore((state) => state.beginTransaction);
  const commitTransaction = useEditorStore((state) => state.commitTransaction);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!wall || !floor) return null;
  const pixels = pixelDistance(wall.x1, wall.y1, wall.x2, wall.y2);
  const focus = { onFocus: beginTransaction, onBlur: commitTransaction };

  const numeric = (key: 'x1' | 'y1' | 'x2' | 'y2') => ({
    type: 'number',
    className: 'field',
    value: Math.round(wall[key]),
    ...focus,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      updateWall(wall.id, { [key]: Number(event.target.value) }, false),
  });

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-cyan-400">
          <Ruler className="h-3.5 w-3.5" /> Стена
        </div>
        <h3 className="mt-1 text-sm font-bold text-white">{wall.lengthMeters} м</h3>
        <p className="text-[10px] text-slate-500">
          {pixels.toFixed(1)} px · масштаб {floor.metersPerPixel} м/px
        </p>
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

      <div className="rounded-lg border border-cyan-900/40 bg-cyan-950/10 p-2.5">
        <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">Вычисленная длина</div>
        <div className="mt-1 font-mono text-lg font-bold text-white">{wall.lengthMeters} м</div>
        <p className="mt-1 text-[10px] text-slate-500">
          Длина = пиксельное расстояние × масштаб этажа. Измените масштаб в свойствах этажа или откалибруйте его инструментом «Масштаб».
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label">Толщина, px</label>
          <input
            type="number"
            min={1}
            className="field"
            value={wall.thickness ?? 4}
            onFocus={beginTransaction}
            onBlur={commitTransaction}
            onChange={(event) => updateWall(wall.id, { thickness: Number(event.target.value) }, false)}
          />
        </div>
        <div>
          <label className="label">Тип</label>
          <select className="field" value={wall.kind ?? 'wall'} onChange={(event) => updateWall(wall.id, { kind: event.target.value as 'wall' | 'partition' | 'boundary' })}>
            <option value="wall">Стена</option>
            <option value="partition">Перегородка</option>
            <option value="boundary">Граница</option>
          </select>
        </div>
      </div>

      <button className="btn w-full border-red-900/60 text-red-300 hover:bg-red-950/40" onClick={() => setConfirmDelete(true)}>
        <Trash2 className="h-4 w-4" /> Удалить стену
      </button>

      <ConfirmDialog
        open={confirmDelete}
        title="Удалить стену?"
        text="Стена будет удалена с текущего этажа."
        confirmLabel="Удалить"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          deleteWall(wall.id);
          setConfirmDelete(false);
        }}
      />
    </div>
  );
}
