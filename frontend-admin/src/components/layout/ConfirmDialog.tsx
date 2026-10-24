import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  text: string;
  confirmLabel?: string;
  tone?: 'danger' | 'normal';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  text,
  confirmLabel = 'Подтвердить',
  tone = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;
  return (
    <Modal
      title={title}
      onClose={onCancel}
      widthClassName="max-w-md"
      footer={
        <div className="flex justify-end gap-2">
          <button className="btn" onClick={onCancel}>
            Отмена
          </button>
          <button
            className={tone === 'danger' ? 'btn border-red-700 bg-red-600 text-white hover:bg-red-500' : 'btn-primary'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      }
    >
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-amber-500/10 p-2 text-amber-400">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <p className="pt-1 text-sm leading-relaxed text-slate-300">{text}</p>
      </div>
    </Modal>
  );
}
