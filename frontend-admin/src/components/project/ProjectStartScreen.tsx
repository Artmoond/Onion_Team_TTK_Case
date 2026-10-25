import { FolderOpen, Map, Plus, RotateCcw, Server, Loader2, RefreshCw, ArrowRight } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import { listVenues } from '../../services/api';
import { normalizeVenue } from '../../services/serialization';
import { loadDraft } from '../../services/storage';
import { useEditorStore } from '../../store/editorStore';
import { slugify } from '../../utils/id';
import { isValidSlug } from '../../utils/validation';
import type { Venue } from '../../types/venue';

interface ProjectStartScreenProps {
  onQrUnavailable?: () => void;
}

export function ProjectStartScreen(_props: ProjectStartScreenProps) {
  const createProject = useEditorStore((state) => state.createProject);
  const loadProject = useEditorStore((state) => state.loadProject);
  const showToast = useEditorStore((state) => state.showToast);

  // Вкладки: 'select' (Выбор карты) или 'create' (Создать новую)
  const [activeTab, setActiveTab] = useState<'select' | 'create'>('select');

  // Список карт с бэкенда
  const [serverVenues, setServerVenues] = useState<Venue[]>([]);
  const [loadingVenues, setLoadingVenues] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Форма нового проекта
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [savedDraft] = useState(loadDraft);

  const fetchVenues = useCallback(async () => {
    setLoadingVenues(true);
    setLoadError(null);
    try {
      const venues = await listVenues();
      const normalized = venues.map((item) => normalizeVenue(item));
      setServerVenues(normalized);
      // Если на сервере пока нет карт, переключаем на создание
      if (normalized.length === 0) {
        setActiveTab('create');
      }
    } catch (caught) {
      setLoadError(caught instanceof Error ? caught.message : 'Не удалось загрузить список карт с сервера.');
    } finally {
      setLoadingVenues(false);
    }
  }, []);

  useEffect(() => {
    void fetchVenues();
  }, [fetchVenues]);

  const handleTitle = (value: string) => {
    setTitle(value);
    if (!slugTouched) setSlug(slugify(value));
  };

  const create = () => {
    if (!title.trim()) {
      showToast('error', 'Укажите название проекта');
      return;
    }
    if (!isValidSlug(slug)) {
      showToast('error', 'Slug должен содержать только латиницу, цифры и дефисы');
      return;
    }
    createProject(title, slug, description);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-6 py-10">
      <div className="pointer-events-none absolute -left-32 top-0 h-96 w-96 rounded-full bg-brand/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />
      
      <div className="relative grid w-full max-w-5xl gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        {/* Левая информационная колонка */}
        <div className="flex flex-col justify-center">
          <div className="mb-5 flex items-center gap-3">
            <span className="rounded bg-brand px-2.5 py-1 text-sm font-black tracking-wider text-white">ТТК</span>
            <span className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Студия организатора
            </span>
          </div>
          <h1 className="text-4xl font-black leading-tight text-white">
            Интерактивные карты
            <br />
            <span className="text-brand">выставочных павильонов</span>
          </h1>
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-slate-400">
            Создавайте многоэтажные планы, размечайте стены и помещения, расставляйте точки интереса,
            подключайте 360° панорамы и публикуйте карту для посетителей.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-3 text-center">
            {[
              ['01', 'План и стены'],
              ['02', 'POI и панорамы'],
              ['03', 'Публикация и QR'],
            ].map(([number, label]) => (
              <div key={number} className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-4">
                <div className="text-xs font-black text-brand">{number}</div>
                <div className="mt-1 text-[11px] font-semibold text-slate-300">{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Правая карточка: Выбор карты / Создание новой */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/95 p-6 shadow-2xl flex flex-col min-h-[480px]">
          {/* Вкладки сверху карточки */}
          <div className="flex items-center gap-2 border-b border-slate-800 pb-4 mb-4">
            <button
              onClick={() => setActiveTab('select')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'select'
                  ? 'bg-brand text-white shadow-lg shadow-red-950/50'
                  : 'bg-slate-800/80 text-slate-400 hover:text-white'
              }`}
            >
              <FolderOpen className="h-4 w-4" />
              <span>Выбор карты</span>
              {serverVenues.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 font-mono">
                  {serverVenues.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('create')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'create'
                  ? 'bg-brand text-white shadow-lg shadow-red-950/50'
                  : 'bg-slate-800/80 text-slate-400 hover:text-white'
              }`}
            >
              <Plus className="h-4 w-4" />
              <span>Создать новую</span>
            </button>
          </div>

          {/* Вкладка 1: Список доступных карт на сервере */}
          {activeTab === 'select' && (
            <div className="flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Server className="h-3.5 w-3.5 text-cyan-400" />
                  Опубликованные карты на сервере
                </span>
                <button
                  onClick={() => void fetchVenues()}
                  disabled={loadingVenues}
                  className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 p-1 rounded-lg hover:bg-slate-800 transition"
                  title="Обновить список"
                >
                  <RefreshCw className={`h-3 w-3 ${loadingVenues ? 'animate-spin' : ''}`} />
                  <span>Обновить</span>
                </button>
              </div>

              {loadingVenues && (
                <div className="flex-1 flex flex-col items-center justify-center py-12 text-slate-400 text-xs gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-brand" />
                  <span>Загружаем список карт с сервера…</span>
                </div>
              )}

              {loadError && (
                <div className="rounded-xl border border-red-800/60 bg-red-950/30 p-3 text-xs text-red-300 mb-3">
                  {loadError}
                </div>
              )}

              {!loadingVenues && serverVenues.length === 0 && !loadError && (
                <div className="flex-1 flex flex-col items-center justify-center py-10 text-center text-slate-400">
                  <Map className="h-10 w-10 text-slate-600 mb-2" />
                  <p className="text-xs font-medium text-slate-300">На сервере пока нет опубликованных карт</p>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-xs">
                    Создайте свою первую карту выставочного пространства во вкладке «Создать новую».
                  </p>
                  <button
                    onClick={() => setActiveTab('create')}
                    className="mt-4 btn-primary text-xs py-2 px-4"
                  >
                    <Plus className="h-4 w-4" /> Создать карту
                  </button>
                </div>
              )}

              {!loadingVenues && serverVenues.length > 0 && (
                <div className="space-y-2.5 overflow-y-auto max-h-[360px] pr-1">
                  {serverVenues.map((item) => {
                    const floorsCount = item.floors.length;
                    const pointsCount = item.floors.reduce((sum, f) => sum + f.points.length, 0);
                    const wallsCount = item.floors.reduce((sum, f) => sum + (f.walls?.length ?? 0), 0);

                    return (
                      <div
                        key={item.id || item.slug}
                        className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800/90 hover:border-slate-700 transition-all shadow-sm"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-white truncate">{item.title}</span>
                            <span className="text-[10px] font-mono bg-slate-800 text-cyan-300 px-1.5 py-0.5 rounded border border-slate-700/60">
                              /m/{item.slug}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400">
                            <span>{floorsCount} эт.</span>
                            <span>•</span>
                            <span>{pointsCount} точек (POI)</span>
                            {wallsCount > 0 && (
                              <>
                                <span>•</span>
                                <span>{wallsCount} стен</span>
                              </>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => loadProject(item)}
                          className="shrink-0 flex items-center justify-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-red-600 to-[#E30613] hover:from-red-500 hover:to-red-600 active:scale-95 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
                        >
                          <span>Редактировать</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {savedDraft && (
                <div className="mt-auto pt-4 border-t border-slate-800/80">
                  <button
                    className="btn w-full text-xs py-2 text-amber-400 border-amber-900/40 hover:bg-amber-950/20"
                    onClick={() => loadProject(savedDraft.venue)}
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Восстановить локальный черновик («{savedDraft.venue.title}»)
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Вкладка 2: Форма создания новой карты */}
          {activeTab === 'create' && (
            <div className="flex-1 flex flex-col justify-between">
              <div className="space-y-4">
                <div>
                  <label className="label">Название площадки</label>
                  <input
                    className="field"
                    value={title}
                    onChange={(event) => handleTitle(event.target.value)}
                    placeholder="Например, Форум ТТК 2026"
                  />
                </div>
                <div>
                  <label className="label">Slug для публичной ссылки</label>
                  <input
                    className="field font-mono"
                    value={slug}
                    onChange={(event) => {
                      setSlugTouched(true);
                      setSlug(slugify(event.target.value));
                    }}
                    placeholder="ttk-forum-2026"
                  />
                  <p className="mt-1 text-[10px] text-slate-500">
                    Публичный адрес для QR-кода: <span className="font-mono text-slate-400">/m/{slug || '...'}</span>
                  </p>
                </div>
                <div>
                  <label className="label">Описание</label>
                  <textarea
                    className="field min-h-20 resize-none"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Описание площадки (необязательно)"
                  />
                </div>
                <button className="btn-primary w-full py-2.5 font-bold" onClick={create}>
                  <Plus className="h-4 w-4" /> Создать карту
                </button>
              </div>

              {savedDraft && (
                <div className="mt-4 pt-3 border-t border-slate-800/80">
                  <button
                    className="btn w-full text-xs py-2 text-amber-400 border-amber-900/40 hover:bg-amber-950/20"
                    onClick={() => loadProject(savedDraft.venue)}
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Восстановить локальный черновик («{savedDraft.venue.title}»)
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
