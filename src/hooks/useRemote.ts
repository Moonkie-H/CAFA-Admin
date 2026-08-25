/**
 * Something read from the Worker, and the three states it is ever in.
 *
 * Five screens in this admin fetch something on mount, and each of them used to
 * spell out the same four steps: make an AbortController, await, check the
 * signal before touching state, and turn whatever was thrown into a sentence.
 * Written five times they came out five different ways — one kept a second ref
 * beside the controller, one aborted without checking, one wrapped the call in
 * an async IIFE that returned the promise it was meant to be swallowing.
 *
 * The stale guard is the reason to have one copy rather than five. A reply that
 * arrives after its screen has moved on must not be written anywhere, and that
 * is exactly the check that is easy to leave out and impossible to see missing.
 *
 * `read` has to be stable across renders. It is in the effect's dependencies,
 * so a fresh function every render is a fresh request every render — and then
 * another, forever. A method off one of the service objects already is stable,
 * which is what the five callers pass; anything built inside a component needs
 * `useCallback`.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export type RemoteStatus = 'loading' | 'ready' | 'failed';

export interface Remote<T> {
  status: RemoteStatus;
  /**
   * The last answer, or null before there has been one. A failed read keeps
   * whatever the previous one returned: the publish bar polls while a build
   * settles, and one refused poll should not blank the revision it is showing.
   */
  data: T | null;
  error: string | null;
  /** Read it again. Supersedes whatever is in flight. */
  reload: () => Promise<void>;
}

type Reader<T> = (signal: AbortSignal) => Promise<T>;

interface State<T> {
  status: RemoteStatus;
  data: T | null;
  error: string | null;
}

export function useRemote<T>(read: Reader<T>, whenUnreadable: string): Remote<T> {
  const [state, setState] = useState<State<T>>({ status: 'loading', data: null, error: null });
  const inFlight = useRef<AbortController | null>(null);

  const load = useCallback(async (): Promise<void> => {
    // A reload supersedes an unfinished read rather than racing it, so the
    // newest request is always the one whose answer is kept.
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;

    try {
      const data = await read(controller.signal);
      if (!controller.signal.aborted) setState({ status: 'ready', data, error: null });
    } catch (failure) {
      if (controller.signal.aborted) return;
      setState((previous) => ({
        status: 'failed',
        data: previous.data,
        error: failure instanceof Error ? failure.message : whenUnreadable,
      }));
    }
  }, [read, whenUnreadable]);

  useEffect(() => {
    void load();
    return () => inFlight.current?.abort();
  }, [load]);

  return { ...state, reload: load };
}
