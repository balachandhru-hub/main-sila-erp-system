/** Base font size the design system's rem values are written against. */
export const REM_BASE = 16;

/**
 * Size props accept a number (design px, as in the mockups) or any CSS length. Numbers are
 * emitted as rem so inline sizes scale with the root font size like the stylesheets do.
 */
export const toRem = (value: number | string | undefined): string | undefined =>
  typeof value === 'number' ? `${value / REM_BASE}rem` : value;
