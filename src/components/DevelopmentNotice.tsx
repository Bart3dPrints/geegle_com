// Compact, dismissible development announcement shown inside the library only.

import { motion, useReducedMotion } from 'motion/react';
import { X } from 'lucide-react';
import {
  ANNOUNCEMENT_BODY,
  ANNOUNCEMENT_TITLE,
  FEEDBACK_LABEL,
  FEEDBACK_URL,
} from '../lib/developmentNotice';

export function DevelopmentNotice({ onDismiss }: { onDismiss: () => void }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.section
      aria-label="Development announcement"
      className="card relative mb-6 p-4 pr-10"
      initial={reduceMotion ? false : { opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -4 }}
      transition={{ duration: reduceMotion ? 0 : 0.16, ease: 'easeOut' }}
    >
      <button
        type="button"
        className="absolute right-2 top-2 rounded p-1.5 text-[var(--geegle-muted)] transition-colors hover:bg-neutral-100 hover:text-neutral-900"
        onClick={onDismiss}
        aria-label="Dismiss announcement"
      >
        <X size={15} />
      </button>
      <p className="text-sm font-medium">{ANNOUNCEMENT_TITLE}</p>
      {ANNOUNCEMENT_BODY.map((line) => (
        <p key={line} className="mt-1 text-sm text-neutral-600">
          {line}
        </p>
      ))}
      <a
        className="btn-primary mt-3 inline-flex"
        href={FEEDBACK_URL}
        target="_blank"
        rel="noopener noreferrer"
      >
        {FEEDBACK_LABEL}
      </a>
    </motion.section>
  );
}
