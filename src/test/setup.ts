import '@testing-library/jest-dom/vitest';
import { beforeEach } from 'vitest';

function createStorageMock(): Storage {
  let store = new Map<string, string>();

  return {
    get length() {
      return store.size;
    },
    clear() {
      store = new Map<string, string>();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    }
  };
}

function hasUsableStorage(storage: unknown): storage is Storage {
  return (
    typeof storage === 'object' &&
    storage !== null &&
    typeof (storage as Storage).clear === 'function' &&
    typeof (storage as Storage).getItem === 'function' &&
    typeof (storage as Storage).setItem === 'function'
  );
}

function installStorageMock(name: 'localStorage' | 'sessionStorage') {
  const storage = createStorageMock();

  Object.defineProperty(globalThis, name, {
    value: storage,
    configurable: true
  });

  if (typeof window !== 'undefined') {
    Object.defineProperty(window, name, {
      value: storage,
      configurable: true
    });
  }
}

if (!hasUsableStorage(globalThis.localStorage)) {
  installStorageMock('localStorage');
}

if (!hasUsableStorage(globalThis.sessionStorage)) {
  installStorageMock('sessionStorage');
}

beforeEach(() => {
  if (!hasUsableStorage(globalThis.localStorage)) {
    installStorageMock('localStorage');
  }

  if (!hasUsableStorage(globalThis.sessionStorage)) {
    installStorageMock('sessionStorage');
  }

  globalThis.localStorage.clear();
  globalThis.sessionStorage.clear();
});

// Radix UI Tooltip uses ResizeObserver internally (via @radix-ui/react-use-size).
// jsdom doesn't provide it natively — stub it so Tooltip doesn't crash in tests.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
