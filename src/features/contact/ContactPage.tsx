/**
 * Contact — the card, and everything written on it.
 *
 * The one destination in the bar that is not a page: it opens over whichever
 * page the reader is on. Which is why the studio's actual details and the words
 * that label them are one screen rather than two — they are one card, and
 * splitting "the email address" from "the word before the email address" across
 * two screens was the clearest thing wrong with the old Site text page.
 */
import { useTranslation } from 'react-i18next';

import type { SiteContent } from '../../../shared/content/types';
import { CopyFields, LocalisedField, TextField, type CopyField } from '../../components/fields';
import type { Editor } from '../../hooks/useEditor';

/** The card's own words. The details they label are the fields above them. */
const CARD_WORDS: CopyField[] = [
  {
    path: 'contact.nav',
    label: 'The word in the menu that opens it',
    hint: 'Contact is the one menu item that is not a page — it opens the card over whichever page the reader is on.',
  },
  { path: 'contact.title', label: 'Card title' },
  { path: 'contact.email', label: 'Label — email' },
  { path: 'contact.wechat', label: 'Label — WeChat' },
  { path: 'contact.address', label: 'Label — address' },
  { path: 'contact.hours', label: 'Label — hours' },
  {
    path: 'contact.note',
    label: 'Note',
    hint: 'How to apply, and what happens next.',
    multiline: true,
  },
  { path: 'contact.from', label: 'Message form — the address field' },
  { path: 'contact.message', label: 'Message form — the message field' },
  {
    path: 'contact.subject',
    label: 'Message form — subject line',
    hint: 'The line the reader’s own mail client opens with. Send hands them a draft; nothing is collected here.',
  },
  { path: 'contact.send', label: 'Message form — the send button' },
];

interface ContactPageProps {
  editor: Editor;
}

export function ContactPage({ editor }: ContactPageProps) {
  const { t } = useTranslation();
  const site = editor.content.site;

  const setContact = (patch: Partial<SiteContent['contact']>) =>
    editor.update('site', { ...site, contact: { ...site.contact, ...patch } });

  return (
    <section>
      <header className="section-head">
        <h2>{t('nav.contact')}</h2>
      </header>
      <p className="section-note">{t('contactPage.intro')}</p>

      <TextField
        label={t('fields.email')}
        value={site.contact.email}
        onChange={(email) => setContact({ email })}
        inputMode="email"
      />
      <TextField
        label={t('fields.wechat')}
        value={site.contact.wechat}
        onChange={(wechat) => setContact({ wechat })}
      />
      <LocalisedField
        label={t('fields.address')}
        value={site.contact.address}
        onChange={(address) => setContact({ address })}
      />
      <LocalisedField
        label={t('fields.hours')}
        value={site.contact.hours}
        onChange={(hours) => setContact({ hours })}
      />

      <h3 className="panel-heading">{t('contactPage.words')}</h3>
      <CopyFields
        fields={CARD_WORDS}
        dictionaries={{ zh: editor.content.zh, en: editor.content.en }}
        onChange={(locale, dictionary) => editor.update(locale, dictionary)}
      />
    </section>
  );
}
