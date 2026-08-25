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
}

export type Env = CloudflareBindings & SecretBindings;
