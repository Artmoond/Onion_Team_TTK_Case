import { Copy, ImagePlus, Layers, Trash2, Unlink } from 'lucide-react';
import { useState } from 'react';
import { POINT_TYPES, POINT_TYPE_LIST } from '../../config/pointTypes';
import { useActiveFloor, useEditorStore, useSelectedPoint } from '../../store/editorStore';
import type { PointCategory } from '../../types/venue';
import { AssetDropzone } from '../common/AssetDropzone';
import { ConfirmDialog } from '../layout/ConfirmDialog';
import { PanoramaPreview } from '../panoramas/PanoramaPreview';
import { PointSettingsFields } from './PointSettingsFields';

export function PointProperties() {
  const point = useSelectedPoint();
  const floor = useActiveFloor();
  const updatePoint = useEditorStore((state) => state.updatePoint);
  const deletePoint = useEditorStore((state) => state.deletePoint);
  const duplicatePoint = useEditorStore((state) => state.duplicatePoint);
  const linkPanorama = useEditorStore((state) => state.linkPanorama);
  const addPanorama = useEditorStore((state) => state.addPanorama);
  const replacePanoramaAsset = useEditorStore((state) => state.replacePanoramaAsset);
  const beginTransaction = useEditorStore((state) => state.beginTransaction);
  const commitTransaction = useEditorStore((state) => state.commitTransaction);
  const showToast = useEditorStore((state) => state.showToast);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!point || !floor) return null;

  const type = POINT_TYPES[point.category];
  const panorama = floor.panoramas.find((item) => item.id === point.panoramaId);
  const freePanoramas = floor.panoramas.filter((item) => item.id === point.panoramaId || !floor.points.some((candidate) => candidate.panoramaId === item.id));

  const changeCategory = (category: PointCategory) => {
    const definition = POINT_TYPES[category];
    const { isPublic: _ignored, ...settings } = definition.createSettings();
    updatePoint(point.id, { category, ...settings });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: type.color }} />
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: type.color }}>
              {type.label}
            </span>
          </div>
          <h3 className="mt-1 truncate text-sm font-bold text-white">{point.name}</h3>
        </div>
        <span className="shrink-0 rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[9px] text-slate-400">POI</span>
      </div>

      <div>
        <label className="label">Название</label>
        <input
          className="field"
          value={point.name}
          onFocus={beginTransaction}
          onBlur={commitTransaction}
          onChange={(event) => updatePoint(point.id, { name: event.target.value }, false)}
        />
      </div>

      <div>
        <label className="label">Тип точки</label>
        <select className="field" value={point.category} onChange={(event) => changeCategory(event.target.value as PointCategory)}>
          {POINT_TYPE_LIST.map((item) => (
            <option key={item.category} value={item.category}>
              {item.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[10px] text-slate-500">{type.description}</p>
      </div>

      <div>
        <label className="label">Описание</label>
        <textarea
          className="field min-h-20 resize-none"
          value={point.description ?? ''}
          onFocus={beginTransaction}
          onBlur={commitTransaction}
          onChange={(event) => updatePoint(point.id, { description: event.target.value }, false)}
          placeholder="Что находится в этой точке?"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label">X, px</label>
          <input
            type="number"
            className="field"
            value={Math.round(point.x)}
            onFocus={beginTransaction}
            onBlur={commitTransaction}
            onChange={(event) => updatePoint(point.id, { x: Number(event.target.value) }, false)}
          />
        </div>
        <div>
          <label className="label">Y, px</label>
          <input
            type="number"
            className="field"
            value={Math.round(point.y)}
            onFocus={beginTransaction}
            onBlur={commitTransaction}
            onChange={(event) => updatePoint(point.id, { y: Number(event.target.value) }, false)}
          />
        </div>
      </div>

      <PointSettingsFields point={point} />

      {point.category === 'panorama' && (
        <div className="space-y-2 rounded-lg border border-violet-900/40 bg-violet-950/10 p-2.5">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-bold uppercase tracking-wider text-violet-400">Панорама 360°</div>
            {panorama && <span className="text-[9px] text-emerald-400">привязана</span>}
          </div>

          {panorama ? (
            <>
              <PanoramaPreview panorama={panorama} compact />
              <div className="text-[9px] text-slate-500">{panorama.asset?.fileName ?? panorama.url}</div>
              <AssetDropzone
                kind="panorama"
                compact
                onAsset={(asset) => {
                  replacePanoramaAsset(panorama.id, asset);
                  showToast('success', 'Панорама заменена');
                }}
              />
              <button className="btn w-full" onClick={() => linkPanorama(point.id, null)}>
                <Unlink className="h-3.5 w-3.5" /> Отвязать панораму
              </button>
            </>
          ) : (
            <>
              {freePanoramas.length > 0 && (
                <select
                  className="field"
                  defaultValue=""
                  onChange={(event) => {
                    if (event.target.value) linkPanorama(point.id, event.target.value);
                  }}
                >
                  <option value="" disabled>
                    Выберите панораму этажа
                  </option>
                  {freePanoramas.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.asset?.fileName ?? item.id}
                    </option>
                  ))}
                </select>
              )}
              <AssetDropzone
                kind="panorama"
                compact
                onAsset={(asset) => {
                  const id = addPanorama({ asset, x: point.x, y: point.y, linkPointId: point.id });
                  if (id) showToast('success', 'Панорама загружена и привязана');
                }}
              />
              <p className="text-[9px] text-slate-500">Файл хранится в IndexedDB и передаётся на backend при публикации.</p>
            </>
          )}
        </div>
      )}

      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5 text-[10px] text-slate-500">
        <div className="mb-1 flex items-center gap-1.5 font-semibold text-slate-400">
          <Layers className="h-3.5 w-3.5" /> Идентификация
        </div>
        <div className="flex items-center gap-1.5">
          <code className="min-w-0 flex-1 truncate rounded bg-slate-950 px-1.5 py-1 text-[9px] text-slate-400">{point.id}</code>
          <button
            className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-white"
            onClick={() => {
              navigator.clipboard?.writeText(point.id);
              showToast('info', 'ID скопирован');
            }}
            title="Скопировать ID"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="mt-1.5">Этаж: {floor.name}</div>
      </div>

      <label className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-2.5 py-2 text-[11px] text-slate-300">
        <input type="checkbox" checked={point.isPublic} onChange={(event) => updatePoint(point.id, { isPublic: event.target.checked })} />
        Показывать посетителям публичной карты
      </label>

      <div className="grid grid-cols-2 gap-2">
        <button className="btn" onClick={() => duplicatePoint(point.id)}>
          <ImagePlus className="h-4 w-4" /> Дублировать
        </button>
        <button className="btn border-red-900/60 text-red-300 hover:bg-red-950/40" onClick={() => setConfirmDelete(true)}>
          <Trash2 className="h-4 w-4" /> Удалить
        </button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Удалить точку?"
        text={`Точка «${point.name}» будет удалена с этажа. Панорама останется в библиотеке этажа.`}
        confirmLabel="Удалить точку"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          deletePoint(point.id);
          setConfirmDelete(false);
        }}
      />
    </div>
  );
}
