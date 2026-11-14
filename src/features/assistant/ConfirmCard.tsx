'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

import { confirmStore } from './confirm-store';

/**
 * Conferma di un'azione chiesta all'assistente (iscrizione, nuova attività…).
 * Sta in alto, sopra mappa e tendine: si vede anche con la chat aperta. L'utente può
 * premere Conferma oppure dire "sì" all'assistente.
 */
export function ConfirmCard() {
  const p = useSyncExternalStore(confirmStore.subscribe, confirmStore.get, () => null);
  const state = p?.state;

  // Esito letto e visto: dopo qualche secondo la scheda si toglie da sola
  useEffect(() => {
    if (state !== 'done') return;
    const t = setTimeout(() => confirmStore.cancel(false), 6000);
    return () => clearTimeout(t);
  }, [state, p?.id]);

  return (
    <div
      aria-live="assertive"
      className="fixed z-[70] inset-x-edge top-[calc(var(--safe-t)+var(--edge)+var(--control-h)+var(--gap))] mx-auto max-w-[460px] pointer-events-none"
    >
      {p && (
        <section
          aria-label="Conferma dell’assistente"
          className="pointer-events-auto liquid-glass rounded-2xl p-4 shadow-xl border border-(--stroke) bg-white/95"
        >
          {p.state === 'pending' && (
            <>
              <p className="text-[15px] font-semibold text-hi leading-snug">{p.summary}?</p>
              <p className="text-[13px] text-mid mt-1">Puoi premere Conferma o dirlo all’assistente.</p>
              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => void confirmStore.confirmByButton()}
                  className="flex-1 h-12 rounded-xl bg-ink text-white font-bold"
                >
                  {p.action}
                </button>
                <button type="button" onClick={() => confirmStore.cancel()} className="h-12 px-5 rounded-xl glass-well text-hi font-semibold">
                  Annulla
                </button>
              </div>
            </>
          )}
          {p.state === 'running' && (
            <p className="flex items-center gap-2 text-[15px] font-semibold text-hi">
              <Loader2 className="w-5 h-5 animate-spin" aria-hidden /> Un momento…
            </p>
          )}
          {(p.state === 'done' || p.state === 'error') && (
            <div className="flex items-start gap-3">
              {p.state === 'done' ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" aria-hidden />
              ) : (
                <AlertCircle className="w-6 h-6 text-red-600 shrink-0" aria-hidden />
              )}
              <p className="flex-1 text-[15px] font-semibold text-hi leading-snug">{p.result}</p>
              <button type="button" onClick={() => confirmStore.cancel(false)} className="h-9 px-3 rounded-lg glass-well text-[14px] font-semibold text-hi">
                Chiudi
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
