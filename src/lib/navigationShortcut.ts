// Configurable one-key navigation shortcut. It performs ordinary browser
// navigation to the configured destination; it never rewrites history, origin
// or any security indicator.

export interface NavigationShortcut {
  enabled: boolean;
  key: string;
  destination: string;
}

export const DEFAULT_SHORTCUT: NavigationShortcut = {
  enabled: true,
  key: '\\',
  destination: 'https://manhasset.instructure.com/',
};

export const SHORTCUT_STORAGE_KEY = 'geegle-navigation-shortcut';

/** Keys that would fight with ordinary browser or game controls. */
const RESERVED_KEYS = new Set([
  'Tab', 'Enter', 'Escape', 'Backspace', 'Delete', 'Insert', 'Home', 'End',
  'PageUp', 'PageDown', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'ContextMenu', ' ',
]);

export function isAllowedShortcutKey(key: string): boolean {
  return key.length === 1 && !RESERVED_KEYS.has(key) && !/[a-z0-9]/i.test(key);
}

/** Only ordinary https destinations are accepted. */
export function parseDestination(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const host = trimmed.replace(/^https?:\/\//i, '');
  // A duplicated or non-http scheme is malformed, never silently repaired.
  if (!host || /^[a-z][\w+.-]*:/i.test(host)) return null;
  const candidate = `https://${host}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'https:') return null;
    if (!url.hostname.includes('.')) return null;
    if (url.username || url.password) return null;
    return `${url.origin}${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export function parseShortcut(value: unknown): NavigationShortcut {
  if (!value || typeof value !== 'object') return { ...DEFAULT_SHORTCUT };
  const record = value as Record<string, unknown>;
  const key = typeof record.key === 'string' && isAllowedShortcutKey(record.key)
    ? record.key
    : DEFAULT_SHORTCUT.key;
  const destination = typeof record.destination === 'string'
    ? parseDestination(record.destination)
    : null;
  return {
    enabled: record.enabled !== false,
    key,
    destination: destination ?? DEFAULT_SHORTCUT.destination,
  };
}

export function readShortcutLocal(): NavigationShortcut {
  try {
    const raw = localStorage.getItem(SHORTCUT_STORAGE_KEY);
    return parseShortcut(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...DEFAULT_SHORTCUT };
  }
}

export function writeShortcutLocal(value: NavigationShortcut): void {
  try {
    localStorage.setItem(SHORTCUT_STORAGE_KEY, JSON.stringify(value));
  } catch {
    /* Storage may be disabled; the in-memory value still applies. */
  }
}

/** True when focus is inside a control that must receive the key itself. */
export function isEditableTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return false;
  const tag = element.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  return element.isContentEditable;
}

/** Match an event against the configured key, never swallowing modifiers. */
export function shortcutMatches(event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey'>, shortcut: NavigationShortcut): boolean {
  if (!shortcut.enabled) return false;
  if (event.ctrlKey || event.metaKey || event.altKey) return false;
  return event.key === shortcut.key;
}
