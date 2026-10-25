import { Suspense, lazy, useEffect, useState } from 'react';
import { PanelLeft, SlidersHorizontal, X } from 'lucide-react';
import { AuthScreen } from './components/auth/AuthScreen';
import { FloorTabs } from './components/floors/FloorTabs';
import { ConfirmDialog } from './components/layout/ConfirmDialog';
import { PropertiesPanel } from './components/layout/PropertiesPanel';
import { Sidebar } from './components/layout/Sidebar';
import { ToastView } from './components/layout/Toast';
import { TopBar } from './components/layout/TopBar';
import { BackendVenuesModal } from './components/project/BackendVenuesModal';
import { ProjectStartScreen } from './components/project/ProjectStartScreen';
import { PublishQrModal } from './components/publish/PublishQrModal';
import { AuthError, getCurrentUser, logoutOrganizer, type AuthUser } from './services/auth';
import { persistCurrentDraft, useActiveFloor, useEditorStore } from './store/editorStore';

const EditorCanvas = lazy(() => import('./components/editor/EditorCanvas').then((module) => ({ default: module.EditorCanvas })));

export default function App() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [authServiceUnavailable, setAuthServiceUnavailable] = useState<string | null>(null);
  const showToast = useEditorStore((state) => state.showToast);
  const venue = useEditorStore((state) => state.venue);
  const activeFloor = useActiveFloor();
  const activeFloorId = useEditorStore((state) => state.activeFloorId);
  const settings = useEditorStore((state) => state.settings);
  const dirty = useEditorStore((state) => state.dirty);
  const clearProject = useEditorStore((state) => state.clearProject);
  const [backendOpen, setBackendOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<'tools' | 'properties' | null>(null);

  useEffect(() => {
    let active = true;
    getCurrentUser()
      .then((user) => {
        if (!active) return;
        setAuthUser(user);
        setAuthServiceUnavailable(null);
      })
      .catch((error: unknown) => {
        if (!active) return;
        const message = error instanceof AuthError && error.status === 404
          ? 'Сервис авторизации ещё не подключён на backend. Вход и регистрация станут доступны после реализации API.'
          : 'Не удалось проверить сессию. Убедитесь, что backend авторизации доступен.';
        setAuthServiceUnavailable(message);
      })
      .finally(() => {
        if (active) setAuthChecking(false);
      });
    return () => { active = false; };
  }, []);

  const signOut = async () => {
    setAuthUser(null);
    clearProject(true);
    try {
      await logoutOrganizer();
    } catch (error) {
      showToast('error', 'Не удалось завершить сессию на сервере', error instanceof Error ? error.message : 'При следующем открытии аккаунт может войти автоматически.');
      return;
    }
    showToast('info', 'Вы вышли из аккаунта');
  };

  useEffect(() => {
    if (!venue || !authUser) return;
    const timer = window.setTimeout(() => {
      persistCurrentDraft();
    }, 600);
    return () => window.clearTimeout(timer);
  }, [venue, activeFloorId, settings, authUser]);

  useEffect(() => {
    if (!venue || !authUser) return;
    const handler = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty, venue, authUser]);

  if (authChecking) {
    return <div className="grid min-h-screen place-items-center bg-slate-950 text-sm text-slate-400">Проверяем авторизацию…</div>;
  }

  if (!authUser) {
    return (
      <>
        <AuthScreen onAuthenticated={(user) => { setAuthServiceUnavailable(null); setAuthUser(user); }} serviceUnavailable={authServiceUnavailable} />
        <ToastView />
      </>
    );
  }

  if (!venue) {
    return (
      <>
        <ProjectStartScreen onLogout={() => { void signOut(); }} />
        <ToastView />
      </>
    );
  }

  const totalPoints = venue.floors.reduce((sum, floor) => sum + floor.points.length, 0);
  const totalWalls = venue.floors.reduce((sum, floor) => sum + (floor.walls?.length ?? 0), 0);
  const totalStairs = venue.floors.reduce((sum, floor) => sum + (floor.stairs?.length ?? 0), 0);
  const totalPanoramas = venue.floors.reduce((sum, floor) => sum + floor.panoramas.length, 0);

  return (
    <div className="editor-shell flex h-screen w-screen flex-col overflow-hidden bg-slate-950 text-slate-100">
      <TopBar
        onLogout={() => setLogoutConfirmOpen(true)}
        onOpenBackend={() => setBackendOpen(true)}
        onOpenPublish={() => setPublishOpen(true)}
        onNewProject={() => setNewProjectOpen(true)}
      />
      <FloorTabs />
      <div className="editor-workspace relative flex min-h-0 flex-1">
        {mobilePanel && <button className="mobile-drawer-backdrop" aria-label="Закрыть панель" onClick={() => setMobilePanel(null)} />}
        <div className={`mobile-sidebar-container${mobilePanel === 'tools' ? ' is-open' : ''}`}>
          {mobilePanel === 'tools' && <div className="mobile-drawer-heading"><span>Инструменты и объекты</span><button onClick={() => setMobilePanel(null)} aria-label="Закрыть"><X className="h-4 w-4" /></button></div>}
          <Sidebar />
        </div>
        <main className="relative min-w-0 flex-1">
          <Suspense fallback={<div className="grid h-full place-items-center text-xs text-slate-500">Загрузка редактора…</div>}>
            <EditorCanvas />
          </Suspense>
        </main>
        <div className={`mobile-properties-container${mobilePanel === 'properties' ? ' is-open' : ''}`}>
          {mobilePanel === 'properties' && <div className="mobile-drawer-heading"><span>Свойства</span><button onClick={() => setMobilePanel(null)} aria-label="Закрыть"><X className="h-4 w-4" /></button></div>}
          <PropertiesPanel />
        </div>
      </div>
      <nav className="mobile-editor-nav" aria-label="Панели редактора">
        <button className={mobilePanel === 'tools' ? 'active' : ''} onClick={() => setMobilePanel(mobilePanel === 'tools' ? null : 'tools')}><PanelLeft className="h-5 w-5" /><span>Инструменты</span></button>
        <button className={mobilePanel === 'properties' ? 'active' : ''} onClick={() => setMobilePanel(mobilePanel === 'properties' ? null : 'properties')}><SlidersHorizontal className="h-5 w-5" /><span>Свойства</span></button>
      </nav>
      <footer className="z-20 flex h-7 shrink-0 items-center gap-4 border-t border-slate-800 bg-slate-900 px-3 text-[9px] text-slate-500">
        <span className="font-mono">schema v{venue.schemaVersion ?? 1}</span>
        <span>{activeFloor?.name ?? '—'}</span>
        <span className="text-slate-600">|</span>
        <span>Точки: {totalPoints}</span>
        <span>Стены: {totalWalls}</span>
        <span>Лестницы: {totalStairs}</span>
        <span>Панорамы: {totalPanoramas}</span>
        <span className="ml-auto">Ctrl+Z / Ctrl+Shift+Z · Delete · Esc</span>
        <span className={dirty ? 'text-amber-400' : 'text-emerald-500'}>{dirty ? 'есть несохранённые изменения' : 'черновик сохранён'}</span>
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

      <ConfirmDialog
        open={logoutConfirmOpen}
        title="Выйти из аккаунта?"
        text={dirty
          ? 'Есть несохранённые изменения. Черновик сохраняется автоматически в этом браузере.'
          : 'Для продолжения работы потребуется войти снова.'}
        confirmLabel="Выйти"
        onCancel={() => setLogoutConfirmOpen(false)}
        onConfirm={() => {
          setLogoutConfirmOpen(false);
          void signOut();
        }}
      />

      <ToastView />
    </div>
  );
}
