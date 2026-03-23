/**
 * IndexedDB wrappers for persistent data storage
 * Provides simple get/set/getAll/clear operations for app data
 */

// Database schema constants
export const DB = "BabyBloomDB";
export const DV = 2; // Database version
export const ST = "appdata"; // Object store name

/**
 * Open or create the IndexedDB database
 * Initializes the object store if needed
 */
export function odb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const q = indexedDB.open(DB, DV);

    q.onupgradeneeded = (e: IDBVersionChangeEvent) => {
      const d = (e.target as IDBOpenDBRequest).result;
      if (!d.objectStoreNames.contains(ST)) {
        d.createObjectStore(ST, { keyPath: "key" });
      }
    };

    q.onsuccess = (e: Event) => {
      resolve((e.target as IDBOpenDBRequest).result);
    };

    q.onerror = (e: Event) => {
      reject((e.target as IDBOpenDBRequest).error);
    };
  });
}

/**
 * Get a single value from the database
 * @param k The key to retrieve
 * @returns The stored value, or undefined if not found
 */
export function dg(k: string): Promise<any> {
  return odb()
    .then((d) => {
      return new Promise((r) => {
        const t = d.transaction(ST, "readonly");
        const q = t.objectStore(ST).get(k);

        q.onsuccess = () => {
          r(q.result ? q.result.value : undefined);
        };

        q.onerror = () => {
          r(undefined);
        };
      });
    })
    .catch(() => undefined);
}

/**
 * Set a value in the database
 * @param k The key to store under
 * @param v The value to store
 */
export function ds(k: string, v: any): Promise<void> {
  return odb()
    .then((d) => {
      return new Promise<void>((r, j) => {
        const t = d.transaction(ST, "readwrite");
        t.objectStore(ST).put({ key: k, value: v });

        t.oncomplete = () => {
          r();
        };

        t.onerror = () => {
          j();
        };
      });
    })
    .catch(() => {});
}

/**
 * Get all values from the database
 * @returns Object mapping keys to values
 */
export function dga(): Promise<{ [key: string]: any }> {
  return odb()
    .then((d) => {
      return new Promise<{ [key: string]: any }>((r) => {
        const t = d.transaction(ST, "readonly");
        const q = t.objectStore(ST).getAll();

        q.onsuccess = () => {
          const o: { [key: string]: any } = {};
          (q.result || []).forEach((x: any) => {
            o[x.key] = x.value;
          });
          r(o);
        };

        q.onerror = () => {
          r({});
        };
      });
    })
    .catch(() => ({}));
}

/**
 * Clear all data from the database
 */
export function dcl(): Promise<void> {
  return odb()
    .then((d) => {
      return new Promise<void>((r) => {
        const t = d.transaction(ST, "readwrite");
        t.objectStore(ST).clear();

        t.oncomplete = () => {
          r();
        };
      });
    })
    .catch(() => {});
}

/**
 * Request persistent storage if available
 * Prevents browser from clearing data
 */
export function requestPersistentStorage(): void {
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist();
  }
}
