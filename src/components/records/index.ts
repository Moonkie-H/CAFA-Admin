/**
 * The shapes a *record* is edited in, as opposed to the fields inside one.
 *
 * `Repeatable` owns a list and every operation on it, `ReorderControls` owns the
 * two buttons and the ends they stop at, `DeleteRecord` owns the question asked
 * before something is thrown away, and `RecordIndex` owns the numbered list a
 * form is opened from. They were one file with the fields until the file's own
 * comment had to explain that it was two things.
 */
export { DeleteRecord } from './DeleteRecord';
export { RecordIndex, RecordRow } from './RecordIndex';
export { Repeatable } from './Repeatable';
export { ReorderControls } from './ReorderControls';
