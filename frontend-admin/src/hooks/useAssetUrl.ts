import { useEffect, useState } from 'react';
import { resolveAssetUrl } from '../services/localAssets';

export function useAssetUrl(url?: string, assetId?: string): string | null {
  const [resolved, setResolved] = useState<string | null>(() => {
    if (!assetId && !url?.startsWith('local-asset://')) return url || null;
    return null;
  });

  useEffect(() => {
    let cancelled = false;
    if (!url && !assetId) {
      setResolved(null);
      return;
    }
    if (url && !url.startsWith('local-asset://')) {
      setResolved(url);
      return;
    }
    if (!assetId && !url?.startsWith('local-asset://')) {
      setResolved(url ?? null);
      return;
    }
    setResolved(null);
    resolveAssetUrl(url ?? '', assetId)
      .then((value) => {
        if (!cancelled) setResolved(value);
      })
      .catch(() => {
        if (!cancelled) setResolved(url ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [url, assetId]);

  return resolved;
}
