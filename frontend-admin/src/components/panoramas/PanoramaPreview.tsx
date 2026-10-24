import { Maximize2, X } from 'lucide-react';
import { useState } from 'react';
import { useAssetUrl } from '../../hooks/useAssetUrl';
import type { Panorama } from '../../types/venue';

interface PanoramaPreviewProps {
  panorama: Panorama;
  compact?: boolean;
}

export function PanoramaPreview({ panorama, compact }: PanoramaPreviewProps) {
  const [expanded, setExpanded] = useState(false);
  const url = useAssetUrl(panorama.previewUrl || panorama.url, panorama.asset?.id);

  if (!url) {
    return <div className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-8 text-center text-[10px] text-slate-500">Панорама не загружена</div>;
  }

  return (
    <>
      <div className="relative overflow-hidden rounded-lg border border-slate-700 bg-slate-950">
        <img src={url} alt="Предпросмотр панорамы" className={`w-full object-cover ${compact ? 'h-24' : 'h-36'}`} />
        <button
          className="absolute right-2 top-2 rounded-md bg-black/60 p-1.5 text-white backdrop-blur transition hover:bg-black/80"
          onClick={() => setExpanded(true)}
          title="Открыть панораму"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
        {panorama.hotspots.length > 0 && (
          <div className="absolute bottom-2 left-2 rounded bg-black/60 px-1.5 py-0.5 text-[9px] text-slate-200 backdrop-blur">
            {panorama.hotspots.length} hotsp.
          </div>
        )}
      </div>
      {expanded && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-black/95 p-4">
          <div className="mb-3 flex items-center justify-between text-xs text-slate-300">
            <span className="font-semibold">Просмотр панорамы · перетаскивайте изображение по горизонтали</span>
            <button className="rounded-md p-1 hover:bg-slate-800" onClick={() => setExpanded(false)}>
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-auto rounded-xl border border-slate-800">
            <img src={url} alt="Панорама 360" className="h-full min-h-[60vh] w-auto max-w-none" />
          </div>
        </div>
      )}
    </>
  );
}
