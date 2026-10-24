import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { normalizeVenue, parseVenueJson, serializeVenue, VenueValidationError } from './serialization';

const mockPath = new URL('../../../shared/mock_venue.json', import.meta.url);

describe('venue serialization', () => {
  it('reads the shared mock venue without changing its contract', () => {
    const mock = JSON.parse(readFileSync(mockPath, 'utf8')) as unknown;
    const venue = normalizeVenue(mock);
    expect(venue.slug).toBe('ttk-expo');
    expect(venue.floors).toHaveLength(1);
    expect(venue.floors[0].points).toHaveLength(6);
    expect(venue.floors[0].panoramas).toHaveLength(2);
    expect(venue.floors[0].metersPerPixel).toBe(0.05);
    expect(venue.floors[0].points.find((point) => point.id === 'poi-entrance')?.category).toBe('service');
    expect(venue.floors[0].panoramas[0].hotspots).toHaveLength(2);
  });

  it('round-trips mock JSON through normalize and serialize', () => {
    const source = JSON.parse(readFileSync(mockPath, 'utf8')) as unknown;
    const first = normalizeVenue(source);
    const second = parseVenueJson(serializeVenue(first));
    expect(second.id).toBe(first.id);
    expect(second.floors[0].points.map((point) => point.id)).toEqual(first.floors[0].points.map((point) => point.id));
    expect(second.floors[0].panoramas.map((panorama) => panorama.id)).toEqual(
      first.floors[0].panoramas.map((panorama) => panorama.id)
    );
    expect(second.floors[0].graph.edges.map((edge) => edge.lengthMeters)).toEqual(
      first.floors[0].graph.edges.map((edge) => edge.lengthMeters)
    );
    expect(second.schemaVersion).toBe(1);
  });

  it('round-trips walls, rooms, point types and assets', () => {
    const venue = normalizeVenue({
      id: 'venue-test',
      slug: 'test-venue',
      title: 'Test',
      createdAt: '2026-01-01T00:00:00Z',
      publishedRevision: 0,
      floors: [
        {
          id: 'floor-test',
          venueId: 'venue-test',
          level: 1,
          name: '1 этаж',
          planUrl: 'local-asset://asset-plan',
          planAsset: {
            id: 'asset-plan',
            fileName: 'plan.png',
            mimeType: 'image/png',
            sizeBytes: 100,
            storage: 'local',
            url: 'local-asset://asset-plan',
            createdAt: '2026-01-01T00:00:00Z',
          },
          width: 1000,
          height: 500,
          metersPerPixel: 0.1,
          walls: [{ id: 'wall-1', floorId: 'floor-test', x1: 0, y1: 0, x2: 300, y2: 400 }],
          rooms: [
            {
              id: 'room-1',
              floorId: 'floor-test',
              name: 'Зал',
              color: '#ff0000',
              points: [
                { x: 0, y: 0 },
                { x: 100, y: 0 },
                { x: 100, y: 100 },
              ],
            },
          ],
          points: [
            { id: 'poi-wifi', floorId: 'floor-test', name: 'Wi-Fi', category: 'wifi', x: 10, y: 20, isPublic: true, wifi: { ssid: 'TTK' } },
            { id: 'poi-info', floorId: 'floor-test', name: 'Info', category: 'info', x: 30, y: 40, isPublic: true, info: { schedule: '10:00' } },
            { id: 'poi-pano', floorId: 'floor-test', name: 'Pano', category: 'panorama', x: 50, y: 60, isPublic: true, panoramaId: 'pano-1' },
            { id: 'poi-wardrobe', floorId: 'floor-test', name: 'Гардероб', category: 'wardrobe', x: 70, y: 80, isPublic: true },
          ],
          panoramas: [
            {
              id: 'pano-1',
              floorId: 'floor-test',
              x: 50,
              y: 60,
              url: 'local-asset://asset-pano',
              previewUrl: 'local-asset://asset-pano',
              hotspots: [],
              asset: {
                id: 'asset-pano',
                fileName: 'pano.jpg',
                mimeType: 'image/jpeg',
                sizeBytes: 200,
                storage: 'local',
                url: 'local-asset://asset-pano',
                createdAt: '2026-01-01T00:00:00Z',
              },
            },
          ],
          graph: { nodes: [], edges: [] },
        },
      ],
    });

    expect(venue.floors[0].walls?.[0].lengthMeters).toBe(50);
    const restored = parseVenueJson(serializeVenue(venue));
    expect(restored.floors[0].walls?.[0]).toMatchObject({ id: 'wall-1', lengthMeters: 50 });
    expect(restored.floors[0].rooms?.[0].name).toBe('Зал');
    expect(restored.floors[0].points.map((point) => point.category)).toEqual(['wifi', 'info', 'panorama', 'wardrobe']);
    expect(restored.floors[0].points[0].wifi?.ssid).toBe('TTK');
    expect(restored.floors[0].points[2].panoramaId).toBe('pano-1');
    expect(restored.floors[0].panoramas[0].asset?.storage).toBe('local');
    expect(restored.floors[0].planAsset?.fileName).toBe('plan.png');
  });

  it('detects server storage for upload, demo, remote and data URLs', () => {
    const cases: Array<{ url: string; storage?: 'local' | 'server'; expected: 'local' | 'server' }> = [
      { url: '/uploads/plan.png', expected: 'server' },
      { url: '/demo/plan.svg', expected: 'server' },
      { url: 'http://example.com/plan.png', expected: 'server' },
      { url: 'https://example.com/plan.png', expected: 'server' },
      { url: 'data:image/png;base64,AAAA', expected: 'server' },
      { url: 'local-asset://asset-1', expected: 'local' },
      { url: 'local-asset://asset-1', storage: 'server', expected: 'server' },
    ];
    const venue = normalizeVenue({
      id: 'venue-assets',
      slug: 'assets',
      title: 'Assets',
      floors: [
        {
          id: 'floor-assets',
          name: 'Assets',
          panoramas: cases.map((item, index) => ({
            id: `pano-${index}`,
            url: item.url,
            asset: {
              id: `asset-${index}`,
              fileName: `asset-${index}`,
              url: item.url,
              ...(item.storage ? { storage: item.storage } : {}),
            },
          })),
        },
      ],
    });

    expect(venue.floors[0].panoramas.map((panorama) => panorama.asset?.storage)).toEqual(
      cases.map((item) => item.expected)
    );
  });

  it('rejects malformed JSON and venues without floors', () => {
    expect(() => parseVenueJson('{oops')).toThrow(VenueValidationError);
    expect(() => normalizeVenue({ id: 'x', title: 'X', floors: [] })).toThrow('хотя бы один этаж');
  });

  it('maps unknown categories to other without losing the original label', () => {
    const venue = normalizeVenue({
      id: 'v',
      slug: 'v',
      title: 'V',
      floors: [
        {
          id: 'f',
          name: 'F',
          width: 100,
          height: 100,
          points: [{ id: 'p', name: 'Custom', category: 'photo-zone', x: 1, y: 2 }],
        },
      ],
    });
    expect(venue.floors[0].points[0].category).toBe('other');
    expect(venue.floors[0].points[0].other?.label).toBe('photo-zone');
  });

  it('normalizes stairs and drops dangling cross-floor links', () => {
    const venue = normalizeVenue({
      id: 'venue-stairs',
      slug: 'stairs',
      title: 'Stairs',
      floors: [
        {
          id: 'floor-1',
          name: '1 этаж',
          stairs: [
            { id: 'stair-1', name: 'Вверх', x1: 0, y1: 0, x2: 100, y2: 0, width: 32, direction: 'up', targetStairId: 'stair-2', targetFloorId: 'floor-2' },
            { id: 'stair-broken', x1: 0, y1: 0, x2: 50, y2: 0, targetStairId: 'missing', targetFloorId: 'floor-2' },
          ],
        },
        {
          id: 'floor-2',
          name: '2 этаж',
          stairs: [
            { id: 'stair-2', name: 'Вниз', x1: 0, y1: 0, x2: 100, y2: 0, direction: 'down', targetStairId: 'stair-1', targetFloorId: 'floor-1' },
          ],
        },
      ],
    });

    const firstFloor = venue.floors[0];
    expect(firstFloor.stairs?.[0]).toMatchObject({
      width: 32,
      direction: 'up',
      targetFloorId: 'floor-2',
      targetStairId: 'stair-2',
    });
    expect(firstFloor.stairs?.[1].targetStairId).toBeUndefined();
    expect(firstFloor.stairs?.[1].targetFloorId).toBeUndefined();
    expect(firstFloor.stairs?.[1].width).toBe(40);
    expect(venue.floors[1].stairs?.[0].targetStairId).toBe('stair-1');

    const restored = parseVenueJson(serializeVenue(venue));
    expect(restored.floors[0].stairs?.[0].targetStairId).toBe('stair-2');
    expect(restored.floors[1].stairs?.[0].targetStairId).toBe('stair-1');
  });
});
