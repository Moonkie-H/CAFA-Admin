/**
 * One section of a page, and the fields its kind has.
 *
 * A section is a discriminated union, so this is a switch and nothing else: the
 * kind decides which fields exist, and three of the eight have none at all —
 * a works index is the works, a programme list is the programmes, and a heading
 * is the page's own title. Those render a line saying what they will draw
 * rather than an empty box, because "no fields" and "not loaded" look the same
 * otherwise.
 *
 * Changing the kind replaces the section with a blank one of the new kind. It
 * does not try to carry a statement's line over into a heading: the fields
 * genuinely differ, and a conversion that silently keeps some data and drops
 * the rest is worse than one that visibly starts again.
 */
import { useTranslation } from 'react-i18next';

import {
  blankImage,
  emptyLocalised,
  SECTION_KINDS,
  type PageSection,
  type SectionKind,
} from '../content/types';
import { mediaStem, nextMediaName } from '../images';
import { LocalisedField, Repeatable, SelectField } from './fields';
import { ImageField } from './ImageField';

/** A section of a kind, with every field it has and nothing in them. */
export function blankSection(kind: SectionKind): PageSection {
  switch (kind) {
    case 'heading':
    case 'works-index':
    case 'programs':
      return { kind };
    case 'statement':
    case 'works-grid':
    case 'mentors':
      return { kind, text: emptyLocalised() };
    case 'prose':
      return { kind, paragraphs: [emptyLocalised()] };
    case 'gallery':
      return { kind, images: [] };
  }
}

interface SectionFieldsProps {
  section: PageSection;
  onChange: (section: PageSection) => void;
  /** Where a newly chosen photograph is filed — "pages/about". */
  folder: string;
  /** Every photograph key already used on this page, so a new one is unique. */
  usedKeys: readonly string[];
  mediaUrl: (key: string) => string;
  onUpload: (key: string, file: File) => Promise<void>;
}

export function SectionFields({
  section,
  onChange,
  folder,
  usedKeys,
  mediaUrl,
  onUpload,
}: SectionFieldsProps) {
  const { t } = useTranslation();

  return (
    <>
      <SelectField
        label={t('fields.sectionKind')}
        value={section.kind}
        options={SECTION_KINDS.map((kind) => ({ value: kind, label: t(`sectionKinds.${kind}`) }))}
        onChange={(kind) => onChange(blankSection(kind))}
        hint={t(`sectionHints.${section.kind}`)}
      />
      <Body
        section={section}
        onChange={onChange}
        folder={folder}
        usedKeys={usedKeys}
        mediaUrl={mediaUrl}
        onUpload={onUpload}
      />
    </>
  );
}

function Body({ section, onChange, folder, usedKeys, mediaUrl, onUpload }: SectionFieldsProps) {
  const { t } = useTranslation();

  switch (section.kind) {
    // The three that draw a collection or the page's own title. Nothing to fill
    // in — the hint on the kind field already says what will appear.
    case 'heading':
    case 'works-index':
    case 'programs':
      return null;

    case 'statement':
      return (
        <LocalisedField
          label={t('fields.line')}
          value={section.text}
          onChange={(text) => onChange({ ...section, text })}
          multiline
        />
      );

    case 'works-grid':
    case 'mentors':
      return (
        <LocalisedField
          label={t('fields.heading')}
          value={section.text}
          onChange={(text) => onChange({ ...section, text })}
        />
      );

    case 'prose':
      return (
        <Repeatable
          label={t('fields.paragraph')}
          items={section.paragraphs}
          addLabel={t('fields.addParagraph')}
          blank={emptyLocalised}
          onChange={(paragraphs) => onChange({ ...section, paragraphs })}
          renderItem={(paragraph, write, at) => (
            <LocalisedField
              label={t('fields.paragraphNumber', { number: at + 1 })}
              value={paragraph}
              onChange={write}
              multiline
            />
          )}
        />
      );

    case 'gallery':
      return (
        <Repeatable
          label={t('fields.photographs')}
          items={section.images}
          addLabel={t('fields.addPhoto')}
          hint={t('pagePage.galleryHint')}
          blank={blankImage}
          onChange={(images) => onChange({ ...section, images })}
          keyOf={(image, at) => image.src || `new-${at}`}
          renderItem={(image, write, at) => (
            <ImageField
              label={t('works.photoNumber', { number: at + 1 })}
              value={image}
              onChange={write}
              folder={folder}
              // A photograph keeps the name it was filed under; a new one takes
              // the next free number in the page's folder, counting every
              // gallery on the page so two of them cannot collide.
              name={image.src === '' ? nextMediaName([...usedKeys], '') : mediaStem(image.src)}
              mediaUrl={mediaUrl}
              onUpload={onUpload}
            />
          )}
        />
      );
  }
}
