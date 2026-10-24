/** The app's own icon, at its stamped address (tools/stamp-icons.mjs), so a new icon is never served stale. */
export const appLogo = (): string =>
  document.querySelector<HTMLMetaElement>('meta[name="app-logo"]')?.content || '/logo-192.png';
