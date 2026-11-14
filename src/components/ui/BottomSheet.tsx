'use client';

import { useEffect, useId, useRef, useState } from 'react';
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
  /** Su desktop la tendina diventa un pannello laterale: a sinistra o a destra */
  side?: 'left' | 'right';
  footer?: React.ReactNode;
}

function useDesktop() {
  const [d, setD] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const on = () => setD(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return d;
}

/** Tendine aperte, la più recente in fondo: Esc e Tab valgono solo per quella in cima */
const stack: symbol[] = [];

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
  side = 'left',
}: Props) {
  const titleId = useId();
  const drag = useDragControls();
  const reduce = useReducedMotion();
  const desktop = useDesktop();
  const off = desktop ? { x: side === 'left' ? '-110%' : '110%', y: 0 } : { y: '108%', x: 0 };
  const panelRef = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  // In un ref: un onClose instabile del chiamante non deve rilanciare l'effetto e rubare il focus
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Mentre una tendina è aperta il dock si abbassa e sparisce (vedi .under-sheet) e la pagina
  // non scorre. Contate: chiudere prima quella sotto non deve sbloccare né lasciare bloccato.
  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    html.dataset.sheets = String(Number(html.dataset.sheets ?? 0) + 1);
    document.body.style.overflow = 'hidden';
    return () => {
      const n = Number(html.dataset.sheets ?? 1) - 1;
      if (n > 0) html.dataset.sheets = String(n);
      else {
        delete html.dataset.sheets;
        document.body.style.overflow = '';
      }
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    returnTo.current = document.activeElement as HTMLElement | null;
    const me = Symbol('sheet');
    stack.push(me);
    const t = setTimeout(() => {
      // Campo segnato data-autofocus (ricerca, chat), altrimenti il dialog stesso:
      // così su mobile non compare un anello di focus sulla X.
      const first = panelRef.current?.querySelector<HTMLElement>('[data-autofocus]');
      (first ?? panelRef.current)?.focus({ preventScroll: true });
    }, 60);
    const onKey = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== me) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
      }
      if (e.key === 'Tab' && panelRef.current) {
        const items = panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select, textarea, summary, [tabindex]:not([tabindex="-1"])',
        );
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement as HTMLElement | null;
        // Focus sul pannello stesso (all'apertura) o finito fuori: si rientra dal bordo giusto
        const outside = !active || !Array.from(items).includes(active);
        if (e.shiftKey && (outside || active === first)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (outside || active === last)) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      stack.splice(stack.indexOf(me), 1);
      document.removeEventListener('keydown', onKey);
      returnTo.current?.focus?.();
    };
  }, [open]);

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
            drag={reduce || desktop ? false : 'y'}
            dragControls={drag}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.04, bottom: 0.7 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 600) onClose();
            }}
            initial={reduce ? { opacity: 0 } : { ...off, scale: 0.94, opacity: 0.6 }}
            animate={reduce ? { opacity: 1 } : { x: 0, y: 0, scale: 1, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { ...off, scale: 0.96, opacity: 0.4 }}
            transition={{ type: 'spring', stiffness: 360, damping: 34, mass: 0.9 }}
            style={{ transformOrigin: desktop ? `${side === 'left' ? '0%' : '100%'} 50%` : '50% 100%', outline: 'none' }}
            className={`absolute inset-x-edge bottom-[calc(var(--safe-b)+var(--edge))] mx-auto max-w-[560px] liquid-glass-thick rounded-sheet flex flex-col overflow-hidden outline-none ${HEIGHT[size]} lg:mx-0 lg:w-[420px] lg:h-auto lg:max-h-none lg:top-[calc(var(--safe-t)+var(--edge)+var(--control-h)+var(--gap))] lg:bottom-(--dock-space) ${
              side === 'left' ? 'lg:right-auto' : 'lg:left-auto'
            }`}
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
