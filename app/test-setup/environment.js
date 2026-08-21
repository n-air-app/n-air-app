const { TextDecoder, TextEncoder } = require('node:util');

if (typeof globalThis.TextDecoder === 'undefined') globalThis.TextDecoder = TextDecoder;
if (typeof globalThis.TextEncoder === 'undefined') globalThis.TextEncoder = TextEncoder;
if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;
if (typeof globalThis.window.confirm === 'undefined') globalThis.window.confirm = () => false;
if (typeof globalThis.window.require === 'undefined') globalThis.window.require = require;

if (typeof globalThis.localStorage === 'undefined') {
  const storage = new Map();
  globalThis.localStorage = {
    clear: () => {
      storage.clear();
    },
    getItem: (key) => storage.get(key) ?? null,
    key: (index) => [...storage.keys()][index] ?? null,
    removeItem: (key) => {
      storage.delete(key);
    },
    setItem: (key, value) => {
      storage.set(key, String(value));
    },
    get length() {
      return storage.size;
    },
  };
}
