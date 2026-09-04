/* ==========================================================================
   Key store — the ONLY module that touches IndexedDB.

   The Groq API key lives here so it never reaches Convex, localStorage,
   or server logs. Components only know about presence via the settings
   hook; the AI service reads the key at call time.
   ========================================================================== */

const DB_NAME = "freebuff";
const DB_VERSION = 1;
const STORE = "secrets";
const KEY_NAME = "groq_api_key";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    const request = fn(store);
    const done = txDone(tx);
    const result = request
      ? await new Promise<T>((resolve, reject) => {
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        })
      : undefined;
    await done;
    return result;
  } finally {
    db.close();
  }
}

export const keyStore = {
  async get(): Promise<string | null> {
    if (typeof indexedDB === "undefined") return null;
    const value = await withStore<string>("readonly", (s) => s.get(KEY_NAME));
    return typeof value === "string" && value.length > 0 ? value : null;
  },

  async set(value: string): Promise<void> {
    if (typeof indexedDB === "undefined") return;
    await withStore("readwrite", (s) => s.put(value, KEY_NAME));
  },

  async remove(): Promise<void> {
    if (typeof indexedDB === "undefined") return;
    await withStore("readwrite", (s) => s.delete(KEY_NAME));
  },

  async has(): Promise<boolean> {
    return (await this.get()) !== null;
  },
};
