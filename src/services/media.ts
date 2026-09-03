/**
 * Photographs.
 *
 * `url` is a plain string rather than a fetch, because what consumes it is an
 * `<img src>`. The `v` parameter is a cache-buster: the Worker keys the object
 * by path alone, so replacing a photograph under the same key would otherwise
 * keep showing the old bytes for as long as the browser cached them.
 */
import { request } from './http';
import type { MediaInfo } from '../../shared/content/types';
import type { PreparedImage } from '../lib/image-prepare';
import { derivedKey } from '../lib/media-keys';

export const mediaService = {
  /**
   * A photograph and every narrower copy of it, in the order that keeps the
   * registry honest.
   *
   * **The rungs go up first.** The row records which widths exist, and the site
   * turns each of them into a URL it expects to resolve — so a row must never
   * claim a width whose object is not in the bucket yet. It is the same rule
   * that puts the object before the row, one level out.
   *
   * The bytes are the body; the key, the measured hue and the finished ladder
   * ride in the query, because there is nowhere else for them to sit. A hue of
   * null is simply left out — the Worker reads an absent one as "no hue to
   * give", which is the same thing a monochrome photograph has.
   */
  async upload(key: string, prepared: PreparedImage): Promise<MediaInfo> {
    for (const rung of prepared.ladder) {
      await put(derivedKey(rung.width, key), rung.image, null, []);
    }
    return put(
      key,
      prepared.image,
      prepared.tint,
      prepared.ladder.map((rung) => rung.width),
    );
  },

  /** The stored original, as bytes, so the backfill can re-file it unchanged. */
  async original(key: string): Promise<Blob> {
    const response = await fetch(`/api/media?key=${encodeURIComponent(key)}`);
    if (!response.ok) throw new Error(`Could not read ${key}.`);
    return response.blob();
  },

  url: (key: string, version: number) =>
    `/api/media?key=${encodeURIComponent(key)}&v=${version}`,
};

function put(key: string, image: Blob, tint: number | null, widths: number[]) {
  return request<MediaInfo>('/api/media', {
    method: 'POST',
    query: {
      key,
      tint: tint ?? undefined,
      widths: widths.length === 0 ? undefined : widths.join(','),
    },
    headers: { 'Content-Type': image.type },
    raw: image,
  });
}
