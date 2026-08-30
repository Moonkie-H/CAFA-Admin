/**
 * Everything the Worker is handed by the platform.
 *
 * Wrangler generates `CloudflareBindings` from wrangler.jsonc. Only secrets and
 * optional deployment values are declared here because they do not appear in
 * committed configuration. This keeps D1, R2, assets and ordinary vars from
 * drifting between the config and a handwritten interface.
 */
interface SecretBindings {
  PREVIEW_URL?: string;

  /**
   * The admin's own origin, from wrangler.jsonc. Optional here so the Worker
   * still compiles and runs with the var removed — which is how a deployment
   * says "no contact form", and what the bundle projection reads as no endpoint.
   */
  ADMIN_URL?: string;

  /** The one account that may sign in. */
  ADMIN_USERNAME: string;
  /** Its password, as `pbkdf2$sha256$…` — see worker/domain/password.ts. */
  ADMIN_PASSWORD_HASH: string;
  SESSION_SECRET: string;

  /** Cloudflare deploy hooks. Absent means that half simply does not fire. */
  DEPLOY_HOOK_URL?: string;
  PREVIEW_DEPLOY_HOOK_URL?: string;
  /** Lets the preview build read the draft. Absent means no draft endpoint. */
  PREVIEW_TOKEN?: string;

  /**
   * The mail provider's API key, and the verified address messages are sent
   * *from*. Both optional, and both are needed before the contact form does
   * anything: with either missing the endpoint answers 503 and says so, and the
   * site falls back to handing the reader a `mailto:` draft. See
   * worker/services/mailer.ts for why an HTTP provider rather than SMTP.
   */
  CONTACT_TOKEN?: string;
  CONTACT_SENDER?: string;
}

/*
 * CONTACT_RATE is not here. It is a `ratelimits` entry in wrangler.jsonc, so
 * wrangler generates it into CloudflareBindings — and leaving it there rather
 * than restating it optionally is the more honest arrangement: remove the block
 * and the regenerated types make the composition root stop compiling, at the
 * one line that has to change, instead of silently running unthrottled. The
 * service still accepts `undefined`, which is what a test hands it.
 */

export type Env = CloudflareBindings & SecretBindings;
