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

import { contentService } from '../services/content';
import { ApiError } from '../services/http';
import { mediaService } from '../services/media';
import { checkContent, checkImagesInStorage, type Problem } from '../../shared/content/validate';
import type { ContentSet, MediaInfo } from '../../shared/content/types';
import { prepareImage, prepareStored } from '../lib/image-prepare';
import { ladderFor } from '../lib/media-keys';
import { useSay } from '../lib/say';

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
  /** The photographs the bucket holds, as the registry describes them. */
  media: MediaInfo[];
  /** How many of them are still missing the narrower copies a phone is served. */
  unladdered: number;
  /** Give those photographs their ladder, without changing the originals. */
  fillLadders: () => Promise<void>;
  save: () => Promise<boolean>;
}

/**
 * Whether a photograph still owes the site the narrower copies of itself.
 *
 * Compared against what its own width earns rather than against a fixed list,
 * because a 900px photograph is complete with two rungs and would otherwise be
 * offered for backfilling forever.
 */
function needsLadder(entry: MediaInfo): boolean {
  return entry.widths.length < ladderFor(entry.width).length;
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

  /**
   * The registry, held rather than reduced to a set of keys on the way in.
   *
   * It answers two questions with one piece of state: whether a preview should
   * expect bytes at a key, and which photographs are still missing the ladder
   * the backfill exists to give them.
   */
  const [media, setMedia] = useState(initialMedia);
  /** Bumped on every upload so a replaced photograph is re-fetched, not cached. */
  const [version, setVersion] = useState(0);

  const update = useCallback(<K extends keyof ContentSet>(key: K, value: ContentSet[K]) => {
    setContent((current) => ({ ...current, [key]: value }));
    changeVersion.current += 1;
    setDirty(true);
  }, []);

  /** One registry entry replaced or added, without disturbing the others. */
  const record = useCallback((entry: MediaInfo) => {
    setMedia((current) => [
      ...current.filter((existing) => existing.key !== entry.key),
      entry,
    ]);
  }, []);

  const putMedia = useCallback(
    async (key: string, file: File): Promise<void> => {
      uploadsInFlight.current += 1;
      setUploading(true);
      setError(null);
      try {
        record(await mediaService.upload(key, await prepareImage(file)));
        setVersion((current) => current + 1);
      } finally {
        uploadsInFlight.current -= 1;
        setUploading(uploadsInFlight.current > 0);
      }
    },
    [record],
  );

  /**
   * The narrower copies, for photographs uploaded before there were any.
   *
   * The site's zone cannot transform, so a photograph with no ladder is served
   * to a phone at 2400 pixels — which is why photographs stopped appearing on
   * mobile. New uploads get their ladder on the way up; everything already in
   * the bucket needs this, once.
   *
   * The original is fetched and re-filed **byte for byte**. It is not decoded
   * and re-encoded, so its digest does not move, so no URL the site has
   * published changes and no cache is invalidated — the only new objects are
   * the rungs underneath it. One photograph at a time, because each one holds a
   * full-size bitmap while it resizes.
   */
  const fillLadders = useCallback(async (): Promise<void> => {
    uploadsInFlight.current += 1;
    setUploading(true);
    setError(null);
    try {
      for (const entry of media) {
        if (!needsLadder(entry)) continue;
        const original = await mediaService.original(entry.key);
        record(await mediaService.upload(entry.key, await prepareStored(original, entry.tint)));
      }
      setVersion((current) => current + 1);
    } catch (failure) {
      // Partial progress is kept rather than unwound: every photograph this got
      // to is now complete, and running it again picks up where it stopped.
      setError(failure instanceof Error ? failure.message : t('fields.uploadFailed'));
    } finally {
      uploadsInFlight.current -= 1;
      setUploading(uploadsInFlight.current > 0);
    }
  }, [media, record, t]);

  const mediaUrl = useCallback((key: string) => mediaService.url(key, version), [version]);

  /*
   * Both gates, so the banner says the same thing the Worker would. The registry
   * is immutable state: replacing an entry after an upload makes the
   * missing-file complaint disappear without exposing anything mutable.
   */
  const problems = useMemo(
    () => [
      ...checkContent(content),
      ...checkImagesInStorage(content, new Set(media.map((entry) => entry.key))),
    ],
    [content, media],
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
    media,
    unladdered: media.filter(needsLadder).length,
    fillLadders,
    save,
  };
}
