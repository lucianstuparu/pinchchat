/**
 * IndexedDB-based message cache for preserving chat history across compactions.
 * When the gateway compacts a session, older messages disappear from the API.
 * This cache retains them locally so users can still scroll back.
 */

import type { ChatMessage } from '../types';

const DB_NAME = 'pinchchat-messages';
const DB_VERSION = 1;
const STORE_NAME = 'messages';

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

/**
 * Get cached messages for a session.
 */
export async function getCachedMessages(sessionKey: string): Promise<ChatMessage[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(sessionKey);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

/**
 * Store messages for a session (full replacement).
 */
export async function setCachedMessages(sessionKey: string, messages: ChatMessage[]): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(messages, sessionKey);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Silently ignore cache write failures
  }
}

/**
 * Merge gateway messages with cached messages.
 * If compaction occurred (cached has older messages not in gateway response),
 * returns the full history with a compaction separator inserted.
 *
 * Returns { messages, wasCompacted }.
 */
export function mergeWithCache(
  gatewayMessages: ChatMessage[],
  cachedMessages: ChatMessage[],
): { messages: ChatMessage[]; wasCompacted: boolean } {
  if (cachedMessages.length === 0) {
    return { messages: gatewayMessages, wasCompacted: false };
  }

  // Find the earliest gateway message ID to detect overlap
  const gatewayIds = new Set(gatewayMessages.map(m => m.id));

  // Find cached messages that are NOT in the gateway response
  // These are messages that were compacted away
  const missingFromGateway = cachedMessages.filter(m => !gatewayIds.has(m.id));

  if (missingFromGateway.length === 0) {
    // No compaction — gateway has all messages (or more)
    return { messages: gatewayMessages, wasCompacted: false };
  }

  // Compaction detected — merge old cached messages + separator + gateway messages
  // Mark old messages so UI can style them differently
  const archivedMessages = missingFromGateway.map(m => ({
    ...m,
    isArchived: true,
  }));

  // Insert a compaction separator
  const separator: ChatMessage = {
    id: 'compaction-separator-' + Date.now(),
    role: 'assistant' as const,
    content: '',
    timestamp: gatewayMessages.length > 0
      ? gatewayMessages[0].timestamp - 1
      : Date.now(),
    blocks: [],
    isCompactionSeparator: true,
  };

  return {
    messages: [...archivedMessages, separator, ...gatewayMessages],
    wasCompacted: true,
  };
}
