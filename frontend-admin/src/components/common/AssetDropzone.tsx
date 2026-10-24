import { FileImage, Loader2, UploadCloud } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { createLocalAsset } from '../../services/localAssets';
import type { AssetReference } from '../../types/venue';
import { formatBytes, MAX_PANORAMA_BYTES, MAX_PLAN_BYTES, PANORAMA_MIME_TYPES, PLAN_MIME_TYPES, validateFile } from '../../utils/validation';

interface AssetDropzoneProps {
  kind: 'plan' | 'panorama';
  onAsset: (asset: AssetReference) => void;
  disabled?: boolean;
  compact?: boolean;
}

export function AssetDropzone({ kind, onAsset, disabled, compact }: AssetDropzoneProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mimeTypes = kind === 'plan' ? PLAN_MIME_TYPES : PANORAMA_MIME_TYPES;
  const maxBytes = kind === 'plan' ? MAX_PLAN_BYTES : MAX_PANORAMA_BYTES;
  const label = kind === 'plan' ? 'Загрузить план павильона' : 'Загрузить панораму 360°';
  const hint = kind === 'plan' ? 'PNG, JPG, WebP или SVG · до 12 МБ' : 'JPEG, PNG или WebP · до 25 МБ · желательно 2:1';

  const handleFile = useCallback(
    async (file: File) => {
      const validationError = validateFile(file, mimeTypes, maxBytes);
      if (validationError) {
        setError(validationError);
        return;
      }
      setError(null);
      setBusy(true);
      try {
        const asset = await createLocalAsset(file, { readDimensions: true });
        onAsset(asset);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Не удалось сохранить файл локально.');
      } finally {
        setBusy(false);
      }
    },
    [maxBytes, mimeTypes, onAsset]
  );

  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted[0]) void handleFile(accepted[0]);
    },
    [handleFile]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected: (rejections) => {
      setError(rejections[0]?.errors[0]?.message ?? 'Файл не подходит.');
    },
    multiple: false,
    disabled: disabled || busy,
  });

  return (
    <div>
      <div
        {...getRootProps()}
        className={`cursor-pointer rounded-xl border border-dashed text-center transition ${
          isDragActive
            ? 'border-cyan-400 bg-cyan-950/30'
            : 'border-slate-700 bg-slate-900/60 hover:border-slate-600 hover:bg-slate-800/40'
        } ${busy || disabled ? 'cursor-wait opacity-70' : ''} ${compact ? 'px-3 py-3' : 'px-4 py-6'}`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-1.5">
          {busy ? (
            <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
          ) : kind === 'plan' ? (
            <FileImage className="h-5 w-5 text-cyan-400" />
          ) : (
            <UploadCloud className="h-5 w-5 text-violet-400" />
          )}
          <div className="text-xs font-semibold text-slate-200">{busy ? 'Сохраняем файл…' : label}</div>
          <div className="text-[10px] text-slate-500">{isDragActive ? 'Отпустите файл' : hint}</div>
          {kind === 'panorama' && <div className="text-[9px] text-slate-600">максимум {formatBytes(MAX_PANORAMA_BYTES)}</div>}
        </div>
      </div>
      {error && <p className="mt-1.5 rounded-md border border-red-900/60 bg-red-950/30 px-2 py-1.5 text-[10px] text-red-300">{error}</p>}
    </div>
  );
}
