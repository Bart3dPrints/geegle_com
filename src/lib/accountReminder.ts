// The guest account reminder appears once per browsing session. Session
// storage is deliberate: a new tab session may ask again, but a guest who has
// chosen "Continue as guest" is never interrupted again in that session.

export const ACCOUNT_REMINDER_KEY = 'geegle-account-reminder-dismissed';

type ReminderStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

function sessionStorageSafe(): ReminderStorage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    // Storage can be blocked by browser settings; gameplay must still work.
    return null;
  }
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
