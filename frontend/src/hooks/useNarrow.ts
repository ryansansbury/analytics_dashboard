import { useEffect, useState } from 'react';

const NARROW = '(max-width: 640px)';
const PHONE = '(max-width: 640px), (max-width: 960px) and (max-height: 500px)';

function matches(query: string): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
}

function useMedia(query: string): boolean {
  const [on, setOn] = useState(() => matches(query));

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const list = window.matchMedia(query);
    const update = () => setOn(list.matches);
    update();
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, [query]);

  return on;
}

/**
 * Whether the window is phone-sized, kept current as the phone turns.
 *
 * Charts use it to space their axis labels for a narrow screen. A wider
 * window never matches, so a desktop draws exactly as before.
 */
export function useNarrow(): boolean {
  return useMedia(NARROW);
}

/**
 * Whether the window is a phone's, upright or on its side, kept current as
 * the phone turns.
 *
 * Charts use it to draw their small labels a size up on a phone's screen. A
 * desktop window never matches.
 */
export function usePhone(): boolean {
  return useMedia(PHONE);
}
