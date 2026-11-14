'use client';

import { AnimatePresence, motion } from 'motion/react';
import { Loader2, Mic, TriangleAlert, Volume2 } from 'lucide-react';

import { useAssistant } from './AssistantProvider';
import type { AssistantStatus } from './engine';

/**
 * Cosa sta facendo l'assistente, sempre con tre segnali insieme: colore, icona e parole.
 *  - ascolto  → oro, microfono, onde che seguono la voce: "Ti ascolto, parla pure"
 *  - pensiero → scuro, rotella: "Sto cercando…"
 *  - risposta → viola, altoparlante, barre: "Ti sto rispondendo"
 *  - fermo    → niente pillola: il microfono è chiuso
 */
export const VOICE_STATES: Record<Exclude<AssistantStatus, 'idle'>, { text: string; hint: string; tone: string; bars: string | null }> = {
  connecting: { text: 'Mi collego…', hint: 'Un attimo, non parlare ancora', tone: 'bg-ink text-white', bars: null },
  listening: { text: 'Ti ascolto', hint: 'Parla pure, il microfono è aperto', tone: 'bg-gold-500 text-(--on-gold)', bars: 'bg-(--on-gold)' },
  thinking: { text: 'Sto cercando…', hint: 'Il microfono è in pausa', tone: 'bg-ink text-white', bars: null },
  speaking: { text: 'Ti sto rispondendo', hint: 'Puoi interrompermi parlando', tone: 'bg-[#7c3aed] text-white', bars: 'bg-white' },
  error: { text: 'Non ti sento', hint: 'Controlla il microfono e riprova', tone: 'bg-red-600 text-white', bars: null },
};

export function VoiceBars({ className = '', color = 'bg-current', slow = false }: { className?: string; color?: string; slow?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-[3px] h-5 ${className}`} aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className={`w-[3px] rounded-full ${color} voice-bar`}
          style={{ animationDelay: `${i * 0.12}s`, animationDuration: slow ? '1.1s' : '0.7s' }}
        />
      ))}
    </span>
  );
}

function StateIcon({ status }: { status: Exclude<AssistantStatus, 'idle'> }) {
  if (status === 'listening') return <Mic className="w-5 h-5" aria-hidden />;
  if (status === 'speaking') return <Volume2 className="w-5 h-5" aria-hidden />;
  if (status === 'error') return <TriangleAlert className="w-5 h-5" aria-hidden />;
  return <Loader2 className="w-5 h-5 animate-spin" aria-hidden />;
}

/** La pillola di stato. `inline` dentro la chat, altrimenti sospesa sopra il dock. */
export function VoiceStatusPill({ inline = false }: { inline?: boolean }) {
  const { status, stopVoice, cancel } = useAssistant();
  const s = status === 'idle' ? null : VOICE_STATES[status];
  return (
    <div role="status" aria-live="polite" className={inline ? 'flex justify-center min-h-0' : ''}>
      <AnimatePresence mode="wait">
        {s && status !== 'idle' && (
          <motion.div
            key={status}
            initial={{ opacity: 0, y: 12, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 460, damping: 30 }}
            className={`pointer-events-auto flex items-center gap-3 pl-4 pr-2 h-14 rounded-full shadow-(--shadow-float) ${s.tone} ${inline ? 'my-2' : ''}`}
          >
            <StateIcon status={status} />
            <span className="flex flex-col min-w-0">
              <span className="text-[15px] font-bold leading-tight whitespace-nowrap">{s.text}</span>
              <span className="text-[12px] leading-tight opacity-85 whitespace-nowrap">{s.hint}</span>
            </span>
            {s.bars && <VoiceBars color={s.bars} slow={status === 'speaking'} />}
            {status === 'error' ? (
              <span className="w-2" />
            ) : (
              <button
                type="button"
                onClick={status === 'listening' ? stopVoice : cancel}
                className="h-10 px-3.5 rounded-full bg-black/20 text-[13px] font-bold whitespace-nowrap active:scale-95 transition-transform"
              >
                {status === 'listening' ? 'Ho finito' : 'Ferma'}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Pillola sospesa: su mobile al centro sopra il dock, su desktop sopra il pulsante in basso a destra. */
export function VoiceStatus() {
  const { chatOpen } = useAssistant();
  if (chatOpen) return null; // dentro la chat c'è la versione in linea
  return (
    <div className="fixed z-[45] inset-x-0 bottom-[calc(var(--safe-b)+var(--edge)+var(--dock-h)+12px)] flex justify-center px-edge pointer-events-none lg:justify-end">
      <VoiceStatusPill />
    </div>
  );
}
