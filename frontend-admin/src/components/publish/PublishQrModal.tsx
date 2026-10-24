import { Check, Copy, Download, ExternalLink, Loader2, QrCode, Server, UploadCloud, Wifi } from 'lucide-react';
import { useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { buildPublicUrl } from '../../services/api';
import { countAssetsToUpload, publishVenue, type PublishProgress } from '../../services/publish';
import { useEditorStore } from '../../store/editorStore';
import { downloadDataUrl } from '../../utils/download';
import { ConfirmDialog } from '../layout/ConfirmDialog';
import { Modal } from '../layout/Modal';

interface PublishQrModalProps {
  onClose: () => void;
}

export function PublishQrModal({ onClose }: PublishQrModalProps) {
  const venue = useEditorStore((state) => state.venue);
  const setVenueAfterSync = useEditorStore((state) => state.setVenueAfterSync);
  const showToast = useEditorStore((state) => state.showToast);
  const markSaving = useEditorStore((state) => state.markSaving);
  const markSavedServer = useEditorStore((state) => state.markSavedServer);
  const markSaveError = useEditorStore((state) => state.markSaveError);
  const qrWrapRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [progress, setProgress] = useState<PublishProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmPublish, setConfirmPublish] = useState(false);

  if (!venue) return null;

  const publicLink = buildPublicUrl(venue);
  const published = Boolean(venue.publicUrl);
  const assetsToUpload = countAssetsToUpload(venue);

  const copy = async () => {
    if (!publicLink) return;
    try {
      await navigator.clipboard.writeText(publicLink.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      showToast('error', 'Не удалось скопировать ссылку');
    }
  };

  const downloadQr = () => {
    const canvas = qrWrapRef.current?.querySelector('canvas');
    if (!canvas) {
      showToast('error', 'QR-код ещё не готов');
      return;
    }
    downloadDataUrl(canvas.toDataURL('image/png'), `${venue.slug}-qr.png`);
    showToast('success', 'QR-код скачан', `${venue.slug}-qr.png`);
  };

  const runPublish = async () => {
    setConfirmPublish(false);
    setError(null);
    setPublishing(true);
    markSaving();
    try {
      const result = await publishVenue(venue, setProgress);
      setVenueAfterSync(result.venue);
      markSavedServer();
      showToast(
        'success',
        'Площадка опубликована',
        `Данные карты отправлены через PUT /api/venues/${venue.slug}. Файлов загружено: ${result.uploaded}.`
      );
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Не удалось опубликовать площадку.';
      setError(message);
      markSaveError(message);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <Modal
      title="Публикация и QR-код"
      subtitle="Ссылка на карту посетителя, печатный QR и передача данных на backend"
      onClose={onClose}
      widthClassName="max-w-4xl"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[10px] text-slate-500">
            Backend: <span className="font-mono text-slate-400">PUT /api/venues/{venue.slug}</span>
            {' · '}
            <span className="font-mono text-slate-400">POST /api/upload</span>
          </span>
          <div className="flex gap-2">
            <button className="btn" onClick={onClose} disabled={publishing}>
              Закрыть
            </button>
            <button className="btn-primary" onClick={() => setConfirmPublish(true)} disabled={publishing}>
              {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
              {publishing ? 'Публикация…' : 'Опубликовать на backend'}
            </button>
          </div>
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="flex flex-col items-center">
          <div ref={qrWrapRef} className="rounded-2xl bg-white p-4 shadow-xl">
            {publicLink ? (
              <QRCodeCanvas value={publicLink.url} size={220} level="M" includeMargin />
            ) : (
              <div className="flex h-[252px] w-[252px] items-center justify-center text-center text-xs text-slate-500">
                QR появится после публикации
              </div>
            )}
            <div className="mt-2 text-center text-[10px] font-bold uppercase tracking-wider text-slate-800">
              ТТК · Карта пространства
            </div>
          </div>
          <div className="mt-3 flex w-full gap-2">
            <button className="btn flex-1" onClick={downloadQr} disabled={!published}>
              <Download className="h-4 w-4" /> PNG
            </button>
            <button className="btn flex-1" onClick={copy} disabled={!published}>
              {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Скопировано' : 'Копировать'}
            </button>
          </div>
          <div className="mt-3 w-full rounded-lg border border-slate-800 bg-slate-950/60 p-2">
            <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">
              <QrCode className="h-3.5 w-3.5" /> QR ведёт на
            </div>
            {publicLink ? (
              <a href={publicLink.url} target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-1 break-all font-mono text-[10px] text-cyan-300 hover:underline">
                {publicLink.url} <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
            ) : (
              <div className="mt-1 font-mono text-[10px] text-slate-500">Ссылка появится после успешной публикации</div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {!published ? (
            <div className="rounded-xl border border-amber-700/60 bg-amber-950/25 p-3 text-xs text-amber-300">
              Ссылка и QR-код будут созданы после успешного сохранения карты на backend.
            </div>
          ) : (
            <div className="rounded-xl border border-emerald-800/60 bg-emerald-950/20 p-3">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                <Wifi className="h-4 w-4" /> URL выдан backend; QR-код создаётся локально
              </div>
              <p className="mt-1 text-[10px] leading-relaxed text-slate-400">
                Проверьте, что клиентское приложение доступно по этому адресу.
              </p>
            </div>
          )}

          <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <Server className="h-3.5 w-3.5" /> Что будет передано
            </div>
            <ul className="mt-2 space-y-1 text-[10px] leading-relaxed text-slate-400">
              <li>• Полная карта: этажи, стены, помещения, лестницы, точки, панорамы, graph.</li>
              <li>• {assetsToUpload} файлов к загрузке через POST /api/upload: локальные и относительные демо-ассеты заменятся на /uploads/…</li>
              <li>• Данные сохраняются через PUT /api/venues/{venue.slug}.</li>
              <li>• Большие бинарные данные не встраиваются в карту.</li>
            </ul>
          </div>

          {publishing && (
            <div className="rounded-xl border border-cyan-800/60 bg-cyan-950/20 p-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-cyan-300">
                <Loader2 className="h-4 w-4 animate-spin" /> {progress?.label ?? 'Подготовка…'}
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-cyan-400 transition-all"
                  style={{ width: `${progress ? Math.round((progress.done / progress.total) * 100) : 5}%` }}
                />
              </div>
              <div className="mt-1 text-right font-mono text-[9px] text-slate-500">
                {progress ? `${progress.done} / ${progress.total}` : '0 / ?'}
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-800/60 bg-red-950/30 p-3 text-[11px] leading-relaxed text-red-300">
              <div className="font-bold">Публикация не выполнена</div>
              <div className="mt-1">{error}</div>
              <div className="mt-2 text-[10px] text-red-400/80">
                Локальный черновик сохранён. Запустите backend на порту 8000 или повторите публикацию позже.
              </div>
            </div>
          )}

          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5 text-[10px] text-slate-500">
            Backend сохраняет площадки на диск (в ./data/uploads/venues/{venue.slug}.json).
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmPublish}
        title="Опубликовать площадку?"
        text={`Данные карты «${venue.title}» будут отправлены на backend. ${assetsToUpload > 0 ? `Сначала загрузятся ${assetsToUpload} файлов (локальные и относительные демо-ассеты).` : 'Файлов для загрузки нет.'} Существующая версия с тем же slug будет заменена.`}
        confirmLabel="Опубликовать"
        tone="normal"
        onCancel={() => setConfirmPublish(false)}
        onConfirm={() => void runPublish()}
      />
    </Modal>
  );
}
