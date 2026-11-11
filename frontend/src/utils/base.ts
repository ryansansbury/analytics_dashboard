/**
 * The router's basename from Vite's base path.
 *
 * Vite gives the base with a trailing slash ("/analytics-dashboard/") and the
 * router wants it without one, or exactly "/" at the root. The static demo is
 * served from a folder on www.ryansansbury.com, so its routes live under that
 * folder, and the live app at the root of its own origin.
 */
export function routerBasename(base: string | undefined): string {
  const trimmed = (base ?? '/').replace(/\/+$/, '');
  return trimmed || '/';
}
