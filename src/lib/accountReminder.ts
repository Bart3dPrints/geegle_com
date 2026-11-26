// The guest account reminder appears once per browsing session. Session
// storage is deliberate: a new tab session may ask again, but a guest who has
// chosen "Continue as guest" is never interrupted again in that session.
//
// The dialog's "Don't remind me again" checkbox instead writes a permanent
// preference to localStorage, so it survives reloads, new tabs and browser
// restarts without requiring an account. Completely clearing browser storage
// removes that local preference and the reminder can appear again.

export const ACCOUNT_REMINDER_KEY = 'geegle-account-reminder-dismissed';
export const PERMANENT_REMINDER_KEY = 'geegle-account-reminder-off';

type ReminderStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem?: (key: string) => void;
};

function storageSafe(get: () => Storage): ReminderStorage | null {
  try {
    return get();
  } catch {
    // Storage can be blocked by browser settings; gameplay must still work.
    return null;
  }
}

function sessionStorageSafe(): ReminderStorage | null {
  return typeof sessionStorage === 'undefined'
    ? null
    : storageSafe(() => sessionStorage);
}

function localStorageSafe(): ReminderStorage | null {
  return typeof localStorage === 'undefined' ? null : storageSafe(() => localStorage);
}

export function reminderDismissed(storage: ReminderStorage | null = sessionStorageSafe()): boolean {
  try {
    return storage?.getItem(ACCOUNT_REMINDER_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissReminder(storage: ReminderStorage | null = sessionStorageSafe()): void {
  try {
    storage?.setItem(ACCOUNT_REMINDER_KEY, '1');
  } catch {
    // Nothing to do: the reminder simply may appear again next launch.
  }
}

export function reminderDismissedPermanently(
  storage: ReminderStorage | null = localStorageSafe()
): boolean {
  try {
    return storage?.getItem(PERMANENT_REMINDER_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissReminderPermanently(
  storage: ReminderStorage | null = localStorageSafe()
): void {
  try {
    storage?.setItem(PERMANENT_REMINDER_KEY, '1');
  } catch {
    // Nothing to do: the visitor still gets the per-session behaviour.
  }
}

/** True when either the session flag or the permanent preference is set. */
export function reminderSuppressed(
  session: ReminderStorage | null = sessionStorageSafe(),
  permanent: ReminderStorage | null = localStorageSafe()
): boolean {
  return reminderDismissed(session) || reminderDismissedPermanently(permanent);
}

/** Settings action: clears both flags so a guest can be reminded again. */
export function resetReminder(
  session: ReminderStorage | null = sessionStorageSafe(),
  permanent: ReminderStorage | null = localStorageSafe()
): void {
  try {
    session?.removeItem?.(ACCOUNT_REMINDER_KEY);
  } catch {
    // Ignore: the session flag expires on its own.
  }
  try {
    permanent?.removeItem?.(PERMANENT_REMINDER_KEY);
  } catch {
    // Ignore: the caller reports the visible state instead.
  }
}

/**
 * Whether a launch should pause for the reminder. Signed-in visitors never see
 * it, and external proxies keep their own safety notice instead.
 */
export function shouldShowAccountReminder({
  signedIn,
  dismissed,
  isProxy = false,
}: {
  signedIn: boolean;
  dismissed: boolean;
  isProxy?: boolean;
}): boolean {
  return !signedIn && !dismissed && !isProxy;
}
