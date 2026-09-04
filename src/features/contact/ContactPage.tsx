/**
 * Contact — the card, and everything written on it.
 *
 * The one destination in the bar that is not a page: it opens over whichever
 * page the reader is on. Which is why the studio's actual details and the words
 * that label them are one screen rather than two — they are one card, and
 * splitting "the email address" from "the word before the email address" across
 * two screens was the clearest thing wrong with the old Site text page.
 *
 * The QR code is the one optional thing on this screen, and the one photograph
 * in the whole content set that hangs off no record. Leave it empty and the card
 * is exactly what it was.
 *
 * The email address below is now load-bearing in a second way. It is still what
 * the card prints, and it is also where the card's form delivers: the Worker
 * reads it out of the published revision on every message. So changing it here
 * and publishing moves the studio's inbox, and the printed address and the
 * delivered-to address cannot come apart.
 */
import { useTranslation } from 'react-i18next';

import { blankImage, type SiteContent } from '../../../shared/content/types';
import {
  CopyFields,
  ImageField,
  LocalisedField,
  TextField,
  type CopyField,
} from '../../components/fields';
import type { Editor } from '../../hooks/useEditor';

/**
 * Where the WeChat code is filed. `site/` rather than under a record, because
 * it belongs to the studio rather than to a work, a person or a page — it is
 * the only photograph on the site that hangs off nothing.
 */
const QR_FOLDER = 'site';
const QR_NAME = 'wechat-qr';

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
    hint: 'The line the message arrives under in your inbox. Your visitor’s address is added after it, so a full inbox can still be scanned.',
  },
  { path: 'contact.send', label: 'Message form — the send button' },
  { path: 'contact.sending', label: 'Message form — the button while sending' },
  {
    path: 'contact.sent',
    label: 'Message form — after it has gone',
    hint: 'This replaces the form, so the visitor cannot send the same message twice by accident.',
  },
  {
    path: 'contact.failed',
    label: 'Message form — if it could not be sent',
    hint: 'Only shown when the connection failed. If the message itself was the problem — a malformed address, say — the visitor is told that instead.',
  },
  {
    path: 'contact.draft',
    label: 'Message form — the way out after a failure',
    hint: 'Offers to open the message in the visitor’s own mail program instead, with what they wrote already in it.',
  },
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
      {/* Optional, and the only optional photograph on the site: without one the
          card prints the ID and nothing else, which is what it did before. With
          one, a reader on a phone can scan instead of copying an ID into another
          application from memory — which is where the ID alone stops working. */}
      <ImageField
        label={t('fields.qr')}
        value={site.contact.qr ?? blankImage()}
        onChange={(qr) => setContact({ qr: qr.src === '' ? null : qr })}
        folder={QR_FOLDER}
        name={QR_NAME}
        mediaUrl={editor.mediaUrl}
        onUpload={editor.putMedia}
        onClear={() => setContact({ qr: null })}
      />
      <LocalisedField
        label={t('fields.address')}
        value={site.contact.address}
        onChange={(address) => setContact({ address })}
        hint={t('contactPage.linesHint')}
        multiline
      />
      <LocalisedField
        label={t('fields.hours')}
        value={site.contact.hours}
        onChange={(hours) => setContact({ hours })}
        hint={t('contactPage.linesHint')}
        multiline
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
