/**
 * api.json, compiled.
 *
 * There is no OpenAPI file in this repository, and that is the design. A
 * checked-in document is a copy of the route table that nobody updates in the
 * same commit as the route; this one is built from worker/connectors/registry.ts
 * on the way out, so it is never more or less than what the Worker will
 * actually answer. Adding a connector publishes its documentation.
 *
 * 3.1 rather than 3.0 because 3.1 *is* JSON Schema — the shapes in schema.ts go
 * in as they are, and a generator on the other end produces types that match
 * what arrives rather than a dialect approximation of it.
 *
 * The server is the origin the document was fetched from. That means the copy a
 * developer downloads from the dev panel on localhost points at localhost, and
 * the one downloaded from the deployed admin points at the deployed admin —
 * which is almost always what was meant, and never a hostname pasted in by hand.
 * The scheme is the one exception, and `servedOver` says why.
 */
import {
  CONTACT_DESCRIPTION,
  CONTACT_PATH,
  CONTACT_REQUEST,
  CONTACT_RESPONSE,
  CONTACT_SUMMARY,
} from './contact-endpoint';
import { API_VERSION, CONNECTORS, GROUPS } from './registry';
import { COMPONENTS, type JsonSchema } from './schema';
import type { Connector } from './connector';

interface DocumentedParameter {
  name: string;
  in: 'path' | 'query';
  required: boolean;
  description: string;
  schema: JsonSchema;
  example: string;
}

interface DocumentedResponse {
  description: string;
  content: { 'application/json': { schema: JsonSchema } };
}

interface DocumentedBody {
  required: true;
  content: { 'application/json': { schema: JsonSchema } };
}

interface DocumentedOperation {
  operationId: string;
  tags: string[];
  summary: string;
  description: string;
  parameters?: DocumentedParameter[];
  /** Only the one write has a body. Every connector is a GET. */
  requestBody?: DocumentedBody;
  responses: Record<string, DocumentedResponse>;
}

/**
 * A path, and the verbs it answers.
 *
 * Both optional because the document holds one path with a POST and no GET and
 * a dozen with a GET and no POST — writing it as a partial record means neither
 * has to pretend to the other's shape.
 */
type DocumentedPath = Partial<Record<'get' | 'post', DocumentedOperation>>;

export interface OpenApiDocument {
  openapi: string;
  info: { title: string; version: string; description: string };
  /**
   * Empty, and said out loud. An absent `security` means "unspecified", which a
   * generator is free to read as "figure it out"; an empty array means these
   * endpoints take no credentials, which is the fact.
   */
  security: never[];
  servers: { url: string; description: string }[];
  tags: { name: string; description: string }[];
  paths: Record<string, DocumentedPath>;
  components: { schemas: Record<string, JsonSchema> };
}

const OVERVIEW = `The c.a.f.a atelier's content.

Every read here answers the newest **published** revision — what is on the public
site right now. There is no way to *change* content through this API and no way to
read an unpublished edit: the studio's own editing endpoints sit behind a session
cookie and are not described here.

Every successful answer has the same two fields:

    { "revision": 42, "data": … }

\`revision\` is the snapshot the data was cut from, so anything you cache can be
checked against \`/api/v1/revision\` with one small request rather than a refetch.

Photographs are not served through this API. Content refers to a photograph by
its object key, and \`mediaBase\` on the bundle — or the \`url\` on each entry
of \`/api/v1/photographs\` — resolves that key against the media origin, so an
\`<img src>\` reaches the CDN directly. \`mediaTransform\` on the bundle says
whether those URLs may go through \`/cdn-cgi/image/…\` first; when it is false
the zone cannot transform and the originals are what the site renders. Append
the entry's \`version\` as a query parameter when you build such a URL yourself
— a key stays the same when the studio replaces the photograph under it, so the
version is the only thing that tells a cache the picture has changed.

Any origin may read these endpoints. They carry only what is already public.

There is exactly one thing here that is not a read. \`POST /api/v1/contact\`
sends a message to the studio, and it is on this surface because a frontend has
to be able to call it. It cannot be pointed anywhere: the recipient is the
published \`site.contact.email\` and is read fresh on every request.`;

/** A successful answer: the envelope, with this connector's shape inside it. */
function answerSchema(connector: Connector): JsonSchema {
  return {
    type: 'object',
    properties: {
      revision: {
        type: 'integer',
        description: 'The published revision this data was cut from.',
      },
      data: connector.returns,
    },
    required: ['revision', 'data'],
  };
}

function parameterSchema(values: readonly string[] | undefined): JsonSchema {
  return values === undefined ? { type: 'string' } : { type: 'string', enum: values };
}

function operationOf(connector: Connector): DocumentedOperation {
  const parameters = (connector.params ?? []).map<DocumentedParameter>((param) => ({
    name: param.name,
    in: param.in,
    required: param.required,
    description: param.description,
    schema: parameterSchema(param.values),
    example: param.example,
  }));

  const responses: Record<string, DocumentedResponse> = {
    '200': {
      description: connector.summary,
      content: { 'application/json': { schema: answerSchema(connector) } },
    },
    '404': {
      description:
        'Either nothing has been published yet, or what was asked for is not in the published revision.',
      content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
    },
  };

  return {
    operationId: connector.id,
    tags: [connector.group],
    summary: connector.summary,
    description: connector.description,
    ...(parameters.length === 0 ? {} : { parameters }),
    responses,
  };
}

/**
 * The one write, as an operation.
 *
 * Spelled out rather than generated from a list of one, and kept beside the
 * loop over the connectors so that the document plainly has two sources and not
 * a source and an exception hidden in a helper.
 */
function contactOperation(): DocumentedOperation {
  const refusal = (description: string): DocumentedResponse => ({
    description,
    content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
  });

  return {
    operationId: 'sendContactMessage',
    tags: ['Contact'],
    summary: CONTACT_SUMMARY,
    description: CONTACT_DESCRIPTION,
    requestBody: {
      required: true,
      content: { 'application/json': { schema: CONTACT_REQUEST } },
    },
    responses: {
      '200': {
        description: 'The message was sent — or was silently dropped as spam, which answers alike.',
        content: { 'application/json': { schema: CONTACT_RESPONSE } },
      },
      '400': refusal('Something the sender can fix: a malformed address, an empty message.'),
      '429': refusal('Too many messages from one address in a short window.'),
      '503': refusal(
        'The studio has not finished setting the form up, or nothing has been published yet. Fall back to a mailto: link rather than dropping the message.',
      ),
    },
  };
}

/** Path parameters, in the notation OpenAPI wants: `/works/:slug` → `/works/{slug}`. */
function documentedPath(path: string): string {
  return path.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
}

/**
 * The origin, over the scheme it is actually reachable on.
 *
 * `url.origin` reports the scheme the *caller* used, so fetching this document
 * over plain HTTP bakes `http://` into `servers` — and a generator turns that
 * into a client whose base URL costs a redirect on every request, or is refused
 * outright as mixed content on an HTTPS page. The deployed admin is reachable
 * over HTTPS whatever scheme was asked for, so the document says so.
 *
 * Loopback is left alone: `wrangler dev` genuinely serves HTTP, and a forced
 * `https://localhost` would be the same bug pointing the other way.
 */
function servedOver(origin: string): string {
  const url = new URL(origin);
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return origin;

  url.protocol = 'https:';
  return url.origin;
}

export function buildDocument(origin: string): OpenApiDocument {
  const paths: Record<string, DocumentedPath> = {};
  for (const connector of CONNECTORS) {
    paths[documentedPath(connector.path)] = { get: operationOf(connector) };
  }
  paths[CONTACT_PATH] = { post: contactOperation() };

  return {
    openapi: '3.1.0',
    info: {
      title: 'c.a.f.a atelier — content API',
      version: API_VERSION,
      description: OVERVIEW,
    },
    security: [],
    servers: [{ url: servedOver(origin), description: 'The admin, which is also the API.' }],
    tags: [
      ...GROUPS.map((group) => ({ name: group.name, description: group.description })),
      {
        name: 'Contact',
        description:
          'The one endpoint here that is not a read: a message from a visitor to the studio’s published address.',
      },
    ],
    paths,
    components: { schemas: COMPONENTS },
  };
}
