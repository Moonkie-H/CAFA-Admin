/**
 * Whether an origin is serving what it should be.
 *
 * The site writes the revision it was built from into build-info.json and the
 * Worker fetches it, so "live" is what the site says about itself rather than a
 * guess from how long ago the deploy hook fired. Either number missing means
 * the question cannot be answered — a site that has never deployed, or one
 * mid-build — and "unknown" is the honest answer rather than "behind".
 *
 * `stalled` is the fourth answer and the reason this is not a boolean: an
 * origin can be behind with nothing on its way to fix that, because its deploy
 * hook is not configured. It looks exactly like `building` from here, and
 * saying so would be a progress bar for a build nobody asked for.
 *
 * The publish bar and the control panel both ask this, and both used to answer
 * it themselves: two copies of one comparison, in two shapes, with a comment on
 * the second saying it was the same as the first.
 */
export type Deployment = 'current' | 'building' | 'stalled' | 'unknown';

export function deploymentOf(
  expected: number | null,
  actual: number | null,
  rebuilds: boolean,
): Deployment {
  if (expected === null || actual === null) return 'unknown';
  if (expected === actual) return 'current';
  return rebuilds ? 'building' : 'stalled';
}

/** The same answer as a phrase, for the tile that prints it rather than styles it. */
const DEPLOYMENT_KEYS: Record<Deployment, string> = {
  current: 'common.upToDate',
  building: 'common.building',
  stalled: 'common.notRebuilding',
  unknown: 'common.unknown',
};

export function deploymentKey(
  expected: number | null,
  actual: number | null,
  rebuilds: boolean,
): string {
  return DEPLOYMENT_KEYS[deploymentOf(expected, actual, rebuilds)];
}
