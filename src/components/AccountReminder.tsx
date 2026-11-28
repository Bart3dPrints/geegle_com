// One-time guest reminder. It is not a gate: the library stays rendered, and
// the chosen destination is kept until the visitor signs in, creates an
// account or continues as a guest.

import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';

export const ACCOUNT_REMINDER_TITLE = 'Save your progress';
export const ACCOUNT_REMINDER_TEXT =
  'Sign in or create an account to keep supported game progress and preferences across devices. Guest progress may be lost when browser data is cleared.';

export function AccountReminder({
  onSignIn,
  onCreateAccount,
  onContinueAsGuest,
  onDismiss,
}: {
  onSignIn: () => void;
  onCreateAccount: () => void;
  /** `permanent` is true when the visitor checked "Don't remind me again". */
  onContinueAsGuest: (permanent: boolean) => void;
  /** Closes without launching; the visitor can try again later. */
  onDismiss: () => void;
}) {
  const guestRef = useRef<HTMLButtonElement>(null);
  const [permanent, setPermanent] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    guestRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onDismiss();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onDismiss]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/50 p-4">
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-reminder-title"
        aria-describedby="account-reminder-text"
        className="card w-full max-w-md p-6"
        initial={reduceMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 6 }}
        transition={{ duration: reduceMotion ? 0 : 0.16, ease: 'easeOut' }}
      >
        <h2 id="account-reminder-title" className="mb-2">
          {ACCOUNT_REMINDER_TITLE}
        </h2>
        <p id="account-reminder-text" className="mb-4 text-sm text-neutral-600">
          {ACCOUNT_REMINDER_TEXT}
        </p>
        <label className="mb-5 flex items-center gap-2 text-sm text-neutral-600">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={permanent}
            onChange={(event) => setPermanent(event.target.checked)}
          />
          Don't remind me again
        </label>
        <div className="flex flex-wrap justify-end gap-2">
          <button className="btn-secondary" onClick={() => onContinueAsGuest(permanent)} ref={guestRef}>
            Continue as guest
          </button>
          <button className="btn-secondary" onClick={onCreateAccount}>
            Create account
          </button>
          <button className="btn-primary" onClick={onSignIn}>
            Sign in
          </button>
        </div>
      </motion.div>
    </div>
  );
}
