/**
 * One place that knows what has changed and how to send it.
 *
 * Content is held whole rather than per-field: six groups of records, edited in
 * memory, written back in one transaction. At 39 KB the whole set is cheaper to
 * send than a description of which parts of it moved.
 *
 * Photographs no longer wait for a save. They go to the bucket the moment they
 * are chosen, because the content that references one has a foreign key to it —
 * so the row has to exist first. That is the reverse of the old ordering, where
 * a single commit carried both, and it is the ordering a database wants: a save
 * can never name a photograph that is not there.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { contentService } from './services/content';
import { ApiError } from './services/http';
import { mediaService } from './services/media';
import { checkContent, checkImagesInStorage, type Problem } from '../shared/content/validate';
import type { ContentSet, MediaInfo } from '../shared/content/types';
import { prepareImage } from './images';
import { useSay } from './ui/say';

export interface Editor {
  content: ContentSet;
  problems: Problem[];
  dirty: boolean;
  saving: boolean;
  /** True while a photograph is being resized and uploaded. */
  uploading: boolean;
  error: string | null;
  update: <K extends keyof ContentSet>(key: K, value: ContentSet[K]) => void;
  /** Resize, measure, upload and register a photograph. Resolves once it is in the bucket. */
  putMedia: (key: string, file: File) => Promise<void>;
  /** A URL the editor can show a committed photograph at. */
  mediaUrl: (key: string) => string;
  save: () => Promise<boolean>;
}

export function useEditor(initial: ContentSet, initialMedia: MediaInfo[]): Editor {
  const { t } = useTranslation();
  const say = useSay();
  const [content, setContent] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const changeVersion = useRef(0);
  const uploadsInFlight = useRef(0);
  const saveInFlight = useRef(false);

  /** Keys already in the bucket, so a preview knows whether to expect bytes. */
  const [known, setKnown] = useState(() => new Set(initialMedia.map((entry) => entry.key)));
  /** Bumped on every upload so a replaced photograph is re-fetched, not cached. */
  const [version, setVersion] = useState(0);

  const update = useCallback(<K extends keyof ContentSet>(key: K, value: ContentSet[K]) => {
    setContent((current) => ({ ...current, [key]: value }));
    changeVersion.current += 1;
    setDirty(true);
  }, []);

  const putMedia = useCallback(async (key: string, file: File): Promise<void> => {
    uploadsInFlight.current += 1;
    setUploading(true);
    setError(null);
    try {
      await mediaService.upload(key, await prepareImage(file));
      setKnown((current) => new Set(current).add(key));
      setVersion((current) => current + 1);
    } finally {
      uploadsInFlight.current -= 1;
      setUploading(uploadsInFlight.current > 0);
    }
  }, []);

  const mediaUrl = useCallback((key: string) => mediaService.url(key, version), [version]);

  /*
   * Both gates, so the banner says the same thing the Worker would. `version`
   * The known-key set is immutable state: replacing it after an upload makes
   * the missing-file complaint disappear without exposing a mutable Set.
   */
  const problems = useMemo(
    () => [...checkContent(content), ...checkImagesInStorage(content, known)],
    [content, known],
  );

  const save = useCallback(async (): Promise<boolean> => {
    if (!dirty || problems.length > 0 || saveInFlight.current) return false;
    saveInFlight.current = true;
    const versionAtStart = changeVersion.current;
    setSaving(true);
    setError(null);

    try {
      await contentService.save(content);
      setDirty(changeVersion.current !== versionAtStart);
      return true;
    } catch (failure) {
      // A 422 means the server's copy of the rules caught something the form's
      // copy did not, which is a bug worth seeing rather than a generic failure.
      // The field it names travels as a phrase, so it is said here rather than
      // shown as the key it arrived as.
      const field = failure instanceof ApiError ? failure.problems?.[0]?.label : undefined;
      if (failure instanceof Error) {
        setError(field === undefined ? failure.message : `${failure.message} (${say(field)})`);
      } else {
        setError(t('publish.saveFailed'));
      }
      return false;
    } finally {
      saveInFlight.current = false;
      setSaving(false);
    }
  }, [content, dirty, problems, say, t]);

  return {
    content,
    problems,
    dirty,
    saving,
    uploading,
    error,
    update,
    putMedia,
    mediaUrl,
    save,
  };
}
