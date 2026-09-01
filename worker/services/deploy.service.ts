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
 *
 * Which leaves one thing that is neither, and that this reports rather than
 * swallows: whether there is a hook to poke at all. A deployment without one
 * publishes revisions that nothing ever builds, and from the status screen that
 * is indistinguishable from a build taking its time — forever.
 */
import type { Env } from '../env';

type Target = 'preview' | 'production';

export class DeployService {
  constructor(
    private readonly env: Env,
    private readonly ctx: ExecutionContext,
  ) {}

  /** Rebuilds the public site. Fired on publish. */
  triggerProduction(): void {
    this.trigger('production');
  }

  /** Rebuilds the preview, which reads the draft. Fired on every save. */
  triggerPreview(): void {
    this.trigger('preview');
  }

  /**
   * Whether that origin is rebuilt by anything this Worker does.
   *
   * False means the secret is not set, and that a publish writes its revision
   * and stops there. It travels on the status so the admin can say so, instead
   * of showing "publishing…" against a build that was never asked for.
   */
  rebuilds(target: Target): boolean {
    return this.hookFor(target) !== undefined;
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

  private hookFor(target: Target): string | undefined {
    const url = target === 'production' ? this.env.DEPLOY_HOOK_URL : this.env.PREVIEW_DEPLOY_HOOK_URL;
    return url === undefined || url === '' ? undefined : url;
  }

  private trigger(target: Target): void {
    const url = this.hookFor(target);
    if (url === undefined) return;
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
