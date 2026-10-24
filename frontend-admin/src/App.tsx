import { Suspense, lazy, useEffect, useState } from 'react';
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

export default function App() {
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
      <>
        <ProjectStartScreen />
        <ToastView />
      </>
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

      <ToastView />
    </div>
  );
}
