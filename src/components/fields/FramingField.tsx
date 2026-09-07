/**
 * How a photograph appears on the site, decided by looking at it.
 *
 * Every photograph on the site is drawn at its own proportions: the column is
 * as wide as it is, the picture keeps the shape it was taken at. That is still
 * what happens unless somebody says otherwise here, and it is still the right
 * default — but it cannot put a 3:2 photograph and a 4:5 one in the same grid
 * without the grid going ragged, and no amount of care at the camera fixes that.
 *
 * So this gives the photograph a frame. A shape to sit in, whether it fills
 * that shape or fits inside it, how far in, and — the part that makes cropping
 * safe rather than reckless — which part of the picture the frame is held over.
 * A square frame over a landscape photograph throws away a third of it, and
 * which third is a decision only the person who took it can make. It is made
 * here by dragging the picture, which is the only way to make it: a number
 * typed into a box is a guess until you look, and by then it is on the site.
 *
 * **The preview is the site.** The four values become `aspect-ratio`,
 * `object-fit`, `scale` and `object-position` on the picture below, and the same
 * four become the same four properties in CAFA-Template's MediaFrame. Nothing is
 * approximated and nothing is rendered twice — which is why the shape is stored
 * as a number rather than as the word "square". A word would have to mean the
 * same ratio in two codebases, and the day they disagreed this preview would
 * quietly stop being what the page draws.
 *
 * Nothing here touches the bucket. The original and every rung of its ladder
 * are the bytes they were, so a photograph can be reframed as often as the
 * studio likes and nothing is ever re-uploaded or lost.
 */
import { useId, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';

import {
  FRAME_FITS,
  FRAME_ZOOM_MAX,
  FRAME_ZOOM_MIN,
  isNaturalFraming,
  naturalFraming,
  type FrameFit,
  type ImageFraming,
} from '../../../shared/content/types';
import { Field } from './Field';
import { SelectField } from './SelectField';

/**
 * The shapes on offer, and there are five on purpose.
 *
 * A free ratio field would let the studio draw a box no page can lay out — a
 * strip a hundred pixels tall across a whole column — and would make every
 * photograph a small design decision taken alone. Five shapes are the ones a
 * portfolio actually uses: the picture as it is, a square for a grid, and one
 * each of portrait, landscape and wide for when a row has to agree with itself.
 *
 * `ratio` is the number stored, so these labels never reach the content — they
 * are this screen's words for numbers the site reads directly.
 */
const SHAPES = [
  { id: 'natural', ratio: null },
  { id: 'square', ratio: 1 },
  { id: 'portrait', ratio: 4 / 5 },
  { id: 'landscape', ratio: 3 / 2 },
  { id: 'wide', ratio: 16 / 9 },
] as const;

type ShapeId = (typeof SHAPES)[number]['id'];

/** How finely the zoom moves. Coarse enough to land on a round number by hand. */
const ZOOM_STEP = 0.05;

/** The ratio the preview holds before the photograph has loaded and said. */
const UNKNOWN_RATIO = 3 / 2;

interface FramingFieldProps {
  /** Names the picture being framed — "Cover", "Photograph 2". */
  label: string;
  value: ImageFraming;
  onChange: (value: ImageFraming) => void;
  /** Where the photograph can be fetched from. */
  src: string;
}

/** The photograph's own dimensions, once the browser has them. */
interface Natural {
  width: number;
  height: number;
}

export function FramingField({ label, value, onChange, src }: FramingFieldProps) {
  const { t } = useTranslation();
  const frameId = useId();
  const box = useRef<HTMLDivElement>(null);
  const [natural, setNatural] = useState<Natural | null>(null);
  /** Where the drag started, the framing it started from, and how far it may go. */
  const from = useRef<{
    pointerX: number;
    pointerY: number;
    frame: ImageFraming;
    travel: { x: number; y: number };
  } | null>(null);

  const ratio = value.ratio ?? (natural === null ? null : natural.width / natural.height);
  /**
   * Whether any of the photograph is outside the frame to be moved into it.
   *
   * Zoom always puts something outside, whatever the shape. A shape does too,
   * but only while it is being *filled* — "fit inside" is the setting that
   * guarantees the whole photograph is already visible, so panning it could not
   * change the picture, and a slider that cannot change anything is a slider
   * that teaches the studio the control is broken.
   *
   * Stated from the framing rather than measured, because measuring would mean
   * reading the box's size during a render.
   */
  const movable = value.zoom > FRAME_ZOOM_MIN || (value.ratio !== null && value.fit === 'cover');

  function set(next: Partial<ImageFraming>): void {
    onChange({ ...value, ...next });
  }

  /**
   * The photograph's own dimensions, which only the browser knows.
   *
   * They are not on the content record — the admin measures them into the media
   * table and the *site* reads them from the bundle — and this screen does not
   * need them to draw anything: the frame is CSS and the browser applies it
   * whether or not this component knows the size. It needs them for the drag,
   * which has to know how far the picture can travel before it runs out.
   *
   * The same object is kept when nothing has changed, so re-reading it on every
   * commit cannot loop.
   */
  function measure(node: HTMLImageElement | null): void {
    if (node === null || node.naturalWidth === 0) return;
    setNatural((current) =>
      current !== null &&
      current.width === node.naturalWidth &&
      current.height === node.naturalHeight
        ? current
        : { width: node.naturalWidth, height: node.naturalHeight },
    );
  }

  /**
   * How many pixels of the photograph fall outside the frame, per axis.
   *
   * The same arithmetic the browser is about to do: `object-fit` decides the
   * scale that makes the picture cover the box or fit inside it, `zoom`
   * multiplies it, and what is left over is how far the picture can travel. Zero
   * on an axis means that axis is already exact and dragging it would move
   * nothing — so it does not move, rather than moving a value that draws the
   * same picture.
   */
  function overflow(): { x: number; y: number } {
    // One read, taken when a drag begins rather than on every move: the box and
    // the framing both hold still for the length of a drag, so re-measuring per
    // frame would be a layout read that can only return the same answer.
    const rect = box.current?.getBoundingClientRect();
    if (rect === undefined || natural === null) return { x: 0, y: 0 };
    const fitted =
      value.fit === 'cover'
        ? Math.max(rect.width / natural.width, rect.height / natural.height)
        : Math.min(rect.width / natural.width, rect.height / natural.height);
    const scale = fitted * value.zoom;
    return {
      x: Math.max(0, natural.width * scale - rect.width),
      y: Math.max(0, natural.height * scale - rect.height),
    };
  }

  function startDrag(event: ReactPointerEvent<HTMLDivElement>): void {
    if (!movable) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    from.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      frame: value,
      travel: overflow(),
    };
  }

  function drag(event: ReactPointerEvent<HTMLDivElement>): void {
    const start = from.current;
    if (start === null) return;
    // The picture follows the pointer, so the *window* over it moves the other
    // way: dragging right shows more of the left edge, which is a lower x.
    // Whole per cent, which is the sliders' step too — so the two controls write
    // the same values and the number beside a slider is the number stored.
    const move = (at: number, delta: number, span: number) =>
      span === 0 ? at : clamp(Math.round(at - (delta / span) * 100));
    set({
      x: move(start.frame.x, event.clientX - start.pointerX, start.travel.x),
      y: move(start.frame.y, event.clientY - start.pointerY, start.travel.y),
    });
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>): void {
    if (from.current === null) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    from.current = null;
  }

  return (
    <div className="framing">
      <div className="framing-preview-column">
        {/*
          Not a button and not an input, because it is neither: it is the
          photograph, shown where it will be shown, and the drag is a shortcut
          for the two sliders beside it rather than the only way to reach them.
          Everything it can do, they can do with a keyboard — which is why this
          is aria-hidden rather than given a role it would only half honour.
        */}
        <div
          ref={box}
          aria-hidden="true"
          className="framing-preview"
          data-movable={movable ? '' : undefined}
          onPointerDown={startDrag}
          onPointerMove={drag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          style={{ aspectRatio: String(ratio ?? UNKNOWN_RATIO) }}
        >
          {/*
            The four properties, set here rather than through a class, because
            they are the four values being edited — and they are the same four
            CAFA-Template's MediaFrame sets on the picture it draws. `scale`
            about `transformOrigin` rather than a second crop: it magnifies
            around the point the frame is already held over, so zooming in does
            not also drift.
          */}
          <img
            src={src}
            alt=""
            draggable={false}
            style={{
              objectFit: value.fit,
              objectPosition: `${value.x}% ${value.y}%`,
              scale: String(value.zoom),
              transformOrigin: `${value.x}% ${value.y}%`,
            }}
            // Both, because either one alone has a hole in it: `load` does not
            // fire again for a photograph the browser already has decoded, and
            // the ref runs before a photograph being fetched for the first time
            // has any dimensions to read.
            ref={measure}
            onLoad={(event) => measure(event.currentTarget)}
          />
        </div>
        <p className="field-hint">{movable ? t('framing.dragHint') : t('framing.wholeHint')}</p>
      </div>

      <div className="framing-controls">
        <SelectField<ShapeId>
          label={t('framing.shape')}
          value={shapeOf(value.ratio)}
          options={SHAPES.map((shape) => ({
            value: shape.id,
            label: t(`framing.shapes.${shape.id}`),
          }))}
          onChange={(id) => set({ ratio: SHAPES.find((shape) => shape.id === id)?.ratio ?? null })}
        />

        {/* Only where there is a frame to fill or fit inside. With the
            photograph's own shape the two words describe the same picture, and
            a control whose settings are indistinguishable is a control that
            teaches the studio it does nothing. */}
        {value.ratio !== null && (
          <SelectField<FrameFit>
            label={t('framing.fit')}
            value={value.fit}
            options={FRAME_FITS.map((fit) => ({ value: fit, label: t(`framing.fits.${fit}`) }))}
            onChange={(fit) => set({ fit })}
          />
        )}

        <Slider
          label={t('framing.zoom')}
          id={`${frameId}-zoom`}
          min={FRAME_ZOOM_MIN}
          max={FRAME_ZOOM_MAX}
          step={ZOOM_STEP}
          value={value.zoom}
          display={t('framing.percent', { value: Math.round(value.zoom * 100) })}
          onChange={(zoom) => set({ zoom })}
        />

        {/* The keyboard's half of the drag. Hidden with it, for the same reason:
            a picture that exactly fills its frame has nowhere to go. */}
        {movable && (
          <div className="framing-focus">
            <Slider
              label={t('framing.horizontal')}
              id={`${frameId}-x`}
              min={0}
              max={100}
              step={1}
              value={value.x}
              display={t('framing.percent', { value: Math.round(value.x) })}
              onChange={(x) => set({ x })}
            />
            <Slider
              label={t('framing.vertical')}
              id={`${frameId}-y`}
              min={0}
              max={100}
              step={1}
              value={value.y}
              display={t('framing.percent', { value: Math.round(value.y) })}
              onChange={(y) => set({ y })}
            />
          </div>
        )}

        {!isNaturalFraming(value) && (
          <button
            type="button"
            className="button button-quiet framing-reset"
            onClick={() => onChange(naturalFraming())}
          >
            {t('framing.reset', { name: label })}
          </button>
        )}
      </div>
    </div>
  );
}

/** Which of the five shapes a stored ratio is. Anything else reads as its own. */
function shapeOf(ratio: number | null): ShapeId {
  return SHAPES.find((shape) => shape.ratio === ratio)?.id ?? 'natural';
}

function clamp(value: number): number {
  return Math.min(100, Math.max(0, value));
}

/**
 * A number chosen by dragging, with the number itself beside it.
 *
 * Private here rather than a field of its own: three of them exist, all in this
 * component, and a range input is the one control in the admin whose value the
 * studio cannot read off the control. The rule of three has not been met and
 * would not be met by moving it.
 */
function Slider({
  label,
  id,
  min,
  max,
  step,
  value,
  display,
  onChange,
}: {
  label: string;
  id: string;
  min: number;
  max: number;
  step: number;
  value: number;
  display: string;
  onChange: (value: number) => void;
}) {
  return (
    <Field label={label} htmlFor={id}>
      <div className="framing-slider">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(event.target.valueAsNumber)}
        />
        <output htmlFor={id}>{display}</output>
      </div>
    </Field>
  );
}
