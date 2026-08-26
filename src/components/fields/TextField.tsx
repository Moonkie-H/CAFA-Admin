/** One line of text, or several. The control the rest of the form is built on. */
import { useId } from 'react';

import { Field } from './Field';

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  multiline?: boolean;
  placeholder?: string;
  inputMode?: 'text' | 'numeric' | 'email' | 'url';
}

export function TextField({
  label,
  value,
  onChange,
  hint,
  multiline = false,
  placeholder,
  inputMode = 'text',
}: TextFieldProps) {
  const id = useId();

  return (
    <Field label={label} hint={hint} htmlFor={id}>
      {multiline ? (
        <textarea
          id={id}
          className="input"
          rows={4}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          id={id}
          className="input"
          type="text"
          inputMode={inputMode}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </Field>
  );
}
