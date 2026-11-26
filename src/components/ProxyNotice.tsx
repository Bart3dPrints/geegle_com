// Proxy safety notice. Shown on every launch, with no suppression option.
// The destination is not opened until the user confirms, and Cancel returns
// to the library without navigating.

import { useEffect, useRef } from 'react';
import { motion } from 'motion/react';

export const PROXY_NOTICE_TEXT =
  'Please ignore and exit out of any pop-ups or redirects from these proxies.';

export function ProxyNotice({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/50 p-4">
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="proxy-notice-text"
        className="card w-full max-w-md p-6"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.16, ease: 'easeOut' }}
      >
        <p id="proxy-notice-text" className="mb-5 text-sm">
          {PROXY_NOTICE_TEXT}
        </p>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button ref={confirmRef} className="btn-primary" onClick={onConfirm}>
            Got it
          </button>
        </div>
      </motion.div>
    </div>
  );
}
