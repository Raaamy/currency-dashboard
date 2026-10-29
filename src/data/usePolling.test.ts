import { renderHook } from '@testing-library/react';
import { usePolling } from './usePolling';

let visibility: DocumentVisibilityState = 'visible';

function setVisibility(state: DocumentVisibilityState) {
  visibility = state;
  document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(() => {
  visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => visibility,
  });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  // Remove the instance override so the jsdom prototype getter applies again.
  delete (document as { visibilityState?: DocumentVisibilityState }).visibilityState;
});

describe('usePolling', () => {
  it('runs immediately, then every interval while visible', () => {
    const cb = vi.fn();
    renderHook(() => usePolling(cb, 1000));
    expect(cb).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(999);
    expect(cb).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(cb).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(3000);
    expect(cb).toHaveBeenCalledTimes(5);
  });

  it('pauses while hidden and runs immediately + restarts when visible again', () => {
    const cb = vi.fn();
    renderHook(() => usePolling(cb, 1000));
    vi.advanceTimersByTime(500);
    setVisibility('hidden');
    vi.advanceTimersByTime(5000);
    expect(cb).toHaveBeenCalledTimes(1);

    setVisibility('visible');
    expect(cb).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(999);
    expect(cb).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(1);
    expect(cb).toHaveBeenCalledTimes(3);
  });

  it('does not start the interval when mounted hidden', () => {
    visibility = 'hidden';
    const cb = vi.fn();
    renderHook(() => usePolling(cb, 1000));
    expect(cb).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(5000);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('always calls the latest callback', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ cb }) => usePolling(cb, 1000), {
      initialProps: { cb: first },
    });
    rerender({ cb: second });
    vi.advanceTimersByTime(1000);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('clears on unmount and does nothing when disabled', () => {
    const cb = vi.fn();
    const { unmount } = renderHook(() => usePolling(cb, 1000));
    unmount();
    vi.advanceTimersByTime(5000);
    setVisibility('hidden');
    setVisibility('visible');
    expect(cb).toHaveBeenCalledTimes(1);

    const off = vi.fn();
    renderHook(() => usePolling(off, 1000, false));
    vi.advanceTimersByTime(5000);
    expect(off).not.toHaveBeenCalled();
  });

  it('keeps polling when the callback throws or rejects', () => {
    const cb = vi
      .fn<() => void | Promise<void>>()
      .mockImplementationOnce(() => {
        throw new Error('boom');
      })
      .mockImplementationOnce(() => Promise.reject(new Error('nope')));
    renderHook(() => usePolling(cb, 1000));
    vi.advanceTimersByTime(2000);
    expect(cb).toHaveBeenCalledTimes(3);
  });
});
