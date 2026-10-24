const DB_NAME = 'ttk-admin-assets';
const DB_VERSION = 1;
const STORE = 'assets';
const objectUrls = new Map<string, string>();

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB недоступен в этом окружении.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Не удалось открыть IndexedDB.'));
  });
}

export async function putLocalAsset(id: string, file: Blob): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(file, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Не удалось сохранить файл локально.'));
  });
  db.close();
}

export async function getLocalAsset(id: string): Promise<Blob | null> {
  const db = await openDb();
  const blob = await new Promise<Blob | null>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).get(id);
    request.onsuccess = () => resolve((request.result as Blob | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error('Не удалось прочитать локальный файл.'));
  });
  db.close();
  return blob;
}

export async function deleteLocalAsset(id: string): Promise<void> {
  const objectUrl = objectUrls.get(id);
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    objectUrls.delete(id);
  }
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Не удалось удалить локальный файл.'));
  });
  db.close();
}

export async function resolveAssetUrl(url: string, assetId?: string): Promise<string> {
  let id = assetId;
  if (!id && url.startsWith('local-asset://')) {
    id = url.slice('local-asset://'.length);
  }
  if (!id) return url;
  const cached = objectUrls.get(id);
  if (cached) return cached;
  const blob = await getLocalAsset(id);
  if (!blob) return url;
  const objectUrl = URL.createObjectURL(blob);
  objectUrls.set(id, objectUrl);
  return objectUrl;
}

export function localAssetUrl(assetId: string): string {
  return `local-asset://${assetId}`;
}

export async function readImageDimensions(file: Blob): Promise<{ width: number; height: number }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      const dimensions = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      return dimensions;
    } catch {
      // SVG и некоторые форматы не поддерживаются createImageBitmap — пробуем HTMLImageElement.
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
      URL.revokeObjectURL(url);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Не удалось определить размеры изображения.'));
    };
    image.src = url;
  });
}

async function prepareImageFile(file: File): Promise<Blob> {
  const header = new Uint8Array(await file.slice(0, 512).arrayBuffer());
  const isPng = header.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => header[i] === byte);
  const isJpeg = header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  const isWebp = header.length >= 12 && String.fromCharCode(...header.slice(0, 4)) === 'RIFF' && String.fromCharCode(...header.slice(8, 12)) === 'WEBP';
  if (isPng && file.type === 'image/png' || isJpeg && file.type === 'image/jpeg' || isWebp && file.type === 'image/webp') return file;

  if (file.type !== 'image/svg+xml') {
    throw new Error('Содержимое файла не совпадает с форматом изображения.');
  }

  const source = await file.text();
  if (source.length > 12 * 1024 * 1024) throw new Error('SVG слишком большой для обработки.');
  const parsed = new DOMParser().parseFromString(source, 'image/svg+xml');
  const root = parsed.documentElement;
  if (parsed.querySelector('parsererror') || root.localName.toLowerCase() !== 'svg') {
    throw new Error('Файл не является корректным SVG.');
  }
  root.querySelectorAll('script, foreignObject, iframe, object, embed, audio, video').forEach((node) => node.remove());
  for (const element of [root, ...Array.from(root.querySelectorAll('*'))]) {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      if (name.startsWith('on')) {
        element.removeAttribute(attribute.name);
      } else if ((name === 'href' || name.endsWith(':href')) && value && !value.startsWith('#')) {
        element.removeAttribute(attribute.name);
      } else if (name === 'style' && /url\s*\(|@import|expression\s*\(/i.test(value)) {
        element.removeAttribute(attribute.name);
      }
    }
  }
  root.querySelectorAll('style').forEach((node) => {
    if (/url\s*\(|@import|expression\s*\(/i.test(node.textContent ?? '')) node.remove();
  });
  return new Blob([new XMLSerializer().serializeToString(root)], { type: 'image/svg+xml' });
}

export interface LocalAssetOptions {
  fileName?: string;
  readDimensions?: boolean;
}

export async function createLocalAsset(file: File, options: LocalAssetOptions = {}): Promise<import('../types/venue').AssetReference> {
  const id = `asset-${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Date.now()}`;
  const safeFile = await prepareImageFile(file);
  await putLocalAsset(id, safeFile);
  let dimensions: { width: number; height: number } | undefined;
  if (options.readDimensions !== false) {
    try {
      dimensions = await readImageDimensions(safeFile);
    } catch {
      dimensions = undefined;
    }
  }
  return {
    id,
    fileName: options.fileName ?? file.name,
    mimeType: safeFile.type,
    sizeBytes: safeFile.size,
    storage: 'local',
    url: localAssetUrl(id),
    createdAt: new Date().toISOString(),
    width: dimensions?.width,
    height: dimensions?.height,
  };
}
