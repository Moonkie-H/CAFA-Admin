/**
 * The form vocabulary: every control an editing screen is built out of.
 *
 * A barrel so a form imports its controls in one line rather than six, and so
 * `components/fields` is the answer to "what can I put on a form" without
 * anyone having to list the directory.
 */
export { CopyFields, type CopyField } from './CopyFields';
export { Field } from './Field';
export { ImageField } from './ImageField';
export { LOCALE_NAMES } from './locale-names';
export { LocalisedField } from './LocalisedField';
export { NumberField } from './NumberField';
export { SelectField } from './SelectField';
export { TextField } from './TextField';
