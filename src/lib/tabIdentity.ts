// Optional, transparent tab identity: a user-owned page title and icon.
//
// The defaults are Geegle's own title and circular favicon. Nothing here can
// imitate another service: the title must contain text, and the icon has to be
// a small raster image the user picked. Settings are stored locally while
// signed out and synced per account when signed in.

export interface TabIdentity {
  title: string;
  icon: string | null;
}

export const DEFAULT_TAB_IDENTITY: TabIdentity = { title: 'Geegle', icon: null };
export const TAB_TITLE_MAX = 60;
export const TAB_ICON_MAX_BYTES = 200 * 1024;
export const TAB_IDENTITY_TITLE_KEY = 'geegle-tab-title';
export const TAB_IDENTITY_ICON_KEY = 'geegle-tab-icon';
const DEFAULT_ICON = '/favicon.svg';
const ICON_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export function validateTabIdentity(value: TabIdentity): string | null {
  const title = value.title.trim();
  if (!title) return 'Enter a page title.';
  if (title.length > TAB_TITLE_MAX) return `Keep the title to ${TAB_TITLE_MAX} characters or fewer.`;
  if (value.icon) {
    if (!ICON_TYPES.some((type) => value.icon!.startsWith(`data:${type}`))) {
      return 'Choose a PNG, JPEG or WebP image.';
    }
    // Base64 inflates by 4/3; this keeps the stored icon under the size limit.
    const bytes = Math.ceil((value.icon.length - value.icon.indexOf(',') - 1) * 0.75);
    if (bytes > TAB_ICON_MAX_BYTES) return 'Keep the icon under 200 KB.';
  }
  return null;
}

export function applyTabIdentity(value: TabIdentity): void {
  document.title = value.title.trim() || DEFAULT_TAB_IDENTITY.title;
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.type = value.icon ? value.icon.slice(5, value.icon.indexOf(';')) : 'image/svg+xml';
  link.href = value.icon ?? DEFAULT_ICON;
}

export function readTabIdentityLocal(): TabIdentity {
  try {
    const title = localStorage.getItem(TAB_IDENTITY_TITLE_KEY);
    const icon = localStorage.getItem(TAB_IDENTITY_ICON_KEY);
    const value: TabIdentity = { title: title || DEFAULT_TAB_IDENTITY.title, icon: icon || null };
    return validateTabIdentity(value) ? DEFAULT_TAB_IDENTITY : value;
  } catch {
    return DEFAULT_TAB_IDENTITY;
  }
}

export function writeTabIdentityLocal(value: TabIdentity): void {
  try {
    if (value.title.trim() === DEFAULT_TAB_IDENTITY.title && !value.icon) {
      localStorage.removeItem(TAB_IDENTITY_TITLE_KEY);
      localStorage.removeItem(TAB_IDENTITY_ICON_KEY);
      return;
    }
    localStorage.setItem(TAB_IDENTITY_TITLE_KEY, value.title);
    if (value.icon) localStorage.setItem(TAB_IDENTITY_ICON_KEY, value.icon);
    else localStorage.removeItem(TAB_IDENTITY_ICON_KEY);
  } catch {
    // Storage can be unavailable; the in-memory identity still applies.
  }
}
