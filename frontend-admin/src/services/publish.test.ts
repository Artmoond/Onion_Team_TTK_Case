import { afterEach, describe, expect, it, vi } from 'vitest';
import { demoVenue } from '../data/demoVenue';
import type { Venue } from '../types/venue';
import { countAssetsToUpload, publishVenue } from './publish';
import { normalizeVenue } from './serialization';

describe('publish assets', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('counts demo assets that still use relative URLs', () => {
    expect(countAssetsToUpload(demoVenue)).toBe(3);
    expect(countAssetsToUpload(normalizeVenue(demoVenue))).toBe(3);
  });

  it('ignores uploaded assets and counts local files', () => {
    const source = demoVenue.floors[0];
    const panorama = source.panoramas[0];
    const venue: Venue = {
      ...demoVenue,
      floors: [
        {
          ...source,
          planAsset: { ...source.planAsset!, id: 'asset-plan-uploaded', url: '/uploads/plan.png' },
          panoramas: [
            {
              ...panorama,
              asset: { ...panorama.asset!, id: 'asset-pano-local', storage: 'local', url: 'local-asset://asset-pano-local' },
              url: 'local-asset://asset-pano-local',
              previewUrl: 'local-asset://asset-pano-local',
            },
          ],
        },
      ],
    };

    expect(countAssetsToUpload(venue)).toBe(1);
  });

  it('uploads demo assets and replaces their URLs with uploaded ones', async () => {
    const fetched: string[] = [];
    const uploaded: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      fetched.push(url);
      if (url.startsWith('/demo/')) {
        return new Response('<svg/>', { status: 200, headers: { 'Content-Type': 'image/svg+xml' } });
      }
      if (url.endsWith('/api/upload')) {
        const file = (init?.body as FormData).get('file') as File;
        uploaded.push(file.name);
        return new Response(JSON.stringify({ url: `/uploads/${file.name}`, size: file.size }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.includes('/api/venues/')) {
        return new Response(JSON.stringify({ status: 'ok', slug: demoVenue.slug }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await publishVenue(demoVenue);

    expect(result.uploaded).toBe(3);
    expect(uploaded).toHaveLength(3);
    expect(fetched.filter((url) => url.startsWith('/demo/'))).toHaveLength(3);
    expect(JSON.stringify(result.venue)).not.toContain('/demo/');
    expect(result.venue.floors[0].planUrl).toContain('/uploads/');
    expect(result.venue.floors[1].planUrl).toContain('/uploads/');
    expect(result.venue.floors[0].panoramas[0].url).toContain('/uploads/');
    expect(result.venue.floors[0].panoramas[0].previewUrl).toBe(result.venue.floors[0].panoramas[0].url);
  });
});
