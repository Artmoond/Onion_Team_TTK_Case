/**
 * Утилита парсинга содержимого QR-кодов и ссылок для приложения ТТК Карта Пространства
 */

export interface ParsedQrResult {
  slug: string;
  poiId?: string;
  floorId?: string;
  raw: string;
}

/**
 * Распознаёт slug площадки и параметры точки (poi) из отсканированного текста
 * Поддерживаемые форматы:
 * - Полный URL: https://example.com/m/ttk-expo
 * - URL с параметрами: https://example.com/m/ttk-expo?poi=poi-ttk-stand
 * - Старый формат запроса: https://example.com/?venue=ttk-expo&poi=poi-1
 * - Относительный путь: /m/ttk-expo
 * - Прямой slug: ttk-expo, hall-a, expo_2026
 */
export function parseQrTarget(raw: string): ParsedQrResult | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    let url: URL | null = null;

    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      url = new URL(trimmed);
    } else if (trimmed.startsWith('/')) {
      url = new URL(trimmed, 'http://dummy.local');
    } else if (trimmed.includes('?venue=') || trimmed.includes('/m/')) {
      url = new URL('https://' + trimmed);
    }

    if (url) {
      // 1. Поиск в пути /m/{slug}
      const pathMatch = url.pathname.match(/\/m\/([^/?#]+)/i);
      if (pathMatch) {
        const slug = decodeURIComponent(pathMatch[1]);
        const poiId = url.searchParams.get('poi') || undefined;
        const floorId = url.searchParams.get('floor') || undefined;
        return { slug, poiId, floorId, raw: trimmed };
      }

      // 2. Поиск в query параметре ?venue={slug}
      const venueParam = url.searchParams.get('venue');
      if (venueParam) {
        const poiId = url.searchParams.get('poi') || undefined;
        const floorId = url.searchParams.get('floor') || undefined;
        return { slug: venueParam, poiId, floorId, raw: trimmed };
      }
    }
  } catch (err) {
    console.warn('URL parsing failed, falling back to direct slug check:', err);
  }

  // 3. Прямой slug площадки: латиница, кириллица, цифры, дефис, подчеркивание
  const cleanSlug = trimmed.replace(/^[/#?]+/, '').trim();
  if (/^[a-zA-Z0-9_\-\u0400-\u04FF]+$/.test(cleanSlug)) {
    return { slug: cleanSlug, raw: trimmed };
  }

  return null;
}
