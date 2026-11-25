// Same-origin game frames can read the platform page's storage through
// `parent.localStorage`. The storage shim only protects documents it runs in,
// so the platform page itself must stop exposing its own session.
//
// At startup we capture the real Storage object for Geegle's own use (the
// Supabase client keeps a private reference to it), then replace
// `window.localStorage`/`window.sessionStorage` with a view that hides
// platform-owned keys. Game frames asking `parent.localStorage` for a session
// token now get null, while normal platform state keeps working.
//
// This narrows the exposure; it is not a complete sandbox. Untrusted game code
// still runs on the same origin and can interact with the app, so a real
// boundary needs games served from a separate origin (documented in
// PROJECT_COMPLETION.md).

/** Keys that must never be visible to game documents. */
const SENSITIVE_KEY = [
  /^geegle-auth-session$/, // Supabase session (access + refresh tokens)
  /^sb-.*-auth-token$/, // Supabase's own default key, in case of a version change
  /^geegle-auth-/, // any future auth artefact
];

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY.some((pattern) => pattern.test(key));
}

/**
 * A Storage-shaped view over `real` that omits sensitive keys from reads,
 * writes, deletes, enumeration and `clear()`.
 */
export function createRedactingStorage(real: Storage): Storage {
  const visibleKeys = (): string[] => {
    const keys: string[] = [];
    for (let index = 0; index < real.length; index += 1) {
      const key = real.key(index);
      if (key !== null && !isSensitiveKey(key)) keys.push(key);
    }
    return keys;
  };

  const facade = {
    get length() {
      return visibleKeys().length;
    },
    key(index: number) {
      return visibleKeys()[index] ?? null;
    },
    getItem(key: string) {
      return typeof key === 'string' && !isSensitiveKey(key) ? real.getItem(key) : null;
    },
    setItem(key: string, value: string) {
      if (typeof key === 'string' && !isSensitiveKey(key)) real.setItem(key, value);
    },
    removeItem(key: string) {
      if (typeof key === 'string' && !isSensitiveKey(key)) real.removeItem(key);
    },
    clear() {
      for (const key of visibleKeys()) real.removeItem(key);
    },
  };

  return new Proxy(facade as unknown as Storage, {
    get(target, prop, receiver) {
      if (prop === 'length' || prop === 'key' || prop === 'getItem' || prop === 'setItem'
        || prop === 'removeItem' || prop === 'clear') {
        return Reflect.get(target, prop, receiver);
      }
      if (typeof prop !== 'string') return undefined;
      if (isSensitiveKey(prop)) return undefined;
      const value = real.getItem(prop);
      return value === null ? undefined : value;
    },
    set(_target, prop, value) {
      if (typeof prop === 'string' && !isSensitiveKey(prop)) real.setItem(prop, String(value));
      return true;
    },
    has(_target, prop) {
      return typeof prop === 'string' && !isSensitiveKey(prop) && real.getItem(prop) !== null;
    },
    deleteProperty(_target, prop) {
      if (typeof prop === 'string' && !isSensitiveKey(prop)) real.removeItem(prop);
      return true;
    },
    ownKeys() {
      return visibleKeys();
    },
    getOwnPropertyDescriptor(_target, prop) {
      if (typeof prop !== 'string' || isSensitiveKey(prop) || real.getItem(prop) === null) return undefined;
      return { configurable: true, enumerable: true, writable: true, value: real.getItem(prop) ?? undefined };
    },
  });
}

/** The private Storage the platform itself uses. Captured before masking. */
export let platformStorage: Storage | undefined;
export let platformSessionStorage: Storage | undefined;

/**
 * Replace the page's Storage objects with redacting views. Returns true when
 * the guard is active. Safe to call more than once; later calls are no-ops.
 */
let installed = false;

export function installStorageGuard(): boolean {
  if (typeof window === 'undefined' || installed) return installed;
  try {
    const local = window.localStorage;
    const session = window.sessionStorage;
    if (!local || !session) return false;
    // Only capture the raw objects once, so a second call cannot wrap the facade.
    platformStorage ??= local;
    platformSessionStorage ??= session;
    const guarded = createRedactingStorage(platformStorage);
    const guardedSession = createRedactingStorage(platformSessionStorage);
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      enumerable: true,
      get: () => guarded,
    });
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      enumerable: true,
      get: () => guardedSession,
    });
    installed = true;
    return true;
  } catch {
    // Storage can be disabled (privacy modes, sandboxed frames); the app then
    // behaves as it did before the guard.
    return false;
  }
}
