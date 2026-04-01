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

// Fix Uint8Array deep equality in jsdom (crypto.subtle returns cross-realm buffers)
expect.addEqualityTesters([
  function uint8ArrayEquality(a: unknown, b: unknown): boolean | undefined {
    if (a instanceof Uint8Array && b instanceof Uint8Array) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
      }
      return true;
    }
    // Also handle cross-realm Uint8Array (jsdom crypto.subtle)
    if (
      a && b &&
      typeof a === 'object' && typeof b === 'object' &&
      'length' in a && 'length' in b && 'buffer' in a && 'buffer' in b &&
      (a.constructor?.name === 'Uint8Array' || Object.prototype.toString.call(a) === '[object Uint8Array]') &&
      (b.constructor?.name === 'Uint8Array' || Object.prototype.toString.call(b) === '[object Uint8Array]')
    ) {
      const ua = a as Uint8Array;
      const ub = b as Uint8Array;
      if (ua.length !== ub.length) return false;
      for (let i = 0; i < ua.length; i++) {
        if (ua[i] !== ub[i]) return false;
      }
      return true;
    }
    return undefined; // fall through to default equality
  }
]);
