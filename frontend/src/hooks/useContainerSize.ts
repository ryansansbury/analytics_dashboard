import { useState, useEffect, useRef } from 'react';
import type { RefObject } from 'react';

interface ContainerSize {
  width: number;
  height: number;
}

/**
 * The content box of an element, kept current as it resizes.
 *
 * Content box on both paths, padding excluded. The ResizeObserver reports the
 * content box, and the first measurement used to come from
 * getBoundingClientRect, which includes padding, so a chart drew one frame
 * taller than its card and the bottom edge clipped until the observer caught up.
 */
export function useContainerSize<T extends HTMLElement>(): [RefObject<T | null>, ContainerSize] {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState<ContainerSize>({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setSize({ width, height });
      }
    });

    resizeObserver.observe(element);

    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const padX = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
    const padY = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
    setSize({ width: Math.max(0, rect.width - padX), height: Math.max(0, rect.height - padY) });

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return [ref, size];
}
