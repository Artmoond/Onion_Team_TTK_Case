import { Compass, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useActiveFloor, useEditorStore, useSelectedRoom } from '../../store/editorStore';
import { polygonAreaMeters } from '../../utils/geometry';
import { ConfirmDialog } from '../layout/ConfirmDialog';

export function RoomProperties() {
  const room = useSelectedRoom();
  const floor = useActiveFloor();
  const updateRoom = useEditorStore((state) => state.updateRoom);
  const deleteRoom = useEditorStore((state) => state.deleteRoom);
  const beginTransaction = useEditorStore((state) => state.beginTransaction);
  const commitTransaction = useEditorStore((state) => state.commitTransaction);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!room || !floor) return null;

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-sky-400">
          <Compass className="h-3.5 w-3.5" /> Помещение
        </div>
        <h3 className="mt-1 text-sm font-bold text-white">{room.name}</h3>
        <p className="text-[10px] text-slate-500">
          {room.points.length} вершин · {polygonAreaMeters(room.points, floor.metersPerPixel)} м²
        </p>
      </div>

      <div>
        <label className="label">Название</label>
        <input
          className="field"
          value={room.name}
          onFocus={beginTransaction}
          onBlur={commitTransaction}
          onChange={(event) => updateRoom(room.id, { name: event.target.value }, false)}
        />
      </div>

      <div>
        <label className="label">Описание</label>
        <textarea
          className="field min-h-20 resize-none"
          value={room.description ?? ''}
          onFocus={beginTransaction}
          onBlur={commitTransaction}
          onChange={(event) => updateRoom(room.id, { description: event.target.value }, false)}
        />
      </div>

      <div>
        <label className="label">Цвет контура</label>
        <div className="flex items-center gap-2">
          <input type="color" className="h-9 w-12 cursor-pointer rounded border border-slate-700 bg-slate-900 p-1" value={room.color ?? '#0ea5e9'} onChange={(event) => updateRoom(room.id, { color: event.target.value })} />
          <input className="field font-mono" value={room.color ?? '#0ea5e9'} onFocus={beginTransaction} onBlur={commitTransaction} onChange={(event) => updateRoom(room.id, { color: event.target.value }, false)} />
        </div>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5 text-[10px] text-slate-500">
        <div className="font-semibold text-slate-400">Площадь</div>
        <div className="mt-1 font-mono text-lg font-bold text-white">{polygonAreaMeters(room.points, floor.metersPerPixel)} м²</div>
        <p className="mt-1">Площадь рассчитывается по полигону и калибровке этажа.</p>
      </div>

      <button className="btn w-full border-red-900/60 text-red-300 hover:bg-red-950/40" onClick={() => setConfirmDelete(true)}>
        <Trash2 className="h-4 w-4" /> Удалить помещение
      </button>

      <ConfirmDialog
        open={confirmDelete}
        title="Удалить помещение?"
        text={`Помещение «${room.name}» будет удалено, стены и точки останутся.`}
        confirmLabel="Удалить"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          deleteRoom(room.id);
          setConfirmDelete(false);
        }}
      />
    </div>
  );
}
