const STORAGE_KEY = 'pinchchat_credentials';

export type AuthMode = 'token' | 'password';

export interface StoredCredentials {
  url: string;
  token: string;
  /** Auth mode — defaults to 'token' for backward compatibility */
  authMode?: AuthMode;
  /** Custom client ID sent in the WebSocket connect frame (default: 'webchat') */
  clientId?: string;
}

export function getStoredCredentials(): StoredCredentials | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.url && parsed.token) return parsed;
  } catch {
    // Ignore malformed localStorage data
  }
  return null;
}

export function storeCredentials(url: string, token: string, authMode: AuthMode = 'token', clientId?: string) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ url, token, authMode, ...(clientId ? { clientId } : {}) }));
}

export function clearCredentials() {
  localStorage.removeItem(STORAGE_KEY);
}
