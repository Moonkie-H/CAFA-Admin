/**
 * Two words, one of them chosen.
 *
 * The same control on the sign-in screen and in the header, because the choice
 * is the same choice: it is the interface's language, it is remembered in
 * localStorage by the detector, and it is needed before signing in as much as
 * after. Plain buttons rather than a select — there are two options and both
 * fit on one line in their own language.
 */
import { useTranslation } from 'react-i18next';

const LANGUAGES = [
  { code: 'en', label: 'EN' },
  { code: 'zh', label: '中文' },
] as const;

export function LanguageToggle() {
  const { t, i18n } = useTranslation();

  return (
    <div className="languages" role="group" aria-label={t('account.language')}>
      {LANGUAGES.map(({ code, label }) => (
        <button
          key={code}
          type="button"
          className={`language${i18n.resolvedLanguage === code ? ' is-selected' : ''}`}
          aria-pressed={i18n.resolvedLanguage === code}
          onClick={() => void i18n.changeLanguage(code)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
