/**
 * The tables, as TypeScript sees them.
 *
 * One interface per table, named for it, holding the column names exactly. They
 * live together because they are one schema and reading them side by side is
 * how you check a migration against the code — the equivalent of opening
 * veyra_api's `TalentDbContext` and seeing every entity in one screen.
 *
 * Nothing above worker/repositories/ imports from this file. A service works in
 * `ContentSet`, `Work`, `Mentor`; the shape with `_zh` and `_en` suffixes stops
 * at the repository boundary.
 */

export interface SiteRow {
  name_zh: string;
  name_en: string;
  contact_email: string;
  contact_wechat: string;
  address_zh: string;
  address_en: string;
  hours_zh: string;
  hours_en: string;
  /** The WeChat QR code's four columns. An empty key is "no code". */
  qr_key: string;
  qr_alt_zh: string;
  qr_alt_en: string;
  qr_decorative: number;
  /** One of TYPE_SCALES, which the column's own CHECK is the second gate on. */
  type_scale: string;
}

export interface PageRow {
  page: string;
  title_zh: string;
  title_en: string;
  description_zh: string;
  description_en: string;
}

export interface PageLineRow {
  page: string;
  name: string;
  zh: string;
  en: string;
}

export interface PageParagraphRow {
  page: string;
  zh: string;
  en: string;
}

export interface HomeGalleryRow {
  media_key: string;
  alt_zh: string;
  alt_en: string;
  decorative: number;
}

export interface WorkRow {
  slug: string;
  index_no: number;
  title_zh: string;
  title_en: string;
  status: string;
  year: number;
  summary_zh: string;
  summary_en: string;
  cover_key: string;
  cover_alt_zh: string;
  cover_alt_en: string;
  cover_decorative: number;
}

export interface DisciplineRow {
  work_slug: string;
  zh: string;
  en: string;
}

export interface CreditRow {
  work_slug: string;
  role_zh: string;
  role_en: string;
  name_zh: string;
  name_en: string;
}

export interface WorkMediaRow {
  work_slug: string;
  media_key: string;
  alt_zh: string;
  alt_en: string;
  decorative: number;
}

export interface ProgramRow {
  slug: string;
  name_zh: string;
  name_en: string;
  audience_zh: string;
  audience_en: string;
  duration_zh: string;
  duration_en: string;
  summary_zh: string;
  summary_en: string;
}

export interface ProjectRow {
  slug: string;
  title_zh: string;
  title_en: string;
  summary_zh: string;
  summary_en: string;
  image_key: string;
  image_alt_zh: string;
  image_alt_en: string;
  image_decorative: number;
}

export interface MentorRow {
  slug: string;
  name_zh: string;
  name_en: string;
  discipline_zh: string;
  discipline_en: string;
  note_zh: string;
  note_en: string;
  portrait_key: string;
  portrait_alt_zh: string;
  portrait_alt_en: string;
  portrait_decorative: number;
}

export interface CopyRow {
  key: string;
  zh: string;
  en: string;
}

export interface MediaRow {
  key: string;
  width: number;
  height: number;
  bytes: number;
  /** The dominant hue in OKLCH degrees, or null where there is none to have. */
  tint: number | null;
  /**
   * Which bytes are under the key, as a digest of them — null for a photograph
   * uploaded before migration 0009. A key never changes when a photograph is
   * replaced, so this is the only thing that says a replacement happened.
   */
  version: string | null;
  /**
   * The narrower copies in the bucket, as a comma-separated ascending list —
   * "480,768,1200". Null for a photograph uploaded before there was a ladder,
   * which the site reads as the single candidate it has always had.
   */
  widths: string | null;
}

export interface RevisionRow {
  id: number;
  content: string;
  message: string;
  published_at: string;
  published_by: string;
}
