/**
 * Bytes to text and back, in the one encoding that survives a cookie.
 *
 * Base64url rather than base64 because both callers put the result somewhere
 * with opinions about `+`, `/` and `=`: the sealed session goes in a cookie
 * value, and the password hash goes in a `wrangler secret` that a person has to
 * copy and paste. Padding is dropped on the way out and not required on the way
 * back, so a hash that lost its `=` in transit still opens.
 */

/** Never throws. */
export function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

/** `null` for anything that is not base64url — which is a normal input here. */
export function fromBase64Url(value: string): Uint8Array<ArrayBuffer> | null {
  try {
    const binary = atob(value.replaceAll('-', '+').replaceAll('_', '/'));
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}
