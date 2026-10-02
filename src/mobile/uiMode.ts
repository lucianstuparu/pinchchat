/**
 * Chooses between the messenger-style mobile UI (src/mobile) and the full
 * upstream PinchChat UI.
 *
 * Precedence: ?ui=mobile|full in the URL (persisted) > stored choice >
 * VITE_DEFAULT_UI build setting > 'full' (upstream behaviour).
 */
export type UiMode = 'mobile' | 'full';

const STORAGE_KEY = 'pinchchat:ui';

function isUiMode(v: unknown): v is UiMode {
  return v === 'mobile' || v === 'full';
}

export function getUiMode(): UiMode {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('ui');
    if (isUiMode(fromUrl)) {
      localStorage.setItem(STORAGE_KEY, fromUrl);
      return fromUrl;
    }
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isUiMode(stored)) return stored;
  } catch {
    // Storage unavailable (private mode) — fall through to the build default
  }
  const fromEnv = import.meta.env.VITE_DEFAULT_UI;
  return isUiMode(fromEnv) ? fromEnv : 'full';
}

/** Persist a UI choice and reload into it. */
export function switchUiMode(mode: UiMode) {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Ignore — the URL parameter below still carries the choice for this load
  }
  const url = new URL(window.location.href);
  url.searchParams.set('ui', mode);
  window.location.href = url.toString();
}
