'use client';

import { useEffect, useId, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Titolo visibile o solo per screen reader */
  hideTitle?: boolean;
  children: React.ReactNode;
  /** Altezza massima: 'tall' quasi a schermo intero */
  size?: 'tall' | 'auto';
  footer?: React.ReactNode;
}

/**
 * Tendina dal basso in liquid glass. È un dialog modale vero: focus dentro,
 * Esc chiude, il focus torna al pulsante che l'ha aperta.
 */
export function BottomSheet({ open, onClose, title, hideTitle, children, size = 'tall', footer }: Props) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    returnTo.current = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => {
      const first = panelRef.current?.querySelector<HTMLElement>('[data-autofocus], input, button, [href]');
      first?.focus();
    }, 60);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
      if (e.key === 'Tab' && panelRef.current) {
        const items = panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      returnTo.current?.focus?.();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label="Chiudi"
            tabIndex={-1}
            onClick={onClose}
            className="absolute inset-0 bg-[rgba(15,23,42,0.32)] backdrop-blur-[2px] cursor-default"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className={`relative w-full sm:max-w-[640px] liquid-glass rounded-t-[32px] flex flex-col ${
              size === 'tall' ? 'h-[88dvh]' : 'max-h-[88dvh]'
            }`}
          >
            <div className="pt-2.5 pb-1 flex justify-center" aria-hidden>
              <span className="w-10 h-1.5 rounded-full bg-[rgba(15,23,42,0.18)]" />
            </div>
            <div className="flex items-center justify-between gap-3 px-5 pb-2">
              <h2
                id={titleId}
                className={hideTitle ? 'sr-only' : 'text-[18px] font-bold text-hi'}
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label={`Chiudi ${title.toLowerCase()}`}
                className="ml-auto w-11 h-11 rounded-full bg-white/80 border border-(--stroke-dark) flex items-center justify-center hover:bg-white"
              >
                <X className="w-5 h-5" aria-hidden />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-4">{children}</div>
            {footer && <div className="px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-white/60">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
