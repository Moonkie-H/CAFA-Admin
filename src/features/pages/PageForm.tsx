/**
 * One page, opened from the index: what it is called, where it lives, and the
 * ordered list of sections it is composed of.
 *
 * The front page has no remove button. That is not a preference — the site
 * answers 404 at its own address without one, which the validator says too;
 * this is simply the earlier place to say it.
 */
import { useTranslation } from 'react-i18next';

import { emptyLocalised, HOME_SLUG, type Page } from '../../../shared/content/types';
import { LocalisedField, TextField } from '../../components/fields';
import { DeleteRecord, Repeatable } from '../../components/records';
import type { Editor } from '../../hooks/useEditor';
import { blankSection, SectionFields } from './SectionFields';

/** Where a page's photographs are filed. The front page has no slug to use. */
function pageFolder(slug: string): string {
  return `pages/${slug === HOME_SLUG ? 'home' : slug}`;
}

interface PageFormProps {
  page: Page;
  editor: Editor;
  onChange: (page: Page) => void;
  onClose: () => void;
  onDelete: () => void;
}

export function PageForm({ page, editor, onChange, onClose, onDelete }: PageFormProps) {
  const { t } = useTranslation();
  const isHome = page.slug === HOME_SLUG;

  const set = <K extends keyof Page>(key: K, value: Page[K]) => onChange({ ...page, [key]: value });

  // Every gallery on the page, so a photograph added to one cannot take a name
  // a photograph in another already has.
  const usedKeys = page.sections.flatMap((section) =>
    section.kind === 'gallery' ? section.images.map((image) => image.src) : [],
  );

  return (
    <section>
      <header className="section-head">
        <button type="button" className="button button-quiet" onClick={onClose}>
          ← {t('pages.allPages')}
        </button>
        <h2>{page.title.zh || page.title.en || t('pages.newPage')}</h2>
      </header>

      <TextField
        label={t('fields.webAddress')}
        value={page.slug}
        onChange={(value) => set('slug', value)}
        placeholder="about"
        hint={isHome ? t('pagePage.addressFront') : t('pagePage.address', { slug: page.slug })}
      />
      <LocalisedField
        label={t('fields.title')}
        value={page.title}
        onChange={(title) => set('title', title)}
        hint={t('pagePage.titleHint')}
      />
      <LocalisedField
        label={t('fields.description')}
        value={page.description}
        onChange={(description) => set('description', description)}
        hint={t('pagePage.descriptionHint')}
        multiline
      />

      {/* Null is not a blank label — it is the page saying it is not in the bar
          at all. So the checkbox owns the null and the field below owns the
          words, and neither can express the other's state. */}
      <label className="checkbox">
        <input
          type="checkbox"
          checked={page.navLabel !== null}
          onChange={(event) => set('navLabel', event.target.checked ? emptyLocalised() : null)}
        />
        <span>
          {t('fields.inMenu')} — {t('pagePage.menuHint')}
        </span>
      </label>
      {page.navLabel !== null && (
        <LocalisedField
          label={t('fields.menuName')}
          value={page.navLabel}
          onChange={(navLabel) => set('navLabel', navLabel)}
        />
      )}

      <Repeatable
        label={t('pages.section')}
        items={page.sections}
        addLabel={t('pages.addSection')}
        hint={t('pagePage.sectionsHint')}
        blank={() => blankSection('prose')}
        onChange={(sections) => set('sections', sections)}
        renderItem={(section, write) => (
          <SectionFields
            section={section}
            onChange={write}
            folder={pageFolder(page.slug)}
            usedKeys={usedKeys}
            mediaUrl={editor.mediaUrl}
            onUpload={editor.putMedia}
          />
        )}
      />

      <footer className="form-footer">
        {isHome ? (
          <p className="field-hint">{t('pagePage.frontPageKept')}</p>
        ) : (
          <DeleteRecord
            action={t('pagePage.removePage')}
            question={t('pagePage.removeQuestion', {
              page: page.title.zh || page.title.en || page.slug,
            })}
            confirm={t('pagePage.removeIt')}
            onDelete={onDelete}
          />
        )}
      </footer>
    </section>
  );
}
