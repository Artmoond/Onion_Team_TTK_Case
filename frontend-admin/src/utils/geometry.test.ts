import { describe, expect, it } from 'vitest';
import {
  calibration,
  metersForPixels,
  polygonAreaMeters,
  stairCorners,
  stairLengthMeters,
  stairStepLines,
  stairWidthMeters,
  wallLength,
} from './geometry';

describe('geometry', () => {
  it('computes wall length using metersPerPixel', () => {
    expect(wallLength(0, 0, 100, 0, 0.05)).toBe(5);
    expect(wallLength(0, 0, 3, 4, 2)).toBe(10);
  });

  it('does not treat pixels as meters when scale is missing', () => {
    expect(metersForPixels(100, 0)).toBe(0);
  });

  it('calibrates scale from a known distance', () => {
    expect(calibration(200, 10)).toBeCloseTo(0.05);
    expect(calibration(0, 10)).toBe(0);
  });

  it('computes room area in square meters', () => {
    const room = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];
    expect(polygonAreaMeters(room, 0.05)).toBe(25);
  });

  it('builds stair outline, width and step lines', () => {
    const stair = { x1: 0, y1: 0, x2: 100, y2: 0, width: 20 };
    expect(stairCorners(stair)).toEqual([
      { x: 0, y: 10 },
      { x: 100, y: 10 },
      { x: 100, y: -10 },
      { x: 0, y: -10 },
    ]);

    const steps = stairStepLines(stair);
    expect(steps.length).toBe(3);
    expect(steps[0][0]).toEqual({ x: 25, y: 10 });
    expect(steps[0][1]).toEqual({ x: 25, y: -10 });
    expect(stairLengthMeters(stair, 0.05)).toBe(5);
    expect(stairWidthMeters(stair, 0.05)).toBe(1);
    expect(stairCorners({ ...stair, width: 0 })).toBeNull();
  });
});
