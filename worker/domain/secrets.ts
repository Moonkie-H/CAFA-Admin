const encoder = new TextEncoder();

// The project also compiles the browser SPA, whose DOM lib declares the
// narrower browser SubtleCrypto surface. Workers adds timingSafeEqual at
// runtime; the generated/current Workers types confirm this extension.
const workerSubtle = crypto.subtle as SubtleCrypto & {
  timingSafeEqual(left: BufferSource, right: BufferSource): boolean;
};

/** Constant-time comparison for fixed-size byte strings. */
export function timingSafeEqualBytes(
  left: Uint8Array<ArrayBuffer>,
  right: Uint8Array<ArrayBuffer>,
): boolean {
  return left.byteLength === right.byteLength && workerSubtle.timingSafeEqual(left, right);
}

/** Hash text first so neither its length nor the first differing byte affects timing. */
export async function timingSafeEqualText(left: string, right: string): Promise<boolean> {
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(left)),
    crypto.subtle.digest('SHA-256', encoder.encode(right)),
  ]);
  return workerSubtle.timingSafeEqual(leftHash, rightHash);
}
