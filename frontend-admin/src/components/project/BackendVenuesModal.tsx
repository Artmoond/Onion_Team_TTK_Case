import { DownloadCloud, Loader2, RefreshCw, Server } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { listVenues } from '../../services/api';
import { normalizeVenue } from '../../services/serialization';
import { useEditorStore } from '../../store/editorStore';
import type { Venue } from '../../types/venue';
import { ConfirmDialog } from '../layout/ConfirmDialog';
import { Modal } from '../layout/Modal';

interface BackendVenuesModalProps {
  onClose: () => void;
}

export function BackendVenuesModal({ onClose }: BackendVenuesModalProps) {
  const venue = useEditorStore((state) => state.venue);
  const loadProject = useEditorStore((state) => state.loadProject);
  const [backendVenues, setBackendVenues] = useState<Venue[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingVenue, setPendingVenue] = useState<Venue | null>(null);

  const loadBackend = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const venues = await listVenues();
      setBackendVenues(venues.map((item) => normalizeVenue(item)));
      if (venues.length === 0) setError('На сервере пока нет опубликованных карт.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не удалось загрузить карты с сервера.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBackend();
  }, [loadBackend]);

  const openVenue = (item: Venue) => {
    if (venue) {
      setPendingVenue(item);
      return;
    }
    loadProject(item);
    onClose();
  };

  return (
    <Modal
      title="Открыть карту с сервера"
      subtitle="Опубликованные площадки из GET /api/venues"
      onClose={onClose}
      widthClassName="max-w-2xl"
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-[10px] text-slate-500">Backend хранит площадки in-memory.</span>
          <button className="btn" onClick={onClose}>
            Закрыть
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/40 p-3">
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            <DownloadCloud className="h-4 w-4 text-violet-400" /> Доступные карты
          </div>
          <button className="btn px-2 py-1" onClick={() => void loadBackend()} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Обновить
          </button>
        </div>

        {loading && !backendVenues && (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-8 text-xs text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Загружаем список площадок…
          </div>
        )}

        {backendVenues && backendVenues.length > 0 && (
          <div className="space-y-1.5">
            {backendVenues.map((item) => (
              <button
                key={item.id}
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2.5 text-left transition hover:border-slate-700 hover:bg-slate-800"
                onClick={() => openVenue(item)}
              >
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-slate-200">{item.title}</span>
                  <span className="block font-mono text-[9px] text-slate-500">/m/{item.slug}</span>
                </span>
                <span className="shrink-0 text-right text-[9px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <Server className="h-3 w-3" /> {item.floors.length} эт.
                  </span>
                  <span className="mt-0.5 block">
                    {item.floors.reduce((sum, floor) => sum + floor.points.length, 0)} точек
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-amber-800/60 bg-amber-950/30 px-3 py-2 text-[11px] text-amber-300">{error}</div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(pendingVenue)}
        title="Заменить текущую карту?"
        text={`Текущая карта «${venue?.title ?? ''}» будет заменена на «${pendingVenue?.title ?? ''}». Несохранённые изменения текущей карты будут потеряны. При необходимости сначала сохраните черновик или опубликуйте карту.`}
        confirmLabel="Открыть карту"
        tone="normal"
        onCancel={() => setPendingVenue(null)}
        onConfirm={() => {
          if (pendingVenue) {
            loadProject(pendingVenue);
            onClose();
          }
        }}
      />
    </Modal>
  );
}
