import { ApiException } from './api-exception';

export const MAX_JSON_BYTES = 1024 * 1024;
export const MAX_CREDENTIAL_BYTES = 8 * 1024;
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

/** Read a request body into memory, but never beyond the explicitly allowed size. */
export async function readBytes(request: Request, maxBytes: number): Promise<ArrayBuffer> {
  const declared = request.headers.get('Content-Length');
  if (declared !== null) {
    const size = Number(declared);
    if (Number.isFinite(size) && size > maxBytes) throw ApiException.payloadTooLarge();
  }

  if (request.body === null) return new ArrayBuffer(0);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw ApiException.payloadTooLarge();
    }
    chunks.push(value);
  }

  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body.buffer;
}

export async function readJson(request: Request, maxBytes = MAX_JSON_BYTES): Promise<unknown> {
  const body = await readBytes(request, maxBytes);
  return JSON.parse(new TextDecoder().decode(body)) as unknown;
}

export async function readOptionalJson(
  request: Request,
  maxBytes = MAX_JSON_BYTES,
): Promise<unknown> {
  const body = await readBytes(request, maxBytes);
  if (body.byteLength === 0) return {};
  return JSON.parse(new TextDecoder().decode(body)) as unknown;
}
