/**
 * The box every control sits in: a name above it and a note below.
 *
 * Every field in this folder draws the same three things in the same order, and
 * they used to draw them each — three copies of the label, three of the hint's
 * `hint !== undefined &&`. The parts that genuinely differ are the control in
 * the middle and whether there is an `id` to point a `<label>` at, so those are
 * the two things a caller passes.
 *
 * `htmlFor` is what decides between a real `<label>` and a `<span>`, and the
 * distinction is not cosmetic: a `<label for>` pointing at nothing is worse than
 * no label at all, so a group of controls (a bilingual pair, a photograph and
 * its description) names itself with a span and lets its own children carry the
 * associations.
 */
import type { ReactNode } from 'react';

interface FieldProps {
  label: string;
  hint?: string;
  /** The id of the one control this names. Omitted where it names a group. */
  htmlFor?: string;
  children: ReactNode;
}

export function Field({ label, hint, htmlFor, children }: FieldProps) {
  return (
    <div className="field">
      {htmlFor === undefined ? (
        <span className="field-label">{label}</span>
      ) : (
        <label className="field-label" htmlFor={htmlFor}>
          {label}
        </label>
      )}
      {children}
      {hint !== undefined && <p className="field-hint">{hint}</p>}
    </div>
  );
}
