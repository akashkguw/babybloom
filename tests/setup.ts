import { expect, afterEach, vi } from 'vitest';

// Mock IndexedDB
class MockIndexedDB {
  private stores: Map<string, Map<string, unknown>> = new Map();

  open(): IDBOpenDBRequest {
    const request = new EventTarget() as IDBOpenDBRequest;
    const mockDB = {
      createObjectStore: (name: string) => ({
        add: vi.fn(),
        get: vi.fn(),
        delete: vi.fn(),
        clear: vi.fn()
      })
    };

    setTimeout(() => {
      const event = new Event('success');
      Object.defineProperty(event, 'target', {
        value: { result: mockDB },
        enumerable: true
      });
      request.dispatchEvent(event);
    }, 0);

    return request;
  }

  deleteDatabase(): IDBOpenDBRequest {
    const request = new EventTarget() as IDBOpenDBRequest;

    setTimeout(() => {
      const event = new Event('success');
      request.dispatchEvent(event);
    }, 0);

    return request;
  }
}

if (!globalThis.indexedDB) {
  globalThis.indexedDB = new MockIndexedDB() as any;
}

// Cleanup after each test
afterEach(() => {
  vi.clearAllMocks();
});
