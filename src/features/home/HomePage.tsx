/**
 * The front page: one line, and the photographs under it.
 *
 * Everything a visitor meets first is on this one screen, in the order they
 * meet it — the statement that holds the first screen on its own, then the
 * sequence of plates below the fold. The title and description are down here
 * rather than at the top because nobody reads them: they are what the browser
 * tab and a search result say, and the statement is what the page says.
 */
import { useTranslation } from 'react-i18next';

import { blankImage, type HomePage as HomeContent } from '../../../shared/content/types';
import { ImageField, LocalisedField } from '../../components/fields';
import { PageTextFields } from '../../components/PageTextFields';
import { Repeatable } from '../../components/records';
import type { Editor } from '../../hooks/useEditor';
import { mediaStem, nextMediaName } from '../../lib/media-keys';

/** Where the front page's photographs are filed. Unchanged since they were the
    studio sequence, so no key moves and nothing has to be re-uploaded. */
const FOLDER = 'pages/home';

interface HomePageProps {
  editor: Editor;
}

export function HomePage({ editor }: HomePageProps) {
  const { t } = useTranslation();
  const page = editor.content.pages.home;

  const set = (next: HomeContent) =>
    editor.update('pages', { ...editor.content.pages, home: next });

  return (
    <section>
      <header className="section-head">
        <h2>{t('nav.home')}</h2>
      </header>
      <p className="section-note">{t('homePage.intro')}</p>

      <LocalisedField
        label={t('fields.statement')}
        value={page.statement}
        onChange={(statement) => set({ ...page, statement })}
        hint={t('homePage.statementHint')}
        multiline
      />

      <Repeatable
        label={t('fields.photographs')}
        items={page.gallery}
        addLabel={t('fields.addPhoto')}
        hint={t('homePage.galleryHint')}
        blank={blankImage}
        onChange={(gallery) => set({ ...page, gallery })}
        keyOf={(image, at) => image.src || `new-${at}`}
        renderItem={(image, write, at) => (
          <ImageField
            label={t('fields.photographNumber', { number: at + 1 })}
            value={image}
            onChange={write}
            folder={FOLDER}
            // A photograph keeps the name it was filed under; a new one takes
            // the next free number in this folder.
            name={
              image.src === ''
                ? nextMediaName(page.gallery.map((entry) => entry.src))
                : mediaStem(image.src)
            }
            mediaUrl={editor.mediaUrl}
            onUpload={editor.putMedia}
          />
        )}
      />

      <PageTextFields
        value={page}
        onChange={(text) => set({ ...page, ...text })}
        titleHint={t('homePage.titleHint')}
      />
    </section>
  );
}
