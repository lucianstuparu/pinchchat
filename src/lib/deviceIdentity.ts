/**
 * Device identity management for OpenClaw 2026.2.14+ device pairing.
 *
 * Generates an Ed25519 keypair via Web Crypto API, persists it in IndexedDB,
 * and provides signing utilities for the gateway connect handshake.
 */

const DB_NAME = 'pinchchat_device';
const DB_VERSION = 1;
const STORE_NAME = 'identity';
const IDENTITY_KEY = 'device';

export interface DeviceIdentity {
  id: string;           // SHA-256 hex fingerprint of the raw public key
  publicKeyRaw: string; // base64url-encoded raw 32-byte public key
  keyPair: CryptoKeyPair;
}

// ── IndexedDB helpers ──────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet<T>(db: IDBDatabase, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(db: IDBDatabase, key: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ── Encoding helpers ───────────────────────────────────────────────

function bufToBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ── Key generation & fingerprinting ────────────────────────────────

async function generateKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']) as Promise<CryptoKeyPair>;
}

/**
 * Extract the raw 32-byte public key from a CryptoKey.
 * SPKI for Ed25519 is a fixed 12-byte prefix + 32 bytes of key material.
 */
async function exportPublicKeyRaw(key: CryptoKey): Promise<ArrayBuffer> {
  const spki = await crypto.subtle.exportKey('spki', key);
  // Ed25519 SPKI = 12-byte prefix + 32-byte raw key
  return spki.slice(12);
}

async function fingerprintKey(key: CryptoKey): Promise<string> {
  const raw = await exportPublicKeyRaw(key);
  const hash = await crypto.subtle.digest('SHA-256', raw);
  return bufToHex(hash);
}

// ── Persisted format (serialisable for IndexedDB) ──────────────────

interface StoredIdentity {
  version: 1;
  deviceId: string;
  publicKeyRaw: string;  // base64url
  jwkPublic: JsonWebKey;
  jwkPrivate: JsonWebKey;
}

// ── Public API ─────────────────────────────────────────────────────

/**
 * Load or create the device identity.
 * The keypair is persisted in IndexedDB so it survives page reloads.
 */
export async function getOrCreateDeviceIdentity(): Promise<DeviceIdentity> {
  const db = await openDB();

  // Try loading existing identity
  const stored = await idbGet<StoredIdentity>(db, IDENTITY_KEY);
  if (stored?.version === 1) {
    try {
      const privateKey = await crypto.subtle.importKey(
        'jwk', stored.jwkPrivate, { name: 'Ed25519' }, true, ['sign'],
      );
      const publicKey = await crypto.subtle.importKey(
        'jwk', stored.jwkPublic, { name: 'Ed25519' }, true, ['verify'],
      );
      db.close();
      return {
        id: stored.deviceId,
        publicKeyRaw: stored.publicKeyRaw,
        keyPair: { privateKey, publicKey },
      };
    } catch {
      // Corrupted — regenerate below
    }
  }

  // Generate new identity
  const keyPair = await generateKeyPair();
  const raw = await exportPublicKeyRaw(keyPair.publicKey);
  const publicKeyRaw = bufToBase64Url(raw);
  const deviceId = await fingerprintKey(keyPair.publicKey);
  const jwkPublic = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  const jwkPrivate = await crypto.subtle.exportKey('jwk', keyPair.privateKey);

  const record: StoredIdentity = {
    version: 1,
    deviceId,
    publicKeyRaw,
    jwkPublic,
    jwkPrivate,
  };
  await idbPut(db, IDENTITY_KEY, record);
  db.close();

  return { id: deviceId, publicKeyRaw, keyPair };
}

// ── Signing ────────────────────────────────────────────────────────

/**
 * Build the canonical payload string that the gateway expects to verify.
 * Must match OpenClaw's `buildDeviceAuthPayload` exactly.
 */
export function buildDeviceAuthPayload(params: {
  deviceId: string;
  clientId: string;
  clientMode: string;
  role: string;
  scopes: string[];
  signedAtMs: number;
  token: string | null;
  nonce?: string | null;
}): string {
  const version = params.nonce ? 'v2' : 'v1';
  const scopes = params.scopes.join(',');
  const token = params.token ?? '';
  const base = [
    version,
    params.deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    scopes,
    String(params.signedAtMs),
    token,
  ];
  if (version === 'v2') base.push(params.nonce ?? '');
  return base.join('|');
}

/**
 * Sign a payload string with the device's Ed25519 private key.
 * Returns a base64url-encoded signature.
 */
export async function signPayload(
  privateKey: CryptoKey,
  payload: string,
): Promise<string> {
  const data = new TextEncoder().encode(payload);
  const sig = await crypto.subtle.sign('Ed25519', privateKey, data);
  return bufToBase64Url(sig);
}
