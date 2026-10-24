import { Check, Layers, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { useEditorStore } from '../../store/editorStore';
import type { Floor } from '../../types/venue';
import { ConfirmDialog } from '../layout/ConfirmDialog';

export function FloorManager() {
  const venue = useEditorStore((state) => state.venue);
  const activeFloorId = useEditorStore((state) => state.activeFloorId);
  const setActiveFloor = useEditorStore((state) => state.setActiveFloor);
  const addFloor = useEditorStore((state) => state.addFloor);
  const deleteFloor = useEditorStore((state) => state.deleteFloor);
  const updateFloorMeta = useEditorStore((state) => state.updateFloorMeta);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [toDelete, setToDelete] = useState<Floor | null>(null);

  if (!venue) return null;

  const startEdit = (floor: Floor) => {
    setEditingId(floor.id);
    setDraftName(floor.name);
  };

  const commitEdit = () => {
    if (!editingId) return;
    if (draftName.trim()) updateFloorMeta(editingId, { name: draftName.trim() });
    setEditingId(null);
  };

  const floorObjects = (floor: Floor) =>
    floor.points.length +
    (floor.walls?.length ?? 0) +
    (floor.rooms?.length ?? 0) +
    (floor.stairs?.length ?? 0) +
    floor.panoramas.length;

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          <Layers className="h-3.5 w-3.5" /> Этажи · {venue.floors.length}
        </div>
        <button className="rounded p-1 text-slate-400 transition hover:bg-slate-800 hover:text-white" onClick={addFloor} title="Добавить этаж">
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-1.5">
        {venue.floors.map((floor) => {
          const active = floor.id === activeFloorId;
          return (
            <div
              key={floor.id}
              className={`group rounded-lg border px-2.5 py-2 transition ${
                active ? 'border-cyan-600/70 bg-cyan-950/30' : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
              }`}
            >
              <div className="flex items-start gap-2">
                <button className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded bg-slate-800 text-[10px] font-black text-slate-300" onClick={() => setActiveFloor(floor.id)}>
                  {floor.level}
                </button>
                <div className="min-w-0 flex-1">
                  {editingId === floor.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        autoFocus
                        className="field py-1"
                        value={draftName}
                        onChange={(event) => setDraftName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') commitEdit();
                          if (event.key === 'Escape') setEditingId(null);
                        }}
                      />
                      <button className="rounded p-1 text-emerald-400 hover:bg-slate-800" onClick={commitEdit}>
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button className="rounded p-1 text-slate-400 hover:bg-slate-800" onClick={() => setEditingId(null)}>
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button className="block w-full text-left" onClick={() => setActiveFloor(floor.id)}>
                      <div className={`truncate text-xs font-semibold ${active ? 'text-white' : 'text-slate-300'}`}>{floor.name}</div>
                      <div className="mt-0.5 text-[10px] text-slate-500">
                        {floorObjects(floor)} объектов · {(floor.width * floor.metersPerPixel).toFixed(0)} × {(floor.height * floor.metersPerPixel).toFixed(0)} м
                      </div>
                    </button>
                  )}
                </div>
                {editingId !== floor.id && (
                  <div className="flex shrink-0 opacity-0 transition group-hover:opacity-100">
                    <button className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-white" onClick={() => startEdit(floor)} title="Переименовать">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-red-400 disabled:opacity-30"
                      onClick={() => setToDelete(floor)}
                      disabled={venue.floors.length <= 1}
                      title={venue.floors.length <= 1 ? 'Нельзя удалить единственный этаж' : 'Удалить этаж'}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Удалить этаж?"
        text={
          toDelete
            ? `Этаж «${toDelete.name}» содержит ${floorObjects(toDelete)} объектов. Действие можно отменить через Undo, но объекты этажа будут удалены из карты.`
            : ''
        }
        confirmLabel="Удалить этаж"
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) deleteFloor(toDelete.id);
          setToDelete(null);
        }}
      />
    </section>
  );
}
