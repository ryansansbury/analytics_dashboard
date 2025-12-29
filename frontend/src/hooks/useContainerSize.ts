import { useState, useEffect, useRef } from 'react';
import type { RefObject } from 'react';

interface ContainerSize {
  width: number;
  height: number;
}

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

    // Initial measurement
    const rect = element.getBoundingClientRect();
    setSize({ width: rect.width, height: rect.height });

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return [ref, size];
}
