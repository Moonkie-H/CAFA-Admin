/**
 * A whole number — a work's own number, and the year it is from.
 *
 * An emptied box reads back as `NaN` rather than as zero, which is why the
 * value is guarded on the way in: `value={NaN}` puts React into an uncontrolled
 * input and the box stops accepting keystrokes. The validator is what refuses
 * the `NaN` itself, so clearing the field is allowed and unsaveable rather than
 * silently becoming a number nobody typed.
 */
import { useId } from 'react';

import { Field } from './Field';

interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  hint?: string;
}

export function NumberField({ label, value, onChange, hint }: NumberFieldProps) {
  const id = useId();

  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <input
        id={id}
        className="input input-narrow"
        type="number"
        value={Number.isFinite(value) ? value : ''}
        onChange={(event) => onChange(event.target.valueAsNumber)}
      />
    </Field>
  );
}
