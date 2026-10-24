import { Suspense, lazy, useEffect, useState } from 'react';
import AuthScreen from './components/AuthScreen';
import { clearSession, logoutSession, restoreSession, type Session } from './lib/auth';
import { FloorTabs } from './components/floors/FloorTabs';
import { ConfirmDialog } from './components/layout/ConfirmDialog';
import { PropertiesPanel } from './components/layout/PropertiesPanel';
import { Sidebar } from './components/layout/Sidebar';
import { ToastView } from './components/layout/Toast';
import { TopBar } from './components/layout/TopBar';
import { BackendVenuesModal } from './components/project/BackendVenuesModal';
import { ProjectStartScreen } from './components/project/ProjectStartScreen';
import { PublishQrModal } from './components/publish/PublishQrModal';
import { persistCurrentDraft, useActiveFloor, useEditorStore } from './store/editorStore';

const EditorCanvas = lazy(() => import('./components/editor/EditorCanvas').then((module) => ({ default: module.EditorCanvas })));

interface StudioProps {
  session: Session;
  onLogout: () => Promise<void>;
}

function Studio({ session, onLogout }: StudioProps) {
  const venue = useEditorStore((state) => state.venue);
  const activeFloor = useActiveFloor();
  const activeFloorId = useEditorStore((state) => state.activeFloorId);
  const settings = useEditorStore((state) => state.settings);
  const dirty = useEditorStore((state) => state.dirty);
  const clearProject = useEditorStore((state) => state.clearProject);
  const [backendOpen, setBackendOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);

  useEffect(() => {
    if (!venue) return;
    const timer = window.setTimeout(() => {
      persistCurrentDraft();
    }, 600);
    return () => window.clearTimeout(timer);
  }, [venue, activeFloorId, settings]);

  useEffect(() => {
    if (!venue) return;
    const handler = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty, venue]);

  if (!venue) {
    return (
      <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-950 text-slate-100">
        <header className="z-20 flex h-14 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900 px-4">
          <div className="flex items-center gap-3">
            <span className="rounded bg-brand px-2.5 py-1 text-xs font-black tracking-wider text-white">ТТК</span>
            <span className="text-sm font-bold text-white">Студия редактора</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800/80 py-1 pl-2.5 pr-1 text-xs"
              title={session.user.email}
            >
              <span className="max-w-[120px] truncate text-slate-200">{session.user.fullName}</span>
              <span className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-300">Организатор</span>
              <button
                onClick={() => { void onLogout(); }}
                title="Выйти"
                className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-700/70 hover:text-red-400"
              >
                ✕
              </button>
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-auto">
          <ProjectStartScreen />
        </div>
        <ToastView />
      </div>
    );
  }

  const totalPoints = venue.floors.reduce((sum, floor) => sum + floor.points.length, 0);
  const totalWalls = venue.floors.reduce((sum, floor) => sum + (floor.walls?.length ?? 0), 0);
  const totalStairs = venue.floors.reduce((sum, floor) => sum + (floor.stairs?.length ?? 0), 0);
  const totalPanoramas = venue.floors.reduce((sum, floor) => sum + floor.panoramas.length, 0);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-950 text-slate-100">
      <TopBar
        onOpenBackend={() => setBackendOpen(true)}
        onOpenPublish={() => setPublishOpen(true)}
        onNewProject={() => setNewProjectOpen(true)}
        session={session}
        onLogout={onLogout}
      />
      <FloorTabs />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="relative min-w-0 flex-1">
          <Suspense fallback={<div className="grid h-full place-items-center text-xs text-slate-500">Загрузка редактора…</div>}>
            <EditorCanvas />
          </Suspense>
        </main>
        <PropertiesPanel />
      </div>
      <footer className="z-20 flex h-7 shrink-0 items-center gap-4 border-t border-slate-800 bg-slate-900 px-3 text-[9px] text-slate-500">
        <span className="font-mono">schema v{venue.schemaVersion ?? 1}</span>
        <span>{activeFloor?.name ?? '—'}</span>
        <span className="text-slate-600">|</span>
        <span>Точки: {totalPoints}</span>
        <span>Стены: {totalWalls}</span>
        <span>Лестницы: {totalStairs}</span>
        <span>Панорамы: {totalPanoramas}</span>
        <span className="ml-auto">Ctrl+Z / Ctrl+Shift+Z · Delete · Esc</span>
        <span className={dirty ? 'text-amber-400' : 'text-emerald-500'}>
          {dirty ? 'есть несохранённые изменения' : 'черновик сохранён'}
        </span>
      </footer>

      {backendOpen && <BackendVenuesModal onClose={() => setBackendOpen(false)} />}
      {publishOpen && <PublishQrModal onClose={() => setPublishOpen(false)} />}

      <ConfirmDialog
        open={newProjectOpen}
        title="Создать новый проект?"
        text="Текущая карта будет закрыта. Локальный черновик заменится новым проектом. При необходимости сначала опубликуйте карту или сохраните черновик."
        confirmLabel="Создать новый"
        onCancel={() => setNewProjectOpen(false)}
        onConfirm={() => {
          setNewProjectOpen(false);
          clearProject();
        }}
      />

      <ToastView />
    </div>
  );
}

const CLIENT_URL = import.meta.env.VITE_CLIENT_URL || 'http://localhost:3000';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    let active = true;
    restoreSession()
      .then((restored) => {
        if (!active) return;
        if (restored && restored.user.role !== 'admin') {
          clearSession();
          setSession(null);
          return;
        }
        setSession(restored);
      })
      .finally(() => {
        if (active) setBooting(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleLogout = async () => {
    await logoutSession();
    setSession(null);
  };

  if (booting) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-slate-100">
        <div className="flex items-center gap-3 text-sm text-slate-400">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-700 border-t-[#E30613]" />
          Проверяем сессию…
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <AuthScreen
        mode="admin"
        alternateUrl={CLIENT_URL}
        onAuthenticated={setSession}
      />
    );
  }

  return <Studio session={session} onLogout={handleLogout} />;
}
