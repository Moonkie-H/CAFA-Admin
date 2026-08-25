/**
 * A choice from a fixed set — a work's status, a section's kind.
 *
 * Generic over the value so the callback hands back the union rather than a
 * string: `onChange` on a `SelectField<WorkStatus>` gives a `WorkStatus`, which
 * is what lets a caller put it straight into the record. The chosen option is
 * looked up rather than cast, so a value the list does not contain — which the
 * DOM can produce and the type cannot — is dropped instead of written.
 */
import { useId } from 'react';

import { Field } from './Field';

interface SelectFieldProps<T extends string> {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  hint?: string;
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  hint,
}: SelectFieldProps<T>) {
  const id = useId();

  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <select
        id={id}
        className="input input-narrow"
        value={value}
        onChange={(event) => {
          const chosen = options.find((option) => option.value === event.target.value);
          if (chosen !== undefined) onChange(chosen.value);
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}
