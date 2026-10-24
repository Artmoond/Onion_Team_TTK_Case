import { ImageOff, Link2, Replace, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useEditorStore } from '../../store/editorStore';
import type { Panorama } from '../../types/venue';
import { AssetDropzone } from '../common/AssetDropzone';
import { ConfirmDialog } from '../layout/ConfirmDialog';
import { PanoramaPreview } from './PanoramaPreview';

interface PanoramaPropertiesProps {
  panorama: Panorama;
}

export function PanoramaProperties({ panorama }: PanoramaPropertiesProps) {
  const venue = useEditorStore((state) => state.venue);
  const activeFloorId = useEditorStore((state) => state.activeFloorId);
  const updatePanorama = useEditorStore((state) => state.updatePanorama);
  const replacePanoramaAsset = useEditorStore((state) => state.replacePanoramaAsset);
  const deletePanorama = useEditorStore((state) => state.deletePanorama);
  const linkPanorama = useEditorStore((state) => state.linkPanorama);
  const select = useEditorStore((state) => state.select);
  const beginTransaction = useEditorStore((state) => state.beginTransaction);
  const commitTransaction = useEditorStore((state) => state.commitTransaction);
  const showToast = useEditorStore((state) => state.showToast);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const floor = venue?.floors.find((item) => item.id === activeFloorId);
  const linkedPoint = floor?.points.find((point) => point.panoramaId === panorama.id);
  const availablePoints = floor?.points.filter((point) => point.category === 'panorama' && point.id !== linkedPoint?.id) ?? [];

  if (!floor) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-bold text-white">Панорама</h3>
          <p className="mt-0.5 text-[10px] text-slate-500">{panorama.asset?.fileName ?? panorama.id}</p>
        </div>
        <span className="rounded bg-violet-950/60 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-violet-300">
          {panorama.asset?.storage === 'local' ? 'локально' : 'сервер'}
        </span>
      </div>

      <PanoramaPreview panorama={panorama} />

      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5">
        <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          <Link2 className="h-3.5 w-3.5" /> Привязка
        </div>
        {linkedPoint ? (
          <div className="flex items-center justify-between gap-2">
            <button className="min-w-0 truncate text-left text-xs font-semibold text-cyan-300 hover:underline" onClick={() => select({ kind: 'point', id: linkedPoint.id })}>
              {linkedPoint.name}
            </button>
            <button className="btn px-2 py-1" onClick={() => linkPanorama(linkedPoint.id, null)}>
              Отвязать
            </button>
          </div>
        ) : availablePoints.length > 0 ? (
          <select
            className="field"
            defaultValue=""
            onChange={(event) => {
              if (event.target.value) linkPanorama(event.target.value, panorama.id);
            }}
          >
            <option value="" disabled>
              Выберите точку типа «Панорама»
            </option>
            {availablePoints.map((point) => (
              <option key={point.id} value={point.id}>
                {point.name}
              </option>
            ))}
          </select>
        ) : (
          <p className="text-[10px] text-slate-500">Нет свободных точек типа «Панорама». Создайте точку и загрузите в неё панораму.</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label">X, px</label>
          <input
            type="number"
            className="field"
            value={Math.round(panorama.x)}
            onFocus={beginTransaction}
            onBlur={commitTransaction}
            onChange={(event) => updatePanorama(panorama.id, { x: Number(event.target.value) }, false)}
          />
        </div>
        <div>
          <label className="label">Y, px</label>
          <input
            type="number"
            className="field"
            value={Math.round(panorama.y)}
            onFocus={beginTransaction}
            onBlur={commitTransaction}
            onChange={(event) => updatePanorama(panorama.id, { y: Number(event.target.value) }, false)}
          />
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          <Replace className="h-3.5 w-3.5" /> Заменить файл
        </div>
        <AssetDropzone
          kind="panorama"
          compact
          onAsset={(asset) => {
            replacePanoramaAsset(panorama.id, asset);
            showToast('success', 'Панорама заменена');
          }}
        />
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5 text-[10px] text-slate-500">
        <div className="flex items-center gap-1.5 font-semibold text-slate-400">
          <ImageOff className="h-3.5 w-3.5" /> Метаданные
        </div>
        <div className="mt-1.5 break-all font-mono">
          id: {panorama.asset?.id ?? '—'}
          <br />
          mime: {panorama.asset?.mimeType ?? '—'}
          <br />
          size: {panorama.asset?.sizeBytes ? `${(panorama.asset.sizeBytes / 1024).toFixed(0)} КБ` : '—'}
          <br />
          storage: {panorama.asset?.storage ?? '—'}
        </div>
      </div>

      <button className="btn w-full border-red-900/60 text-red-300 hover:bg-red-950/40" onClick={() => setConfirmDelete(true)}>
        <Trash2 className="h-4 w-4" /> Удалить панораму
      </button>

      <ConfirmDialog
        open={confirmDelete}
        title="Удалить панораму?"
        text={linkedPoint ? `Панорама будет отвязана от точки «${linkedPoint.name}» и удалена с этажа.` : 'Панорама будет удалена с этажа.'}
        confirmLabel="Удалить"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          deletePanorama(panorama.id);
          setConfirmDelete(false);
        }}
      />
    </div>
  );
}
