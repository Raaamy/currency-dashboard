import { useEffect, useRef } from 'react';

/**
 * Runs `callback` immediately on mount, then every `intervalMs` while the document is
 * visible. Hidden -> the interval stops; visible again -> runs immediately and restarts
 * the interval. The latest `callback` is always used, so it need not be memoised.
 */
export function usePolling(
  callback: () => void | Promise<void>,
  intervalMs: number,
  enabled = true,
): void {
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setInterval> | undefined;

    const run = () => {
      try {
        Promise.resolve(callbackRef.current()).catch(() => undefined);
      } catch {
        // A throwing callback must not stop polling.
      }
    };
    const stop = () => {
      if (timer !== undefined) clearInterval(timer);
      timer = undefined;
    };
    const start = () => {
      stop();
      timer = setInterval(run, intervalMs);
    };
    const isVisible = () => document.visibilityState === 'visible';
    const onVisibilityChange = () => {
      if (isVisible()) {
        run();
        start();
      } else {
        stop();
      }
    };

    run();
    if (isVisible()) start();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [intervalMs, enabled]);
}
