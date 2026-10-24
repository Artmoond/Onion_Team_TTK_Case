import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useEffect } from 'react';
import { useEditorStore } from '../../store/editorStore';

const tones = {
  success: { icon: CheckCircle2, className: 'border-emerald-700/70 bg-emerald-950/90 text-emerald-200' },
  error: { icon: AlertCircle, className: 'border-red-700/70 bg-red-950/90 text-red-200' },
  info: { icon: Info, className: 'border-cyan-700/70 bg-cyan-950/90 text-cyan-200' },
};

export function ToastView() {
  const toast = useEditorStore((state) => state.toast);
  const dismiss = useEditorStore((state) => state.dismissToast);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(dismiss, 4500);
    return () => window.clearTimeout(timer);
  }, [toast, dismiss]);

  if (!toast) return null;
  const tone = tones[toast.tone];
  const Icon = tone.icon;
  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-[70] w-full max-w-md -translate-x-1/2 px-4">
      <div className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-2xl backdrop-blur ${tone.className}`}>
        <Icon className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold">{toast.title}</div>
          {toast.text && <div className="mt-0.5 text-xs opacity-80">{toast.text}</div>}
        </div>
        <button onClick={dismiss} className="rounded p-1 opacity-60 transition hover:opacity-100" aria-label="Закрыть уведомление">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
