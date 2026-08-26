/**
 * One endpoint, with a box to try it from.
 *
 * Every connector is a GET over published content, so "try it" is a real
 * request to the real endpoint rather than a mock. There is nothing here that
 * can change anything: the writing half of the API is behind the session and is
 * not in the document at all.
 *
 * The card owns the values in its own boxes and the answer to its own request,
 * because nothing outside it needs either — a dozen of these are on the page at
 * once and lifting that state would make the panel re-render every one of them
 * on every keystroke in any of them.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { connectorService, resolvePath, type ConnectorView } from '../../services/connectors';
import { plain } from './markdown';

/** A long answer is truncated on screen; the whole of it is one click away. */
const SHOWN = 12_000;

interface ConnectorCardProps {
  connector: ConnectorView;
  server: string;
}

interface Attempt {
  status: number;
  ok: boolean;
  body: string;
}

export function ConnectorCard({ connector, server }: ConnectorCardProps) {
  const { t } = useTranslation();
  // Path parameters start at their example so the first request works; query
  // parameters start empty, because empty is what a client sends by default and
  // that is the answer worth seeing first.
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      connector.params.map((param) => [param.name, param.in === 'path' ? (param.example ?? '') : '']),
    ),
  );
  const [result, setResult] = useState<Attempt | null>(null);
  const [busy, setBusy] = useState(false);

  const path = resolvePath(connector, values);
  const write = (name: string, value: string) =>
    setValues((current) => ({ ...current, [name]: value }));

  async function send(): Promise<void> {
    setBusy(true);
    try {
      setResult(await connectorService.probe(path));
    } catch (error) {
      setResult({
        status: 0,
        ok: false,
        body: error instanceof Error ? error.message : t('devPage.requestFailed'),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="connector" id={connector.id}>
      <div className="connector-head">
        <span className="method">GET</span>
        <code className="connector-path">{connector.path}</code>
      </div>

      <h4 className="connector-summary">{connector.summary}</h4>
      <p className="connector-note">{plain(connector.description)}</p>

      {connector.params.length > 0 && (
        <div className="connector-params">
          {connector.params.map((param) => (
            <label key={param.name} className="connector-param">
              <span className="field-label">
                {param.name}
                <span className="connector-param-kind">
                  {param.in}
                  {param.required ? ` · ${t('devPage.required')}` : ''}
                </span>
              </span>

              {param.schema?.enum === undefined ? (
                <input
                  className="input"
                  value={values[param.name] ?? ''}
                  placeholder={param.example ?? ''}
                  onChange={(event) => write(param.name, event.target.value)}
                />
              ) : (
                <select
                  className="input"
                  value={values[param.name] ?? ''}
                  onChange={(event) => write(param.name, event.target.value)}
                >
                  {!param.required && <option value="">{t('devPage.anyValue')}</option>}
                  {param.schema.enum.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              )}

              <span className="field-hint">{param.description}</span>
            </label>
          ))}
        </div>
      )}

      <div className="connector-run">
        <code className="connector-curl">
          curl {server}
          {path}
        </code>
        <button type="button" className="button" disabled={busy} onClick={() => void send()}>
          {busy ? t('devPage.sending') : t('devPage.send')}
        </button>
      </div>

      {result !== null && (
        <div className="connector-result">
          <span className={`pill${result.ok ? '' : ' pill-warn'}`}>
            {result.status === 0 ? t('devPage.noAnswer') : result.status}
          </span>
          <pre className="connector-body">
            {result.body.length > SHOWN
              ? `${result.body.slice(0, SHOWN)}\n\n${t('devPage.truncated', {
                  characters: result.body.length - SHOWN,
                  path,
                })}`
              : result.body}
          </pre>
        </div>
      )}

      {connector.schema !== undefined && (
        <details className="connector-schema">
          <summary>{t('devPage.response')}</summary>
          <pre className="connector-body">{JSON.stringify(connector.schema, null, 2)}</pre>
        </details>
      )}
    </article>
  );
}
