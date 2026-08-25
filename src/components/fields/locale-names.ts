/**
 * What each column of a bilingual field is called, above the box.
 *
 * Not translated, and that is the point: the Chinese box says 中文 whichever
 * language the studio is reading the interface in, because the label names the
 * language the *content* goes in rather than the one the editor is speaking.
 * Translating it would put "Chinese" above the box in English mode, which is
 * the one reading that could be mistaken for a second English column.
 *
 * Distinct from `Dictionary.localeName`, which is what the published site calls
 * a language in its own switch and is therefore editable in Site text.
 */
import type { Locale } from '../../../shared/content/types';

export const LOCALE_NAMES: Record<Locale, string> = { zh: '中文', en: 'English' };
