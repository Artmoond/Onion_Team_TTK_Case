import type { RoomPoint, Stair, Wall } from '../types/venue';

export function pixelDistance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1);
}

export function metersForPixels(pixels: number, metersPerPixel: number): number {
  return pixels * (Number.isFinite(metersPerPixel) && metersPerPixel > 0 ? metersPerPixel : 0);
}

export function wallLength(x1: number, y1: number, x2: number, y2: number, metersPerPixel: number): number {
  return round(metersForPixels(pixelDistance(x1, y1, x2, y2), metersPerPixel), 2);
}

export function withWallLength(wall: Pick<Wall, 'x1' | 'y1' | 'x2' | 'y2'>, metersPerPixel: number): number {
  return wallLength(wall.x1, wall.y1, wall.x2, wall.y2, metersPerPixel);
}

type StairLine = Pick<Stair, 'x1' | 'y1' | 'x2' | 'y2' | 'width'>;

export function stairCorners(stair: StairLine): RoomPoint[] | null {
  const length = pixelDistance(stair.x1, stair.y1, stair.x2, stair.y2);
  if (length < 1 || !Number.isFinite(stair.width) || stair.width <= 0) return null;
  const dx = (stair.x2 - stair.x1) / length;
  const dy = (stair.y2 - stair.y1) / length;
  const half = stair.width / 2;
  const nx = -dy * half;
  const ny = dx * half;
  return [
    { x: stair.x1 + nx, y: stair.y1 + ny },
    { x: stair.x2 + nx, y: stair.y2 + ny },
    { x: stair.x2 - nx, y: stair.y2 - ny },
    { x: stair.x1 - nx, y: stair.y1 - ny },
  ];
}

export function stairStepLines(stair: StairLine): RoomPoint[][] {
  const corners = stairCorners(stair);
  if (!corners) return [];
  const length = pixelDistance(stair.x1, stair.y1, stair.x2, stair.y2);
  const count = Math.max(3, Math.min(24, Math.round(length / 28)));
  const lines: RoomPoint[][] = [];
  for (let index = 1; index < count; index += 1) {
    const ratio = index / count;
    lines.push([
      {
        x: corners[0].x + (corners[1].x - corners[0].x) * ratio,
        y: corners[0].y + (corners[1].y - corners[0].y) * ratio,
      },
      {
        x: corners[3].x + (corners[2].x - corners[3].x) * ratio,
        y: corners[3].y + (corners[2].y - corners[3].y) * ratio,
      },
    ]);
  }
  return lines;
}

export function stairLengthMeters(stair: Pick<Stair, 'x1' | 'y1' | 'x2' | 'y2'>, metersPerPixel: number): number {
  return wallLength(stair.x1, stair.y1, stair.x2, stair.y2, metersPerPixel);
}

export function stairWidthMeters(stair: Pick<Stair, 'width'>, metersPerPixel: number): number {
  return metersForPixels(stair.width, metersPerPixel);
}

export function calibration(pixelLength: number, meters: number): number {
  if (!Number.isFinite(pixelLength) || pixelLength <= 0 || !Number.isFinite(meters) || meters <= 0) {
    return 0;
  }
  return meters / pixelLength;
}

export function polygonArea(points: RoomPoint[]): number {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    sum += current.x * next.y - next.x * current.y;
  }
  return Math.abs(sum) / 2;
}

export function polygonAreaMeters(points: RoomPoint[], metersPerPixel: number): number {
  return round(polygonArea(points) * metersPerPixel * metersPerPixel, 2);
}

export function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function formatMeters(value: number): string {
  return `${round(value, 2).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} м`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function pointsBounds(points: RoomPoint[]): { x: number; y: number; width: number; height: number } | null {
  if (!points.length) return null;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { x: minX, y: minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY };
}
