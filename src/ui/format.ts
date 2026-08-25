/**
 * A published-at stamp, said in whichever language the studio is reading.
 *
 * D1 stores UTC without a zone marker — "2026-08-25 14:03:11" — which
 * `new Date()` reads as *local* time, so the T and the Z are put back before it
 * is parsed. Without them the same revision reads hours out, in a direction
 * that changes with where the studio is sitting.
 */
import { type Locale } from '../content/types';

/**
 * Which regional format each interface language gets. Named rather than
 * inlined because neither is derivable: `zh` could be zh-CN or zh-TW, and the
 * English half is a house choice — day before month, 24 hours.
 */
const DATE_LOCALES: Record<Locale, string> = { zh: 'zh-CN', en: 'en-NZ' };

export function formatUtcDateTime(value: string, language: string): string {
  const parsed = new Date(`${value.replace(' ', 'T')}Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(language.startsWith('zh') ? DATE_LOCALES.zh : DATE_LOCALES.en);
}
