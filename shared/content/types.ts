/**
 * The shape of the content the studio owns.
 *
 * This mirrors CAFA-Template's `src/lib/types.ts`, and deliberately diverges
 * from it in two places — both of which are the same idea, that the admin's
 * types should describe what the admin can actually change:
 *
 *  - **`SiteContent` has no `locales` or `localeNames`.** Those are wired to the
 *    template's lib/routes.ts and to the deployment. worker/domain/bundle.ts
 *    adds them when it builds a published revision, so the template still
 *    receives the complete record it expects.
 *  - **`Dictionary` has `localeName`, which the template's does not.** What a
 *    language calls itself in the switch is a word on a screen, so the studio
 *    should be able to change it without a deploy. It is stored as a copy row
 *    and lifted back out into `site` by worker/domain/bundle.ts.
 *
 * The copy cannot drift dangerously in either direction: the template re-parses
 * every field at build time, so a mismatch fails the build and never reaches
 * the live site.
 */

export const LOCALES = ['zh', 'en'] as const;

export type Locale = (typeof LOCALES)[number];

export type LocalisedText = Record<Locale, string>;

/** The upload and the Worker enforce the same public-image size budget. */
export const MAX_IMAGE_EDGE = 2400;

export interface ImageRef {
  /** The R2 object key, e.g. "works/edible-house/01.jpg". */
  src: string;
  /** Required. The empty string is how a decorative image is declared. */
  alt: LocalisedText | '';
}

/** Measured from the file when it is uploaded, and never edited by hand. */
export interface MediaInfo {
  key: string;
  width: number;
  height: number;
  bytes: number;
  /**
   * The dominant hue, in degrees on the OKLCH colour circle, or null where the
   * photograph has none — it is monochrome, or it was uploaded before the admin
   * measured such things. The template draws the works index's hover band from
   * it and falls back to a neutral one when it is null.
   */
  tint: number | null;
  /**
   * A digest of the bytes currently filed under `key`, or null for a photograph
   * uploaded before the admin recorded one.
   *
   * A photograph keeps its key when it is replaced, so nothing else about a
   * published record changes when the studio swaps one out — which is precisely
   * why the swap used to be invisible. This is what differs, and both halves of
   * the site read it: the bundle is no longer byte-identical after a
   * replacement, so publishing triggers a deploy, and the delivery URL carries
   * it, so no cache answers with the photograph that used to be there.
   */
  version: string | null;
  /**
   * The widths this photograph is also filed at, ascending.
   *
   * The site's zone cannot transform, so nothing resizes a photograph on the
   * way to a reader — which left every device downloading the 2400px original
   * and mobile browsers failing to decode a page of them. These are written by
   * the browser that uploads the photograph, in the pass where it is already
   * decoded, and they are what the site's `srcset` is actually built from.
   *
   * Empty for a photograph uploaded before the ladder existed. Each entry is a
   * width whose object is known to be in the bucket: the rungs are written
   * before this list claims them, for the same reason the object is written
   * before the row.
   */
  widths: number[];
}

export type WorkStatus = 'completed' | 'in-progress' | 'private';

export const WORK_STATUSES: readonly WorkStatus[] = ['completed', 'in-progress', 'private'];

/**
 * Narrowing a string off the wire, or out of a column, to the union.
 *
 * Beside the array it reads rather than beside each caller: a status arrives
 * from a JSON body, from a D1 row and from a query parameter, and the three
 * used to carry a copy of this line each.
 */
export function isWorkStatus(value: string): value is WorkStatus {
  return WORK_STATUSES.some((status) => status === value);
}

export interface Credit {
  role: LocalisedText;
  name: LocalisedText;
}

export interface Work {
  slug: string;
  index: number;
  title: LocalisedText;
  status: WorkStatus;
  discipline: LocalisedText[];
  year: number;
  summary: LocalisedText;
  credits: Credit[];
  cover: ImageRef;
  media: ImageRef[];
}

export interface Program {
  slug: string;
  name: LocalisedText;
  audience: LocalisedText;
  duration: LocalisedText;
  summary: LocalisedText;
}

export interface Mentor {
  slug: string;
  name: LocalisedText;
  discipline: LocalisedText;
  note: LocalisedText;
  portrait: ImageRef;
}

/**
 * A project: a picture, a name, and a line or two about it.
 *
 * The smallest record here, and its smallness is the point. About used to end
 * on a grid of the *works*, drawn from the works table under a heading that
 * called them projects — so the studio could neither put something under that
 * heading that was not a work, nor keep a work off it. Two unlike things shared
 * one table because they looked alike on the day the page was drawn.
 *
 * What a project is not, it is not on purpose. No status: a work is completed,
 * in progress or private because the index says so beside its number, and
 * nothing on About says anything of the kind. No year, no disciplines, no
 * credits — those are the columns of the works index, read there. And no page,
 * so `slug` is a stable key for ordering and for filing the photograph under,
 * the way a programme's is; it is never a URL segment and nothing resolves a
 * project by it.
 */
export interface Project {
  slug: string;
  title: LocalisedText;
  /** The line or two under the picture. */
  summary: LocalisedText;
  image: ImageRef;
}

/**
 * The four pages the site has, and the words the studio fills them with.
 *
 * **The set of pages is code, and so is what each one is composed of.** Each
 * page in CAFA-Template is its own route with its own layout, its own choreo-
 * graphy and its own view transitions; a fifth page is not a row somebody adds
 * on a Tuesday, it is a design and the motion that goes with it. So this type
 * says which pages exist, and every field on it is a thing that can be edited
 * without anyone drawing anything new.
 *
 * The lists are not here. The works index *is* `works`, the programme list is
 * `programs`, the mentor strip is `mentors`, the grid on About is `projects` —
 * a page names a collection rather than carrying one, so adding a work still
 * changes three pages and touches nothing in this file.
 */
const PAGE_KEYS = ['home', 'works', 'programs', 'about'] as const;

export type PageKey = (typeof PAGE_KEYS)[number];

/** The same narrowing as `isWorkStatus`, for a page key off the wire or a row. */
export function isPageKey(value: string): value is PageKey {
  return PAGE_KEYS.some((key) => key === value);
}

/** What every page carries: the words that name it to a reader and to a crawler. */
export interface PageText {
  /**
   * The page's own title. It is three things at once and deliberately so: the
   * `h1` at the top of the page, the document title in the browser tab, and the
   * word in the navigation bar. A page called one thing in the bar and another
   * at the top of itself is a page the reader has to reconcile.
   */
  title: LocalisedText;
  /** The meta description — the sentence under the link in a search result. */
  description: LocalisedText;
}

/** The front page: one line, and the studio's photographs under it. */
export interface HomePage extends PageText {
  statement: LocalisedText;
  /** The photographs below the statement. Empty is a page with one line on it. */
  gallery: ImageRef[];
}

/** Programmes: the words above the list, which is the programmes themselves. */
export interface ProgramsPage extends PageText {
  intro: LocalisedText[];
}

/**
 * About: what the studio says about itself, the people, and the projects.
 *
 * Read down the page: the prose, then the mentors under `mentorsTitle`, then
 * the projects as a grid under `projectsTitle`. The mentors and the projects
 * are collections of their own — this page only names them.
 *
 * `projectsTitle` used to head a second drawing of the works index. It heads
 * the projects now, which are their own records; the heading did not have to
 * change, because it was always the honest name for what it labelled.
 */
export interface AboutPage extends PageText {
  intro: LocalisedText[];
  mentorsTitle: LocalisedText;
  projectsTitle: LocalisedText;
}

export interface SitePages {
  home: HomePage;
  /** The index of works needs nothing but the words that title the page. */
  works: PageText;
  programs: ProgramsPage;
  about: AboutPage;
}

/**
 * No `url`. The site's origin is deployment configuration rather than content —
 * it comes from the PRODUCTION_URL var and is stamped into the published bundle
 * by worker/domain/bundle.ts, which is also where the reasoning lives.
 */
/**
 * How large the site sets its type, as a step rather than a size.
 *
 * The studio asked for a font-size control "like Word". Word's answer — any
 * number of points on any run of text — is the one thing the design cannot
 * offer: six type roles are what make the pages look like one site, and a field
 * that can put nine pixels on a paragraph is a field that can break the contrast
 * floor and the touch floor in a single edit. So it is the same control at the
 * scale the design can honour: one step for the whole site, applied to all six
 * roles at once so their relationships survive it.
 *
 * No step down. Three of the roles already sit at the floor the accessibility
 * rules allow, and the only direction they may not move is smaller.
 */
export const TYPE_SCALES = ['normal', 'large', 'larger'] as const;

export type TypeScale = (typeof TYPE_SCALES)[number];

export function isTypeScale(value: string): value is TypeScale {
  return TYPE_SCALES.some((scale) => scale === value);
}

export interface SiteContent {
  name: LocalisedText;
  contact: {
    email: string;
    wechat: string;
    address: LocalisedText;
    hours: LocalisedText;
    /**
     * The WeChat QR code, or no code at all.
     *
     * Optional, which is the one thing that makes it unlike every other
     * photograph in here: a studio that has not uploaded one gets the card
     * exactly as it was. `null` rather than an ImageRef with an empty `src`,
     * so nothing downstream can accidentally render a URL for a file that is
     * not there — the site branches on the absence instead.
     */
    qr: ImageRef | null;
  };
  /** How large the whole site sets its type. See TypeScale. */
  typeScale: TypeScale;
}

/**
 * The words on the chrome — everything that is not a page, a work, a programme
 * or a person.
 *
 * What is *not* here is as deliberate as what is. A page's title, its
 * description, its prose and the headings over its parts belong to that page,
 * so they are fields on `SitePages` and are edited on the page's own screen;
 * the pager on a work, the labels a screen reader hears, the contact card and
 * the footer appear on every page and belong to none, so they are copy. A key
 * exists because a component in the template reads it by name, which is why the
 * set is fixed: the admin edits values and never adds or removes keys.
 */
export interface Dictionary {
  /** How an inner page's title is composed. `%s` is the page's own title. */
  meta: { titleTemplate: string };
  a11y: {
    skipToContent: string;
    primaryNav: string;
    localeSwitch: string;
    worksList: string;
    worksRail: string;
    workPager: string;
    close: string;
  };
  /** The three words for a work's state, read by the index and by a work page. */
  works: { status: Record<WorkStatus, string> };
  work: {
    index: string;
    status: string;
    year: string;
    discipline: string;
    credits: string;
    previous: string;
    next: string;
  };
  contact: {
    /** The word in the nav bar that opens the card. The one nav label that is
        copy rather than a page, because the card is not a page. */
    nav: string;
    title: string;
    email: string;
    wechat: string;
    address: string;
    hours: string;
    note: string;
    /** The message form: two field labels, the subject the message arrives
        under, and the word on the button. */
    from: string;
    message: string;
    subject: string;
    send: string;
    /**
     * The form in its other three states, and the way out of the third.
     *
     * These arrived with the endpoint. While Send only composed a `mailto:`
     * there was nothing to wait for and nothing that could fail — the reader's
     * own mail client took over and the card was done. A form that posts has a
     * mid-flight, a done and a failed, and a card that does not say which of the
     * three it is in is a card that looks broken while it is working.
     *
     * `failed` is the fallback rather than the usual case: a refusal from the
     * Worker carries its own sentence for whoever typed the message, and the
     * card shows that instead. This is what is said when the network went and
     * there is nothing to relay. `draft` labels the offer of a `mailto:`
     * afterwards, so a failure is never a dead end.
     */
    sending: string;
    sent: string;
    failed: string;
    draft: string;
  };
  notFound: { title: string; body: string; home: string };
  footer: { note: string };
  /** Chrome, lifted into `site` when a revision is published. */
  localeName: string;
}

/** Everything the admin holds in memory. */
export interface ContentSet {
  site: SiteContent;
  pages: SitePages;
  works: Work[];
  programs: Program[];
  mentors: Mentor[];
  projects: Project[];
  zh: Dictionary;
  en: Dictionary;
}

export function emptyLocalised(): LocalisedText {
  return { zh: '', en: '' };
}

/** A photograph with nothing chosen yet. Three lists start an entry this way. */
export function blankImage(): ImageRef {
  return { src: '', alt: emptyLocalised() };
}
