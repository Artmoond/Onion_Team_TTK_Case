import type { AssetReference, Venue } from '../types/venue';
import { safeFileName } from '../utils/validation';
import { getLocalAsset } from './localAssets';
import { saveVenue, uploadAsset } from './api';
import { serializeVenue } from './serialization';

export interface PublishProgress {
  done: number;
  total: number;
  label: string;
}

function cloneVenue(venue: Venue): Venue {
  return typeof structuredClone === 'function' ? structuredClone(venue) : (JSON.parse(JSON.stringify(venue)) as Venue);
}

type AssetSource = 'local' | 'relative';

function hasScheme(url: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(url);
}

function isLocalAsset(ref: AssetReference): boolean {
  return ref.storage === 'local' || ref.url.startsWith('local-asset://');
}

function isServerRelativeUrl(url: string): boolean {
  const trimmed = url.trim();
  // Only bundled demo assets are copied during publishing. Never fetch arbitrary
  // relative paths from a venue document.
  return trimmed.startsWith('/demo/') && !trimmed.startsWith('//') && !hasScheme(trimmed);
}

function assetSource(ref: AssetReference): AssetSource | null {
  if (isLocalAsset(ref)) return 'local';
  if (isServerRelativeUrl(ref.url)) return 'relative';
  return null;
}

function uploadableAssetRefs(venue: Venue): AssetReference[] {
  const refs: AssetReference[] = [];
  for (const floor of venue.floors) {
    if (floor.planAsset) refs.push(floor.planAsset);
    for (const panorama of floor.panoramas) {
      if (panorama.asset) refs.push(panorama.asset);
    }
  }
  const unique = new Map<string, AssetReference>();
  for (const ref of refs) {
    if (assetSource(ref)) unique.set(ref.id, ref);
  }
  return [...unique.values()];
}

export function countAssetsToUpload(venue: Venue): number {
  return uploadableAssetRefs(venue).length;
}

export async function publishVenue(
  venue: Venue,
  onProgress?: (progress: PublishProgress) => void
): Promise<{ venue: Venue; uploaded: number }> {
  const next = cloneVenue(venue);
  const refs = uploadableAssetRefs(next);
  const uploadedAssets = new Map<string, AssetReference>();
  const total = refs.length + 1;
  let done = 0;

  for (const ref of refs) {
    onProgress?.({ done, total, label: `Загрузка ${ref.fileName}` });
    const source = assetSource(ref);
    let blob: Blob;
    if (source === 'local') {
      const localBlob = await getLocalAsset(ref.id);
      if (!localBlob) {
        throw new Error(
          `Локальный файл «${ref.fileName}» не найден в IndexedDB. Замените файл в редакторе и повторите публикацию.`
        );
      }
      blob = localBlob;
    } else if (source === 'relative') {
      let response: Response;
      try {
        response = await fetch(ref.url);
      } catch {
        throw new Error(`Не удалось прочитать файл «${ref.fileName}» по адресу ${ref.url}.`);
      }
      if (!response.ok) {
        throw new Error(`Не удалось прочитать файл «${ref.fileName}» по адресу ${ref.url} (${response.status}).`);
      }
      blob = await response.blob();
    } else {
      continue;
    }
    if (!blob.size || blob.size > 25 * 1024 * 1024) {
      throw new Error(`Файл «${ref.fileName}» пустой или превышает лимит 25 МБ.`);
    }
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'].includes(blob.type)) {
      throw new Error(`Файл «${ref.fileName}» имеет неподдерживаемый тип ${blob.type || 'неизвестно'}.`);
    }
    const result = await uploadAsset(blob, `${ref.id}-${safeFileName(ref.fileName)}`);
    uploadedAssets.set(ref.id, {
      ...ref,
      storage: 'server',
      url: result.url,
      sizeBytes: result.size || blob.size || ref.sizeBytes,
    });
    done += 1;
    onProgress?.({ done, total, label: `Загружено: ${ref.fileName}` });
  }

  for (const floor of next.floors) {
    if (floor.planAsset) {
      const serverAsset = uploadedAssets.get(floor.planAsset.id);
      if (serverAsset) {
        floor.planAsset = serverAsset;
        floor.planUrl = serverAsset.url;
      }
    }
    for (const panorama of floor.panoramas) {
      if (panorama.asset) {
        const serverAsset = uploadedAssets.get(panorama.asset.id);
        if (serverAsset) {
          panorama.asset = serverAsset;
          panorama.url = serverAsset.url;
          panorama.previewUrl = serverAsset.url;
        }
      }
    }
  }

  onProgress?.({ done, total, label: 'Сохранение данных карты' });
  const payload = JSON.parse(serializeVenue(next)) as Venue;
  await saveVenue(payload);
  onProgress?.({ done: total, total, label: 'Готово' });

  return { venue: payload, uploaded: refs.length };
}
