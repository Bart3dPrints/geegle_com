// Informational notice shown when the library opens. It is not an
// authentication gate: the library is already rendered underneath. The
// checkbox is unchecked every time the notice is shown; only an explicit opt-in
// suppresses it permanently.

import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';

export const LIBRARY_NOTICE_TEXT = 'Please wait if you see nothing upon clicking on a Game/Proxy.';
export const LIBRARY_NOTICE_CHECKBOX = "Don't remind me again";
export const LIBRARY_NOTICE_BUTTON = 'Got it';

export function LibraryNotice({
  onDismiss,
  onDismissForever,
}: {
  /** Closes the notice for this visit only. */
  onDismiss: () => void;
  /** Persists the dismissal for this browser/account. */
  onDismissForever: () => void;
}) {
  const [remember, setRemember] = useState(false);
  const reduceMotion = useReducedMotion();
  const dialogRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    buttonRef.current?.focus();
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onDismiss();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, input, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, [onDismiss]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/50 p-4">
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="library-notice-text"
        className="card w-full max-w-md p-6"
        initial={reduceMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 6 }}
        transition={{ duration: reduceMotion ? 0 : 0.16, ease: 'easeOut' }}
      >
        <p id="library-notice-text" className="mb-5 text-sm">
          {LIBRARY_NOTICE_TEXT}
        </p>
        <label className="mb-5 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
          />
          {LIBRARY_NOTICE_CHECKBOX}
        </label>
        <div className="flex justify-end">
          <button
            ref={buttonRef}
            className="btn-primary"
            onClick={() => (remember ? onDismissForever() : onDismiss())}
          >
            {LIBRARY_NOTICE_BUTTON}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
