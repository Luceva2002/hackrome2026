'use client';

import { useEffect, useId, useRef } from 'react';
import { AnimatePresence, motion, useDragControls, useReducedMotion } from 'motion/react';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Titolo visibile o solo per screen reader */
  hideTitle?: boolean;
  children: React.ReactNode;
  /** tall ≈ 80% dello schermo · medium ≈ 66% · auto = quanto serve (max 85%) */
  size?: 'tall' | 'medium' | 'auto';
  /** Velo dietro la tendina: 'dim' scurisce, 'clear' lascia vedere la mappa */
  backdrop?: 'dim' | 'clear';
  /** Contenuto sopra il titolo (es. foto in testa alla scheda) */
  header?: React.ReactNode;
  /** Al posto del titolo visibile, accanto alla X (es. la barra di ricerca) */
  toolbar?: React.ReactNode;
  footer?: React.ReactNode;
}

const HEIGHT = { tall: 'h-[min(80dvh,760px)]', medium: 'h-[min(66dvh,640px)]', auto: 'max-h-[85dvh]' } as const;

/**
 * Tendina in liquid glass che galleggia sopra il dock, staccata dai bordi
 * (var(--edge)). Dialog modale vero: focus dentro, Esc o X chiudono, il focus
 * torna al pulsante che l'ha aperta. Si chiude anche trascinando giù la testata.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  hideTitle,
  children,
  size = 'tall',
  footer,
  backdrop = 'dim',
  header,
  toolbar,
}: Props) {
  const titleId = useId();
  const drag = useDragControls();
  const reduce = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);

  // Mentre una tendina è aperta il dock si abbassa e sparisce (vedi .under-sheet)
  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    html.dataset.sheets = String(Number(html.dataset.sheets ?? 0) + 1);
    return () => {
      const n = Number(html.dataset.sheets ?? 1) - 1;
      if (n > 0) html.dataset.sheets = String(n);
      else delete html.dataset.sheets;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    returnTo.current = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => {
      // Campo segnato data-autofocus (ricerca, chat), altrimenti il dialog stesso:
      // così su mobile non compare un anello di focus sulla X.
      const first = panelRef.current?.querySelector<HTMLElement>('[data-autofocus]');
      (first ?? panelRef.current)?.focus({ preventScroll: true });
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
        <div className="fixed inset-0 z-50">
          <motion.button
            type="button"
            aria-label="Chiudi"
            tabIndex={-1}
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className={`absolute inset-0 cursor-default ${
              backdrop === 'dim' ? 'bg-[rgba(15,23,42,0.28)] backdrop-blur-[3px]' : 'bg-[rgba(15,23,42,0.06)]'
            }`}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            tabIndex={-1}
            aria-modal="true"
            aria-labelledby={titleId}
            drag={reduce ? false : 'y'}
            dragControls={drag}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.04, bottom: 0.7 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 600) onClose();
            }}
            initial={reduce ? { opacity: 0 } : { y: '108%', scale: 0.94, opacity: 0.6 }}
            animate={reduce ? { opacity: 1 } : { y: 0, scale: 1, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { y: '108%', scale: 0.96, opacity: 0.4 }}
            transition={{ type: 'spring', stiffness: 360, damping: 34, mass: 0.9 }}
            style={{ transformOrigin: '50% 100%', outline: 'none' }}
            className={`absolute inset-x-edge bottom-[calc(var(--safe-b)+var(--edge))] mx-auto max-w-[560px] liquid-glass-thick rounded-sheet flex flex-col overflow-hidden outline-none ${HEIGHT[size]}`}
          >
            {header}
            <div
              onPointerDown={(e) => drag.start(e)}
              className="shrink-0 touch-none cursor-grab active:cursor-grabbing select-none"
            >
              <div className="pt-2 flex justify-center" aria-hidden>
                <span className="w-9 h-[5px] rounded-full bg-[rgba(15,23,42,0.16)]" />
              </div>
              <div className="flex items-center gap-3 px-pad pt-1 pb-3 min-h-14">
                <h2
                  id={titleId}
                  className={hideTitle || toolbar ? 'sr-only' : 'flex-1 min-w-0 text-[20px] leading-tight font-bold text-hi line-clamp-2'}
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {title}
                </h2>
                {toolbar && (
                  <div className="flex-1 min-w-0" onPointerDown={(e) => e.stopPropagation()}>
                    {toolbar}
                  </div>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  onPointerDown={(e) => e.stopPropagation()}
                  aria-label={`Chiudi: ${title}`}
                  className="ml-auto w-11 h-11 rounded-full glass-well flex items-center justify-center text-hi hover:bg-white active:scale-90 transition-transform"
                >
                  <X className="w-5 h-5" aria-hidden />
                </button>
              </div>
            </div>
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-pad pb-pad"
            >
              {children}
            </motion.div>
            {footer && (
              <div className="shrink-0 px-pad pt-3 pb-pad border-t border-[rgba(15,23,42,0.06)] bg-white/40">{footer}</div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
