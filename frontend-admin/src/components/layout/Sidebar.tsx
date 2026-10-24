import {
  BoxSelect,
  CircleDot,
  Footprints,
  Hand,
  MousePointer2,
  PencilRuler,
  Ruler,
  Square,
  Trash2,
} from 'lucide-react';
import { POINT_TYPE_LIST } from '../../config/pointTypes';
import { useState } from 'react';
import { useEditorStore, useActiveFloor } from '../../store/editorStore';
import { ConfirmDialog } from '../layout/ConfirmDialog';
import type { EditorTool } from '../../types/venue';
import { polygonAreaMeters, round, stairLengthMeters } from '../../utils/geometry';
import { FloorManager } from '../floors/FloorManager';

const tools: { id: EditorTool; label: string; icon: typeof MousePointer2; hint: string }[] = [
  { id: 'select', label: 'Выбор', icon: MousePointer2, hint: 'Выбор и перемещение объектов' },
  { id: 'pan', label: 'Панорама', icon: Hand, hint: 'Перемещение рабочей области' },
  { id: 'wall', label: 'Стена', icon: Ruler, hint: 'Клик — следующая точка, Enter — завершить цепочку' },
  { id: 'stairs', label: 'Лестница', icon: Footprints, hint: 'Два клика — начало и конец марша' },
  { id: 'room', label: 'Помещение', icon: Square, hint: 'Клики по вершинам, завершение — двойной клик' },
  { id: 'calibrate', label: 'Масштаб', icon: PencilRuler, hint: 'Два клика по известному отрезку' },
];

export function Sidebar() {
  const venue = useEditorStore((state) => state.venue);
  const floor = useActiveFloor();
  const tool = useEditorStore((state) => state.tool);
  const pointCategory = useEditorStore((state) => state.pointCategory);
  const setTool = useEditorStore((state) => state.setTool);
  const setPointCategory = useEditorStore((state) => state.setPointCategory);
  const selection = useEditorStore((state) => state.selection);
  const select = useEditorStore((state) => state.select);
  const clearFloorObjects = useEditorStore((state) => state.clearFloorObjects);
  const [confirmClear, setConfirmClear] = useState(false);

  if (!venue || !floor) return null;

  const choosePointType = (category: (typeof POINT_TYPE_LIST)[number]['category']) => {
    setPointCategory(category);
    setTool('point');
  };

  const wallCount = floor.walls?.length ?? 0;
  const roomCount = floor.rooms?.length ?? 0;
  const stairCount = floor.stairs?.length ?? 0;

  return (
    <aside className="z-10 flex w-72 shrink-0 flex-col border-r border-slate-800 bg-slate-900">
      <div className="flex-1 space-y-5 overflow-y-auto p-3">
        <section>
          <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Инструменты</div>
          <div className="grid grid-cols-2 gap-1.5">
            {tools.map((item) => {
              const Icon = item.icon;
              const active = tool === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setTool(item.id)}
                  title={item.hint}
                  className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-[11px] font-semibold transition ${
                    active
                      ? 'border-brand/60 bg-brand/15 text-white'
                      : 'border-slate-800 bg-slate-800/50 text-slate-300 hover:border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${active ? 'text-brand' : 'text-slate-500'}`} />
                  {item.label}
                </button>
              );
            })}
          </div>
          <p className="mt-2 rounded-md border border-cyan-900/50 bg-cyan-950/20 px-2 py-1.5 text-[10px] leading-relaxed text-cyan-300/80">
            {tool === 'point'
              ? 'Кликните по плану, чтобы добавить выбранный тип точки.'
              : tool === 'wall'
                ? 'Клик 1 — начало, каждый следующий клик продолжает цепочку. Enter или двойной клик — завершить.'
                : tool === 'stairs'
                  ? 'Клик 1 — начало марша, клик 2 — конец. Ширину и связь с этажом задайте в свойствах.'
                  : tool === 'room'
                  ? 'Кликайте по вершинам помещения, завершите двойным кликом или Enter.'
                  : tool === 'calibrate'
                    ? 'Кликните две точки известного отрезка, затем укажите реальную длину.'
                    : tools.find((item) => item.id === tool)?.hint}
          </p>
        </section>

        <FloorManager />

        <section>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Тип точки</div>
            <CircleDot className="h-3.5 w-3.5 text-slate-600" />
          </div>
          <div className="grid grid-cols-2 gap-1">
            {POINT_TYPE_LIST.map((type) => {
              const Icon = type.icon;
              const active = tool === 'point' && pointCategory === type.category;
              return (
                <button
                  key={type.category}
                  onClick={() => choosePointType(type.category)}
                  title={type.description}
                  className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-left text-[10px] font-semibold transition ${
                    active ? 'border-cyan-500/60 bg-cyan-950/40 text-white' : 'border-transparent text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: type.color }} />
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{type.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <span>Точки · {floor.points.length}</span>
          </div>
          <div className="space-y-1">
            {floor.points.length === 0 && <p className="px-1 py-2 text-[10px] text-slate-600">Точек пока нет.</p>}
            {floor.points.map((point) => {
              const type = POINT_TYPE_LIST.find((item) => item.category === point.category);
              const active = selection?.kind === 'point' && selection.id === point.id;
              return (
                <button
                  key={point.id}
                  onClick={() => select({ kind: 'point', id: point.id })}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition ${
                    active ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800/60'
                  }`}
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: type?.color ?? '#94a3b8' }} />
                  <span className="min-w-0 flex-1 truncate text-[11px] font-medium">{point.name}</span>
                  <span className="font-mono text-[9px] text-slate-600">
                    {round(point.x)}, {round(point.y)}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {(wallCount > 0 || roomCount > 0 || stairCount > 0 || floor.panoramas.length > 0) && (
          <section className="space-y-2">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <BoxSelect className="h-3.5 w-3.5" /> Объекты этажа
            </div>
            {wallCount > 0 && (
              <div>
                <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-slate-600">Стены · {wallCount}</div>
                <div className="max-h-28 space-y-0.5 overflow-y-auto">
                  {floor.walls?.map((wall, index) => (
                    <button
                      key={wall.id}
                      onClick={() => select({ kind: 'wall', id: wall.id })}
                      className={`flex w-full items-center justify-between rounded px-2 py-1 text-[10px] transition ${
                        selection?.kind === 'wall' && selection.id === wall.id ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800/60'
                      }`}
                    >
                      <span>Стена {index + 1}</span>
                      <span className="font-mono text-slate-500">{wall.lengthMeters} м</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {stairCount > 0 && (
              <div>
                <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-slate-600">Лестницы · {stairCount}</div>
                <div className="space-y-0.5">
                  {floor.stairs?.map((stair) => (
                    <button
                      key={stair.id}
                      onClick={() => select({ kind: 'stair', id: stair.id })}
                      className={`flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-[10px] transition ${
                        selection?.kind === 'stair' && selection.id === stair.id
                          ? 'bg-slate-800 text-white'
                          : 'text-slate-400 hover:bg-slate-800/60'
                      }`}
                    >
                      <span className="truncate">{stair.name}</span>
                      <span className="shrink-0 font-mono text-slate-500">
                        {stairLengthMeters(stair, floor.metersPerPixel)} м
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {roomCount > 0 && (
              <div>
                <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-slate-600">Помещения · {roomCount}</div>
                <div className="space-y-0.5">
                  {floor.rooms?.map((room) => (
                    <button
                      key={room.id}
                      onClick={() => select({ kind: 'room', id: room.id })}
                      className={`flex w-full items-center justify-between rounded px-2 py-1 text-[10px] transition ${
                        selection?.kind === 'room' && selection.id === room.id ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800/60'
                      }`}
                    >
                      <span className="truncate">{room.name}</span>
                      <span className="ml-2 shrink-0 font-mono text-slate-500">{polygonAreaMeters(room.points, floor.metersPerPixel)} м²</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {floor.panoramas.length > 0 && (
              <div>
                <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-slate-600">Панорамы · {floor.panoramas.length}</div>
                <div className="space-y-0.5">
                  {floor.panoramas.map((panorama) => {
                    const linked = floor.points.find((point) => point.panoramaId === panorama.id);
                    return (
                      <button
                        key={panorama.id}
                        onClick={() => select({ kind: 'panorama', id: panorama.id })}
                        className={`flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-[10px] transition ${
                          selection?.kind === 'panorama' && selection.id === panorama.id ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800/60'
                        }`}
                      >
                        <span className="truncate">{linked?.name ?? panorama.id}</span>
                        {!linked && <span className="shrink-0 text-amber-500">без точки</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}
      </div>

      <div className="border-t border-slate-800 px-3 py-2">
        <button
          className="flex w-full items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[10px] font-semibold text-slate-500 transition hover:bg-slate-800 hover:text-red-400 disabled:opacity-40"
          onClick={() => setConfirmClear(true)}
          disabled={floor.points.length + (floor.walls?.length ?? 0) + (floor.rooms?.length ?? 0) + stairCount === 0}
          title="Удалить точки, стены, помещения и лестницы текущего этажа"
        >
          <Trash2 className="h-3.5 w-3.5" /> Очистить объекты этажа
        </button>
      </div>

      <ConfirmDialog
        open={confirmClear}
        title="Очистить объекты этажа?"
        text={`Будут удалены ${floor.points.length} точек, ${floor.walls?.length ?? 0} стен, ${floor.rooms?.length ?? 0} помещений и ${stairCount} лестниц этажа «${floor.name}». Внешние связи лестниц очистятся, панорамы останутся. Действие можно отменить через Undo.`}
        confirmLabel="Очистить"
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          clearFloorObjects(floor.id);
          setConfirmClear(false);
        }}
      />
    </aside>
  );
}
