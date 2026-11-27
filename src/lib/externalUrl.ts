// Normalization for the external destinations Geegle opens.
//
// Every permitted external address ends up with exactly one https:// scheme.
// A bare hostname gains one, an http:// address is upgraded, and an address
// that already carries a scheme is never prefixed again. Relative paths served
// by this application (for example /games/wrapper.html) stay relative, and
// unsupported protocols are rejected instead of rewritten.

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const HTTPS_SCHEMES = /^(?:https?:\/\/)/i;
const BLOCKED_PROTOCOLS = ['javascript:', 'data:', 'file:', 'blob:', 'vbscript:', 'mailto:'];

/**
 * Returns a safe absolute https URL, a safe relative path, or null when the
 * input is malformed or uses an unsupported protocol.
 */
export function normalizeExternalUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // A path this application serves: keep it relative.
  if (trimmed.startsWith('/')) {
    if (trimmed.startsWith('//')) return null; // protocol-relative, not supported
    if (/[\s"'<>\\]/.test(trimmed)) return null;
    return trimmed;
  }

  if (BLOCKED_PROTOCOLS.some((protocol) => trimmed.toLowerCase().startsWith(protocol))) {
    return null;
  }

  const hasScheme = SCHEME.test(trimmed);
  if (hasScheme && !/^https?:/i.test(trimmed)) return null;

  // A second scheme in the same address means a malformed, doubled URL.
  const schemeCount = trimmed.match(/https?:\/\//gi)?.length ?? 0;
  if (schemeCount > 1) return null;

  const candidate = hasScheme ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (!url.hostname || url.hostname.includes(' ')) return null;
  if (url.username || url.password) return null;

  url.protocol = 'https:';
  return url.href;
}

/** True when the address carries exactly one https:// scheme and nothing else. */
export function isSingleHttpsUrl(value: string): boolean {
  if (!HTTPS_SCHEMES.test(value)) return false;
  if (!/^https:\/\//i.test(value)) return false;
  return (value.match(/https?:\/\//gi)?.length ?? 0) === 1;
}

/** Hostname for display, or an empty string when the address is not usable. */
export function externalHost(input: string): string {
  const normalized = normalizeExternalUrl(input);
  if (!normalized || normalized.startsWith('/')) return '';
  try {
    return new URL(normalized).host;
  } catch {
    return '';
  }
}
