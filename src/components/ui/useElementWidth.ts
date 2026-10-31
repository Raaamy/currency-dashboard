import { useLayoutEffect, useState, type RefObject } from 'react';

/**
 * Border-box width of an element, kept current with a ResizeObserver. Measured once in a
 * layout effect so the first paint already uses it. `null` until measured and wherever
 * ResizeObserver is missing (jsdom): callers treat that as the wide layout.
 */
export function useElementWidth(ref: RefObject<HTMLElement | null>): number | null {
  const [width, setWidth] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    setWidth(el.getBoundingClientRect().width);
    const observer = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1];
      const box = entry?.borderBoxSize?.[0];
      setWidth(box ? box.inlineSize : el.getBoundingClientRect().width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return width;
}
