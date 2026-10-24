import { Layers, Plus } from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import type { Floor } from '../../types/venue';

function objectCount(floor: Floor): number {
  return (
    floor.points.length +
    (floor.walls?.length ?? 0) +
    (floor.rooms?.length ?? 0) +
    (floor.stairs?.length ?? 0) +
    floor.panoramas.length
  );
}

export function FloorTabs() {
  const venue = useEditorStore((state) => state.venue);
  const activeFloorId = useEditorStore((state) => state.activeFloorId);
  const setActiveFloor = useEditorStore((state) => state.setActiveFloor);
  const addFloor = useEditorStore((state) => state.addFloor);

  if (!venue) return null;

  return (
    <div className="z-10 flex h-11 shrink-0 items-center gap-2 overflow-x-auto border-b border-slate-800 bg-slate-900/80 px-3">
      <div className="flex shrink-0 items-center gap-1.5 pr-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
        <Layers className="h-3.5 w-3.5" /> Этажи
      </div>
      {venue.floors.map((floor) => {
        const active = floor.id === activeFloorId;
        return (
          <button
            key={floor.id}
            onClick={() => setActiveFloor(floor.id)}
            title={`${floor.name} · ${objectCount(floor)} объектов`}
            className={`flex shrink-0 items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition ${
              active
                ? 'border-cyan-500/70 bg-cyan-950/40 text-white'
                : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700 hover:bg-slate-800/70'
            }`}
          >
            <span
              className={`flex h-5 min-w-5 items-center justify-center rounded px-1 text-[9px] font-black ${
                active ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-300'
              }`}
            >
              {floor.level}
            </span>
            <span className="max-w-48 truncate text-[11px] font-semibold">{floor.name}</span>
            <span className={`shrink-0 font-mono text-[9px] ${active ? 'text-cyan-300/80' : 'text-slate-600'}`}>
              {objectCount(floor)}
            </span>
          </button>
        );
      })}
      <button
        onClick={addFloor}
        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-dashed border-slate-700 px-2.5 py-1.5 text-[11px] font-semibold text-slate-400 transition hover:border-cyan-600/60 hover:bg-cyan-950/20 hover:text-cyan-300"
        title="Добавить новый этаж"
      >
        <Plus className="h-3.5 w-3.5" /> Этаж
      </button>
    </div>
  );
}
