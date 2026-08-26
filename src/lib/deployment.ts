/**
 * Whether an origin is serving what it should be.
 *
 * The site writes the revision it was built from into build-info.json and the
 * Worker fetches it, so "live" is what the site says about itself rather than a
 * guess from how long ago the deploy hook fired. Either number missing means
 * the question cannot be answered — a site that has never deployed, or one
 * mid-build — and "unknown" is the honest answer rather than "behind".
 *
 * The publish bar and the control panel both ask this, and both used to answer
 * it themselves: two copies of one comparison, in two shapes, with a comment on
 * the second saying it was the same as the first.
 */
export type Deployment = 'current' | 'building' | 'unknown';

export function deploymentOf(expected: number | null, actual: number | null): Deployment {
  if (expected === null || actual === null) return 'unknown';
  return expected === actual ? 'current' : 'building';
}

/** The same answer as a phrase, for the tile that prints it rather than styles it. */
const DEPLOYMENT_KEYS: Record<Deployment, string> = {
  current: 'common.upToDate',
  building: 'common.building',
  unknown: 'common.unknown',
};

export function deploymentKey(expected: number | null, actual: number | null): string {
  return DEPLOYMENT_KEYS[deploymentOf(expected, actual)];
}
