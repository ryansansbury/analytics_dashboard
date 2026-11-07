/**
 * Whether the visitor has asked their system for less motion.
 *
 * Charts draw in without animation when they have. That respects the setting
 * for people who find movement distracting or worse, and it's also how the
 * screenshot script gets a settled frame: it emulates the setting rather than
 * guessing how long an animation runs.
 */
export const REDUCED_MOTION =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
