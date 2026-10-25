import {
  Cloud,
  CloudOff,
  FilePlus2,
  FolderOpen,
  Layers,
  Map as MapIcon,
  QrCode,
  Redo2,
  Save,
  Undo2,
  ShieldCheck,
  LogOut,
} from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';
import { checkBackend, listVenues } from '../../services/api';
import { normalizeVenue } from '../../services/serialization';
import { persistCurrentDraft, useEditorStore } from '../../store/editorStore';
import { useActiveFloor } from '../../store/editorStore';
import type { Session } from '../../lib/auth';
import type { Venue } from '../../types/venue';

interface TopBarProps {
  onOpenBackend: () => void;
  onOpenPublish: () => void;
  onNewProject: () => void;
  session?: Session | null;
  onLogout?: () => Promise<void>;
}

export function TopBar({ onOpenBackend, onOpenPublish, onNewProject, session, onLogout }: TopBarProps) {
  const venue = useEditorStore((state) => state.venue);
  const loadProject = useEditorStore((state) => state.loadProject);
  const activeFloor = useActiveFloor();
  const dirty = useEditorStore((state) => state.dirty);
  const saveStatus = useEditorStore((state) => state.saveStatus);
  const lastSavedAt = useEditorStore((state) => state.lastSavedAt);
  const canUndo = useEditorStore((state) => state.history.past.length > 0);
  const canRedo = useEditorStore((state) => state.history.future.length > 0);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const setActiveFloor = useEditorStore((state) => state.setActiveFloor);
  const markSavedLocal = useEditorStore((state) => state.markSavedLocal);
  const showToast = useEditorStore((state) => state.showToast);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [availableVenues, setAvailableVenues] = useState<Venue[]>([]);

  useEffect(() => {
    let cancelled = false;
    checkBackend()
      .then(() => {
        if (!cancelled) setBackendOnline(true);
      })
      .catch(() => {
        if (!cancelled) setBackendOnline(false);
      });

    listVenues()
      .then((venues) => {
        if (!cancelled) {
          setAvailableVenues(venues.map((v) => normalizeVenue(v)));
        }
      })
      .catch(() => {
        // ignore
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const allVenues = useMemo(() => {
    const map = new Map<string, Venue>();
    if (venue) map.set(venue.slug, venue);
    for (const v of availableVenues) {
      map.set(v.slug, v);
    }
    return Array.from(map.values());
  }, [venue, availableVenues]);

  if (!venue) return null;

  const saveLocal = () => {
    const draft = persistCurrentDraft();
    if (!draft) return;
    markSavedLocal();
    showToast('success', 'Черновик сохранён', 'Данные сохранены в localStorage браузера.');
  };

  const statusText =
    saveStatus === 'saved-server'
      ? 'Опубликовано на backend'
      : saveStatus === 'saved-local'
        ? 'Сохранено локально'
        : saveStatus === 'saving'
          ? 'Сохранение…'
          : saveStatus === 'error'
            ? 'Ошибка сохранения'
            : dirty
              ? 'Есть изменения'
              : 'Без изменений';

  return (
    <header className="z-20 flex h-16 shrink-0 items-center gap-3 border-b border-slate-800 bg-slate-900 px-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="rounded bg-brand px-2.5 py-1 text-xs font-black tracking-wider text-white">ТТК</span>
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-white">{venue.title}</div>
          <div className="truncate font-mono text-[10px] text-slate-500">/m/{venue.slug}</div>
        </div>
      </div>

      <div className="mx-2 h-8 w-px bg-slate-800" />

      {/* Селектор выбора карты */}
      <div className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/90 px-2.5 py-1 shadow-sm">
        <MapIcon className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
        <select
          className="max-w-[180px] truncate bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer pr-1"
          value={venue.slug}
          onChange={(event) => {
            const targetSlug = event.target.value;
            if (targetSlug === '__new__') {
              onNewProject();
              return;
            }
            if (targetSlug !== venue.slug) {
              const target = allVenues.find((v) => v.slug === targetSlug);
              if (target) {
                loadProject(target);
                showToast('info', 'Карта переключена', `Открыта площадка «${target.title}»`);
              }
            }
          }}
          title="Выбрать карту"
        >
          <optgroup label="Опубликованные карты">
            {allVenues.map((v) => (
              <option key={v.slug} value={v.slug} className="bg-slate-900 text-white">
                {v.title} (/m/{v.slug})
              </option>
            ))}
          </optgroup>
          <option value="__new__" className="bg-slate-900 text-cyan-300 font-bold">
            + Создать новую карту…
          </option>
        </select>
      </div>

      {/* Селектор выбора этажа */}
      <div className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/90 px-2.5 py-1 shadow-sm">
        <Layers className="h-3.5 w-3.5 text-slate-400 shrink-0" />
        <select
          className="max-w-[160px] truncate bg-transparent text-xs font-medium text-white focus:outline-none cursor-pointer pr-1"
          value={activeFloor?.id ?? ''}
          onChange={(event) => setActiveFloor(event.target.value)}
          title="Выбрать этаж"
        >
          {venue.floors.map((floor) => (
            <option key={floor.id} value={floor.id} className="bg-slate-900 text-white">
              {floor.name}
            </option>
          ))}
        </select>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <button className="btn px-2" onClick={undo} disabled={!canUndo} title="Отменить (Ctrl+Z)">
          <Undo2 className="h-4 w-4" />
        </button>
        <button className="btn px-2" onClick={redo} disabled={!canRedo} title="Повторить (Ctrl+Shift+Z)">
          <Redo2 className="h-4 w-4" />
        </button>

        <div
          className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold xl:flex ${
            backendOnline ? 'border-emerald-800/60 bg-emerald-950/40 text-emerald-300' : 'border-amber-800/60 bg-amber-950/30 text-amber-300'
          }`}
          title={backendOnline ? 'Backend /api/health отвечает' : 'Backend недоступен — доступен локальный режим'}
        >
          {backendOnline ? <Cloud className="h-3.5 w-3.5" /> : <CloudOff className="h-3.5 w-3.5" />}
          {backendOnline ? 'Backend онлайн' : 'Локальный режим'}
        </div>

        <div className="mr-1 hidden flex-col items-end xl:flex">
          <span className={`text-[10px] font-semibold ${saveStatus === 'error' ? 'text-red-400' : dirty ? 'text-amber-300' : 'text-slate-400'}`}>
            {statusText}
          </span>
          {lastSavedAt && (
            <span className="text-[9px] text-slate-600">
              {new Date(lastSavedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>

        <button className="btn" onClick={saveLocal} title="Сохранить локальный черновик">
          <Save className="h-4 w-4" /> <span className="hidden 2xl:inline">Сохранить</span>
        </button>
        <button className="btn" onClick={onOpenBackend} title="Открыть карту с сервера">
          <FolderOpen className="h-4 w-4" /> <span className="hidden 2xl:inline">С сервера</span>
        </button>
        <button className="btn px-2" onClick={onNewProject} title="Новый проект">
          <FilePlus2 className="h-4 w-4" />
        </button>
        <button className="btn-primary" onClick={onOpenPublish}>
          <QrCode className="h-4 w-4" /> Опубликовать
        </button>

        {session && (
          <div
            className="flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800/80 py-1 pl-2.5 pr-1 text-xs"
            title={session.user.email}
          >
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span className="max-w-[120px] truncate font-medium text-slate-200">{session.user.fullName}</span>
            <span className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-300">Организатор</span>
            {onLogout && (
              <button
                onClick={() => { void onLogout(); }}
                title="Выйти"
                className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-700/70 hover:text-red-400"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
