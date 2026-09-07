/**
 * One photograph: the file, how it is drawn, and the description it is not
 * allowed to go without.
 *
 * The alt text sits in the same box as the picture on purpose. Alt is a
 * required field so it cannot be forgotten; putting it anywhere but next to the
 * image it describes is how it gets forgotten anyway. The `CHECK` constraint on
 * the media columns refuses a half-filled one too, so this is the first of two
 * gates rather than the only one.
 *
 * The framing is here for the same reason and appears only once a photograph
 * has been chosen — there is nothing to frame before that, and an empty frame
 * with a shape and a zoom on it is a control asking to be set for a file that
 * does not exist. It replaces the thumbnail rather than sitting beside one: the
 * thumbnail was a picture of the file, and this is a picture of the page.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  emptyLocalised,
  naturalFraming,
  type ImageRef,
} from '../../../shared/content/types';
import { mediaKey } from '../../lib/media-keys';
import { FramingField } from './FramingField';
import { LocalisedField } from './LocalisedField';

interface ImageFieldProps {
  label: string;
  value: ImageRef;
  onChange: (value: ImageRef) => void;
  /** Where a newly chosen file should be filed — "works/salt-and-scaffold". */
  folder: string;
  /** The file's stem, without extension — "cover", "01", "shen-zhibai". */
  name: string;
  mediaUrl: (key: string) => string;
  onUpload: (key: string, file: File) => Promise<void>;
  /**
   * Offered only where having no photograph is a real answer, which today is
   * the contact card's QR code and nothing else. Every other image on the site
   * is required — a work without a cover is a broken row, not a plainer one —
   * so those callers pass nothing and no button appears. Without this an
   * optional field is one the studio can fill and then never empty.
   */
  onClear?: () => void;
}

export function ImageField({
  label,
  value,
  onChange,
  folder,
  name,
  mediaUrl,
  onUpload,
  onClear,
}: ImageFieldProps) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const decorative = value.alt === '';

  async function choose(file: File | undefined): Promise<void> {
    if (file === undefined) return;
    setBusy(true);
    setFailure(null);
    try {
      // Uploaded before the record points at it: the content's foreign key
      // means the photograph has to exist first.
      const key = mediaKey(folder, name);
      await onUpload(key, file);
      // A replacement is a different photograph in the same slot, so the frame
      // the last one was given is not the frame this one wants — a crop chosen
      // around a face lands somewhere arbitrary on the next picture. It starts
      // where every photograph starts: its own shape, whole.
      onChange({ ...value, src: key, frame: naturalFraming() });
    } catch (error) {
      setFailure(error instanceof Error ? error.message : t('fields.uploadFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="image-field">
      <h4 className="field-label">{label}</h4>

      <div className="image-row">
        {value.src === '' ? (
          <div className="image-preview">
            <span className="image-empty">{t('common.noImage')}</span>
          </div>
        ) : (
          <FramingField
            label={label}
            value={value.frame}
            onChange={(frame) => onChange({ ...value, frame })}
            src={mediaUrl(value.src)}
          />
        )}

        <div className="image-controls">
          <label className="button">
            {value.src === '' ? t('common.choosePhoto') : t('common.replace')}
            <input
              type="file"
              accept="image/jpeg,image/png"
              className="visually-hidden"
              disabled={busy}
              onChange={(event) => void choose(event.target.files?.[0])}
            />
          </label>
          {onClear !== undefined && value.src !== '' && (
            <button type="button" className="button button-quiet" onClick={onClear}>
              {t('common.removePhoto')}
            </button>
          )}
          {busy && <p className="field-hint">{t('common.uploading')}</p>}
          {failure !== null && <p className="problem">{failure}</p>}
          {value.src !== '' && <p className="field-hint image-path">{value.src}</p>}
        </div>
      </div>

      <label className="checkbox">
        <input
          type="checkbox"
          checked={decorative}
          onChange={(event) =>
            onChange({ ...value, alt: event.target.checked ? '' : emptyLocalised() })
          }
        />
        <span>
          {t('common.decorative')}
        </span>
      </label>

      {!decorative && (
        <LocalisedField
          label={t('common.imageDescription')}
          value={value.alt === '' ? emptyLocalised() : value.alt}
          onChange={(alt) => onChange({ ...value, alt })}
          hint={t('common.imageHint')}
        />
      )}
    </section>
  );
}
