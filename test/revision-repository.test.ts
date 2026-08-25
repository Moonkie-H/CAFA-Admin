import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import { insertRevisionIfChanged } from '../worker/repositories/revision.repository';

describe('revision publishing', () => {
  beforeEach(async () => {
    await env.DB.prepare('DROP TABLE IF EXISTS revision').run();
    await env.DB.prepare(`
      CREATE TABLE revision (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        message TEXT NOT NULL,
        published_at TEXT NOT NULL DEFAULT (datetime('now')),
        published_by TEXT NOT NULL
      )
    `).run();
  });

  it('inserts a changed snapshot only once under concurrent publishes', async () => {
    const revision = { content: '{"version":1}', message: 'Publish', publishedBy: 'studio' };
    const ids = await Promise.all([
      insertRevisionIfChanged(env.DB, revision),
      insertRevisionIfChanged(env.DB, revision),
    ]);

    expect(ids.filter((id) => id !== null)).toHaveLength(1);
    const count = await env.DB.prepare('SELECT COUNT(*) AS count FROM revision').first<{ count: number }>();
    expect(count?.count).toBe(1);
  });

  it('appends when the snapshot changes', async () => {
    await insertRevisionIfChanged(env.DB, {
      content: '{"version":1}',
      message: 'First',
      publishedBy: 'studio',
    });
    const second = await insertRevisionIfChanged(env.DB, {
      content: '{"version":2}',
      message: 'Second',
      publishedBy: 'studio',
    });

    expect(second).toBe(2);
  });
});
