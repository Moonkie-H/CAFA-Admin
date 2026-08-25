/**
 * Talking to the two deployed origins, and to the hooks that rebuild them.
 *
 * Both halves are deliberately failure-tolerant, for the same reason: neither
 * is on the path of anything the studio would call broken.
 *
 * Poking a hook is fire-and-forget — a save should not fail because a build
 * queue was briefly slow, and the status poll shows whether the build landed
 * anyway. Reading an origin's build-info.json is best-effort — a site that is
 * mid-deploy, or has never deployed, simply has no revision to report, and
 * "unknown" is the honest answer rather than an error.
 */
import type { Env } from '../env';

export class DeployService {
  constructor(
    private readonly env: Env,
    private readonly ctx: ExecutionContext,
  ) {}

  /** Rebuilds the public site. Fired on publish. */
  triggerProduction(): void {
    this.trigger('production', this.env.DEPLOY_HOOK_URL);
  }

  /** Rebuilds the preview, which reads the draft. Fired on every save. */
  triggerPreview(): void {
    this.trigger('preview', this.env.PREVIEW_DEPLOY_HOOK_URL);
  }

  /**
   * What a deployed origin says it was built from.
   *
   * The template writes this at build time; comparing it to the newest revision
   * is how the admin answers "is it live yet" without needing Cloudflare API
   * credentials.
   */
  async liveRevision(origin: string | undefined): Promise<number | null> {
    if (origin === undefined || origin === '') return null;
    try {
      const response = await fetch(`${origin.replace(/\/$/, '')}/build-info.json`, {
        cf: { cacheTtl: 0 },
        headers: { 'Cache-Control': 'no-cache' },
        signal: AbortSignal.timeout(5_000),
      });
      if (!response.ok) return null;
      const info = await response.json<{ revision?: unknown }>();
      return typeof info.revision === 'number' ? info.revision : null;
    } catch {
      return null;
    }
  }

  private trigger(target: 'preview' | 'production', url: string | undefined): void {
    if (url === undefined || url === '') return;
    this.ctx.waitUntil(
      fetch(url, { method: 'POST', signal: AbortSignal.timeout(10_000) })
        .then((response) => {
          if (!response.ok) throw new Error(`Deploy hook answered ${response.status}.`);
        })
        .catch((error: unknown) => {
          console.error(JSON.stringify({
            message: 'Deploy hook failed',
            target,
            error: error instanceof Error ? error.message : String(error),
          }));
        }),
    );
  }
}
