import { Building2, Image as ImageIcon, Ruler, Save } from 'lucide-react';
import { useState } from 'react';
import { useAssetUrl } from '../../hooks/useAssetUrl';
import { useActiveFloor, useEditorStore } from '../../store/editorStore';
import type { AssetReference } from '../../types/venue';
import { AssetDropzone } from '../common/AssetDropzone';
import { ConfirmDialog } from '../layout/ConfirmDialog';

export function FloorProperties() {
  const venue = useEditorStore((state) => state.venue);
  const floor = useActiveFloor();
  const updateFloorMeta = useEditorStore((state) => state.updateFloorMeta);
  const updateProjectMeta = useEditorStore((state) => state.updateProjectMeta);
  const setFloorScale = useEditorStore((state) => state.setFloorScale);
  const replaceFloorPlan = useEditorStore((state) => state.replaceFloorPlan);
  const beginTransaction = useEditorStore((state) => state.beginTransaction);
  const commitTransaction = useEditorStore((state) => state.commitTransaction);
  const showToast = useEditorStore((state) => state.showToast);
  const [pendingAsset, setPendingAsset] = useState<AssetReference | null>(null);
  const planUrl = useAssetUrl(floor?.planUrl, floor?.planAsset?.id);

  if (!venue || !floor) return null;

  const objectCount =
    floor.points.length +
    (floor.walls?.length ?? 0) +
    (floor.rooms?.length ?? 0) +
    (floor.stairs?.length ?? 0) +
    floor.panoramas.length;
  const hasObjects = objectCount > 0;

  const applyPlan = (asset: AssetReference) => {
    const width = asset.width || floor.width;
    const height = asset.height || floor.height;
    replaceFloorPlan(floor.id, asset, width, height);
    showToast('success', 'План загружен', `${width} × ${height} px`);
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-cyan-400">
          <Building2 className="h-3.5 w-3.5" /> Этаж
        </div>
        <h3 className="mt-1 truncate text-sm font-bold text-white">{floor.name}</h3>
        <p className="text-[10px] text-slate-500">
          {floor.points.length} точек · {floor.walls?.length ?? 0} стен · {floor.rooms?.length ?? 0} помещений ·{' '}
          {floor.stairs?.length ?? 0} лестниц
        </p>
      </div>

      <div className="space-y-2">
        <div>
          <label className="label">Название этажа</label>
          <input
            className="field"
            value={floor.name}
            onFocus={beginTransaction}
            onBlur={commitTransaction}
            onChange={(event) => updateFloorMeta(floor.id, { name: event.target.value }, false)}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Уровень</label>
            <input
              type="number"
              className="field"
              value={floor.level}
              onFocus={beginTransaction}
              onBlur={commitTransaction}
              onChange={(event) => updateFloorMeta(floor.id, { level: Number(event.target.value) }, false)}
            />
          </div>
          <div>
            <label className="label">Масштаб, м/px</label>
            <input
              type="number"
              step="0.001"
              min="0.0001"
              className="field"
              value={floor.metersPerPixel}
              onFocus={beginTransaction}
              onBlur={commitTransaction}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (Number.isFinite(value) && value > 0) setFloorScale(floor.id, value, false);
              }}
            />
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5">
        <div className="flex items-center justify-between text-[10px] text-slate-400">
          <span className="flex items-center gap-1.5 font-semibold">
            <Ruler className="h-3.5 w-3.5" /> Физический размер
          </span>
          <span className="font-mono text-slate-300">
            {(floor.width * floor.metersPerPixel).toFixed(1)} × {(floor.height * floor.metersPerPixel).toFixed(1)} м
          </span>
        </div>
        <p className="mt-1.5 text-[10px] text-slate-500">
          План: {floor.width} × {floor.height} px. Изменение масштаба пересчитывает длины всех стен.
        </p>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <ImageIcon className="h-3.5 w-3.5" /> План павильона
          </div>
          {floor.planAsset && <span className="text-[9px] text-slate-600">{floor.planAsset.fileName}</span>}
        </div>
        {planUrl ? (
          <div className="mb-2 overflow-hidden rounded-lg border border-slate-700 bg-white">
            <img src={planUrl} alt="План этажа" className="max-h-36 w-full object-contain" />
          </div>
        ) : (
          <div className="mb-2 rounded-lg border border-dashed border-slate-700 px-3 py-6 text-center text-[10px] text-slate-500">
            План не загружен. Можно рисовать на пустом холсте или загрузить изображение.
          </div>
        )}
        <AssetDropzone
          kind="plan"
          compact
          onAsset={(asset) => {
            if (hasObjects) setPendingAsset(asset);
            else applyPlan(asset);
          }}
        />
      </div>

      <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/60 p-2.5">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Проект</div>
        <div>
          <label className="label">Название площадки</label>
          <input
            className="field"
            value={venue.title}
            onFocus={beginTransaction}
            onBlur={commitTransaction}
            onChange={(event) => updateProjectMeta({ title: event.target.value }, false)}
          />
        </div>
        <div>
          <label className="label">Slug</label>
          <input
            className="field font-mono"
            value={venue.slug}
            onFocus={beginTransaction}
            onBlur={commitTransaction}
            onChange={(event) => updateProjectMeta({ slug: event.target.value.replace(/[^a-z0-9-]/g, '').toLowerCase() }, false)}
          />
        </div>
        <div>
          <label className="label">Описание</label>
          <textarea
            className="field min-h-16 resize-none"
            value={venue.description ?? ''}
            onFocus={beginTransaction}
            onBlur={commitTransaction}
            onChange={(event) => updateProjectMeta({ description: event.target.value }, false)}
          />
        </div>
        <div className="flex items-center justify-between text-[9px] text-slate-600">
          <span>schemaVersion: {venue.schemaVersion ?? 1}</span>
          <span>revision: {venue.publishedRevision}</span>
        </div>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5 text-[10px] leading-relaxed text-slate-500">
        <div className="flex items-center gap-1.5 font-semibold text-slate-400">
          <Save className="h-3.5 w-3.5" /> Как изменить длину стены
        </div>
        <p className="mt-1">
          Выберите инструмент «Стена», нарисуйте отрезок или цепочку, затем задайте масштаб вручную или выберите «Масштаб» и укажите две точки известного расстояния. Длина стены хранится в данных карты в метрах.
        </p>
      </div>

      <ConfirmDialog
        open={Boolean(pendingAsset)}
        title="Заменить план этажа?"
        text={`На этаже уже есть ${objectCount} объектов. Новый план изменит размеры холста (${pendingAsset?.width ?? floor.width} × ${pendingAsset?.height ?? floor.height} px), но координаты объектов останутся прежними.`}
        confirmLabel="Заменить план"
        tone="normal"
        onCancel={() => setPendingAsset(null)}
        onConfirm={() => {
          if (pendingAsset) applyPlan(pendingAsset);
          setPendingAsset(null);
        }}
      />
    </div>
  );
}
