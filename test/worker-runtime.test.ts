import { describe, expect, it } from 'vitest';

import { isReadableMediaKey, isWritableMediaKey, measure } from '../worker/domain/image';
import { open, seal } from '../worker/domain/session';
import { timingSafeEqualBytes, timingSafeEqualText } from '../worker/domain/secrets';
import { ApiResponse } from '../worker/shared/api-response';
import { readBytes } from '../worker/shared/request-body';
import { Router } from '../worker/shared/router';

function png(width: number, height: number): ArrayBuffer {
  const bytes = new ArrayBuffer(24);
  const view = new DataView(bytes);
  view.setUint32(0, 0x89504e47);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

describe('Worker runtime boundaries', () => {
  it('measures a bounded PNG and records its actual type', () => {
    expect(measure(png(1_200, 800))).toEqual({
      width: 1_200,
      height: 800,
      bytes: 24,
      contentType: 'image/png',
    });
  });

  it('rejects oversized image dimensions', () => {
    expect(() => measure(png(2_401, 800))).toThrow(/at most 2400px/);
  });

  it('rejects unreadable image bytes', () => {
    expect(() => measure(new ArrayBuffer(24))).toThrow(/not a JPEG or PNG/);
  });

  it('admits a media key for every folder the editor files into', () => {
    // pages/ is the one that matters: a page is content, so its slug is part of
    // the key, and the front page files under `pages/home`. Before this was
    // allowed, every gallery upload was refused.
    for (const key of [
      'works/edible-house/cover.jpg',
      'works/edible-house/01.jpg',
      'pages/about/01.jpg',
      'pages/home/01.jpg',
      'mentors/shen-zhibai.jpg',
      'projects/salt-and-scaffold.jpg',
    ]) {
      expect(isWritableMediaKey(key), key).toBe(true);
      expect(isReadableMediaKey(key), key).toBe(true);
    }
  });

  it('reads the legacy studio folder but never writes to it', () => {
    // Migration 0005 moved these into the front page's gallery without renaming
    // the objects, so the editor still previews them and nothing files new ones.
    expect(isReadableMediaKey('studio/01.jpg')).toBe(true);
    expect(isWritableMediaKey('studio/01.jpg')).toBe(false);
  });

  it('refuses keys that climb out of the bucket or name another shape', () => {
    for (const key of [
      'works/../../etc/passwd.jpg',
      'works/edible-house/01.svg',
      'pages/01.jpg',
      'mentors/shen-zhibai/01.jpg',
      'elsewhere/01.jpg',
      '/works/edible-house/01.jpg',
    ]) {
      expect(isWritableMediaKey(key), key).toBe(false);
      expect(isReadableMediaKey(key), key).toBe(false);
    }
  });

  it('caps streamed request bodies', async () => {
    const request = new Request('https://admin.example/api', {
      method: 'POST',
      body: '123456',
    });
    await expect(readBytes(request, 5)).rejects.toMatchObject({ code: 413 });
  });

  it('reads a request within the cap', async () => {
    const request = new Request('https://admin.example/api', {
      method: 'POST',
      body: 'hello',
    });
    const body = await readBytes(request, 5);
    expect(new TextDecoder().decode(body)).toBe('hello');
  });

  it('compares byte and text secrets without prefix-sensitive equality', async () => {
    expect(timingSafeEqualBytes(new Uint8Array([1, 2]), new Uint8Array([1, 2]))).toBe(true);
    expect(timingSafeEqualBytes(new Uint8Array([1, 2]), new Uint8Array([1, 3]))).toBe(false);
    await expect(timingSafeEqualText('preview-token', 'preview-token')).resolves.toBe(true);
    await expect(timingSafeEqualText('preview-token', 'preview-taken')).resolves.toBe(false);
  });

  it('seals sessions for one purpose and secret only', async () => {
    const sealed = await seal('correct horse battery staple', 'session', { login: 'studio' }, 60);
    await expect(open<{ login: string }>('correct horse battery staple', 'session', sealed))
      .resolves.toEqual({ login: 'studio' });
    await expect(open('wrong secret', 'session', sealed)).resolves.toBeNull();
  });

  it('rejects an expired seal', async () => {
    const sealed = await seal('secret', 'session', { login: 'studio' }, -1);
    await expect(open('secret', 'session', sealed)).resolves.toBeNull();
  });

  it('routes exact methods and reports other methods', () => {
    const router = new Router().allowAnonymous('GET', '/api/items/:id', () => ApiResponse.ok({}));
    const url = new URL('https://admin.example/api/items/42');

    expect(router.resolve(new Request(url), url)).toMatchObject({
      kind: 'anonymous',
      params: { id: '42' },
    });
    expect(router.resolve(new Request(url, { method: 'POST' }), url)).toEqual({
      kind: 'method-not-allowed',
      allowed: ['GET'],
    });
  });

  it('does not throw on malformed percent-encoding in a path', () => {
    const router = new Router().allowAnonymous('GET', '/api/items/:id', () => ApiResponse.ok({}));
    const url = new URL('https://admin.example/api/items/%ZZ');
    expect(router.resolve(new Request(url), url)).toBeNull();
  });
});
