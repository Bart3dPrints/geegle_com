// Time & Date preferences for the optional clock and date widgets.
//
// Every value is an IANA zone name, so daylight saving time is applied by the
// browser's own Intl data instead of a fixed offset. The default is
// America/New_York; "auto" follows the browser's configured zone, which needs no
// location permission and no Google service.

export const DEFAULT_TIME_ZONE = 'America/New_York';
export const AUTO_TIME_ZONE = 'auto';

export interface TimeSettings {
  /** 12-hour clock when true, 24-hour when false. */
  hour12: boolean;
  /** An IANA zone name, or AUTO_TIME_ZONE for the browser's zone. */
  timeZone: string;
}

export const DEFAULT_TIME_SETTINGS: TimeSettings = {
  hour12: true,
  timeZone: DEFAULT_TIME_ZONE,
};

/** Zones offered in Settings; any valid IANA zone is still accepted when stored. */
export const TIME_ZONE_OPTIONS: { value: string; label: string }[] = [
  { value: DEFAULT_TIME_ZONE, label: 'Eastern Time (America/New_York)' },
  { value: 'America/Chicago', label: 'Central Time (America/Chicago)' },
  { value: 'America/Denver', label: 'Mountain Time (America/Denver)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (America/Los_Angeles)' },
  { value: 'America/Anchorage', label: 'Alaska Time (America/Anchorage)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (Pacific/Honolulu)' },
  { value: 'America/Toronto', label: 'Toronto (America/Toronto)' },
  { value: 'America/Sao_Paulo', label: 'São Paulo (America/Sao_Paulo)' },
  { value: 'UTC', label: 'UTC' },
  { value: 'Europe/London', label: 'London (Europe/London)' },
  { value: 'Europe/Paris', label: 'Paris (Europe/Paris)' },
  { value: 'Europe/Berlin', label: 'Berlin (Europe/Berlin)' },
  { value: 'Africa/Cairo', label: 'Cairo (Africa/Cairo)' },
  { value: 'Asia/Jerusalem', label: 'Jerusalem (Asia/Jerusalem)' },
  { value: 'Asia/Dubai', label: 'Dubai (Asia/Dubai)' },
  { value: 'Asia/Kolkata', label: 'Kolkata (Asia/Kolkata)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (Asia/Shanghai)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (Asia/Tokyo)' },
  { value: 'Australia/Sydney', label: 'Sydney (Australia/Sydney)' },
  { value: 'Pacific/Auckland', label: 'Auckland (Pacific/Auckland)' },
];

/** A zone is usable only when Intl accepts it; never guess an offset. */
export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > 64) return false;
  if (!/^[A-Za-z][A-Za-z0-9_+\-/]*$/.test(value)) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** The browser's configured zone, used only when the preference is automatic. */
export function browserTimeZone(): string {
  try {
    const zone = new Intl.DateTimeFormat().resolvedOptions().timeZone;
    return isValidTimeZone(zone) ? zone : DEFAULT_TIME_ZONE;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

export function parseTimeSettings(value: unknown): TimeSettings {
  const record =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const timeZone =
    record.timeZone === AUTO_TIME_ZONE || isValidTimeZone(record.timeZone)
      ? (record.timeZone as string)
      : DEFAULT_TIME_SETTINGS.timeZone;
  return {
    hour12: record.hour12 !== false,
    timeZone,
  };
}

/** The zone actually used for display, with a safe fallback. */
export function resolveTimeZone(settings: Pick<TimeSettings, 'timeZone'>): string {
  return settings.timeZone === AUTO_TIME_ZONE
    ? browserTimeZone()
    : isValidTimeZone(settings.timeZone)
      ? settings.timeZone
      : DEFAULT_TIME_ZONE;
}

export function formatClock(date: Date, settings: TimeSettings): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: settings.hour12,
    timeZone: resolveTimeZone(settings),
  }).format(date);
}

export function formatDate(date: Date, settings: Pick<TimeSettings, 'timeZone'>): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: resolveTimeZone(settings),
  }).format(date);
}

/** A readable zone label for Settings, including the current abbreviation. */
export function describeTimeZone(settings: TimeSettings, date = new Date()): string {
  const zone = resolveTimeZone(settings);
  if (!isValidTimeZone(zone)) return zone;
  try {
    const short = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'short' })
      .formatToParts(date)
      .find((part) => part.type === 'timeZoneName')?.value;
    return short ? `${zone} (${short})` : zone;
  } catch {
    return zone;
  }
}
