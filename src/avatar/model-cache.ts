/**
 * Moduł cache'owania modeli 3D w IndexedDB z fallbackiem pamięciowym (docs/0, PROD-01)
 */
export class ModelCache {
  private dbName = 'avatar_3d_cache_db';
  private storeName = 'models';
  private db: IDBDatabase | null = null;
  private memoryFallback = new Map<string, ArrayBuffer>();

  private async openDb(): Promise<IDBDatabase | null> {
    if (this.db) return this.db;

    if (typeof window === 'undefined' || !window.indexedDB) {
      return null;
    }

    return new Promise((resolve) => {
      try {
        const request = window.indexedDB.open(this.dbName, 1);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(this.storeName)) {
            db.createObjectStore(this.storeName);
          }
        };

        request.onsuccess = (event) => {
          this.db = (event.target as IDBOpenDBRequest).result;
          resolve(this.db);
        };

        request.onerror = () => {
          resolve(null);
        };
      } catch {
        resolve(null);
      }
    });
  }

  public async putModel(key: string, buffer: ArrayBuffer): Promise<void> {
    this.memoryFallback.set(key, buffer);

    const db = await this.openDb();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        store.put(buffer, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  public async getModel(key: string): Promise<ArrayBuffer | null> {
    const memory = this.memoryFallback.get(key);
    if (memory) return memory;

    const db = await this.openDb();
    if (!db) return null;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(this.storeName, 'readonly');
        const store = tx.objectStore(this.storeName);
        const req = store.get(key);

        req.onsuccess = () => {
          const result = req.result as ArrayBuffer | undefined;
          if (result) {
            this.memoryFallback.set(key, result);
            resolve(result);
          } else {
            resolve(null);
          }
        };

        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  public async hasModel(key: string): Promise<boolean> {
    if (this.memoryFallback.has(key)) return true;
    const model = await this.getModel(key);
    return model !== null;
  }

  public async clearCache(): Promise<void> {
    this.memoryFallback.clear();
    const db = await this.openDb();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        store.clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }
}
