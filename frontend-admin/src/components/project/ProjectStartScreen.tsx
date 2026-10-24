import { FolderOpen, Map, Plus, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { demoVenue } from '../../data/demoVenue';
import { useEditorStore } from '../../store/editorStore';
import { slugify } from '../../utils/id';
import { isValidSlug } from '../../utils/validation';
import { BackendVenuesModal } from './BackendVenuesModal';

interface ProjectStartScreenProps {
  onQrUnavailable?: () => void;
}

export function ProjectStartScreen(_props: ProjectStartScreenProps) {
  const createProject = useEditorStore((state) => state.createProject);
  const loadProject = useEditorStore((state) => state.loadProject);
  const showToast = useEditorStore((state) => state.showToast);
  const [title, setTitle] = useState('Экспоцентр ТТК 2026');
  const [slug, setSlug] = useState('ttk-expo-2026');
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState('Интерактивная карта павильона для посетителей мероприятия.');
  const [backendOpen, setBackendOpen] = useState(false);

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
      <div className="relative grid w-full max-w-5xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
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

        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-2xl">
          <div className="mb-5 flex items-center gap-2">
            <Plus className="h-4 w-4 text-brand" />
            <h2 className="text-sm font-bold text-white">Новый проект</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="label">Название площадки</label>
              <input className="field" value={title} onChange={(event) => handleTitle(event.target.value)} />
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
              />
              <p className="mt-1 text-[10px] text-slate-500">Используется в адресе /m/{slug || 'slug'}</p>
            </div>
            <div>
              <label className="label">Описание</label>
              <textarea
                className="field min-h-20 resize-none"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
            <button className="btn-primary w-full py-2.5" onClick={create}>
              <Plus className="h-4 w-4" /> Создать карту
            </button>
          </div>

          <div className="my-5 flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider text-slate-600">
            <span className="h-px flex-1 bg-slate-800" /> или <span className="h-px flex-1 bg-slate-800" />
          </div>

          <div className="grid gap-2">
            <button className="btn" onClick={() => loadProject(structuredClone(demoVenue))}>
              <Sparkles className="h-4 w-4 text-amber-400" /> Открыть демо-карту
            </button>
            <button className="btn" onClick={() => setBackendOpen(true)}>
              <FolderOpen className="h-4 w-4 text-cyan-400" /> Открыть карту с сервера
            </button>
          </div>
          <p className="mt-4 flex items-center gap-1.5 text-[10px] text-slate-500">
            <Map className="h-3.5 w-3.5" /> План можно загрузить после создания проекта.
          </p>
        </div>
      </div>

      {backendOpen && <BackendVenuesModal onClose={() => setBackendOpen(false)} />}
    </div>
  );
}
