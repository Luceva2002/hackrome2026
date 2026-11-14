'use client';

import { useEffect, useId, useRef } from 'react';
import { Mic, MicOff } from 'lucide-react';

import { AgentIcon } from './AgentIcon';
import { VoiceBars } from './VoiceStatus';

import { useAssistant } from './AssistantProvider';

const HOLD_MS = 350;

/**
 * Pulsante rotondo in basso a destra.
 * - Tocco/clic (o Invio): apre la tendina con la chat.
 * - Tenuto premuto (dito, mouse o barra spaziatrice): parli, al rilascio smette.
 */
export function AssistantButton() {
  const { status, openChat, startVoice, stopVoice } = useAssistant();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holding = useRef(false);
  const spaceDown = useRef(false);

  const begin = () => {
    holding.current = false;
    timer.current = setTimeout(() => {
      holding.current = true;
      navigator.vibrate?.(15);
      startVoice();
    }, HOLD_MS);
  };
  const end = (openIfTap: boolean) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (holding.current) {
      holding.current = false;
      stopVoice();
    } else if (openIfTap) {
      openChat();
    }
  };

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  // due pulsanti in pagina (dock mobile, angolo desktop): ognuno la sua descrizione
  const hintId = useId();
  const listening = status === 'listening';
  const busy = status === 'thinking' || status === 'connecting';
  const speaking = status === 'speaking';

  return (
    <button
      type="button"
      aria-label={listening ? 'Assistente vocale: ti sto ascoltando' : speaking ? 'Assistente vocale: ti sto rispondendo' : busy ? 'Assistente vocale: sto cercando' : 'Assistente vocale'}
      aria-describedby={hintId}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        begin();
      }}
      onPointerUp={() => end(true)}
      onPointerCancel={() => end(false)}
      onContextMenu={(e) => e.preventDefault()}
      onBlur={() => {
        // Se il focus esce con la barra premuta il keyup non arriva: chiudi il microfono
        spaceDown.current = false;
        end(false);
      }}
      onClick={(e) => {
        // Il clic da tastiera (Invio) non passa dai pointer events
        if (e.detail === 0) openChat();
      }}
      onKeyDown={(e) => {
        if (e.key === ' ' && !e.repeat) {
          e.preventDefault();
          spaceDown.current = true;
          begin();
        }
      }}
      onKeyUp={(e) => {
        if (e.key === ' ' && spaceDown.current) {
          e.preventDefault();
          spaceDown.current = false;
          end(true);
        }
      }}
      className={`relative w-dock h-dock shrink-0 rounded-full flex items-center justify-center select-none touch-none transition-[transform,background-color] duration-200 active:scale-90 ${
        listening
          ? 'bg-gold-500 text-(--on-gold) shadow-(--shadow-gold) scale-110'
          : speaking
            ? 'bg-[#7c3aed] text-white shadow-(--shadow-float)'
            : status === 'error'
              ? 'bg-red-600 text-white'
              : 'liquid-glass text-hi'
      }`}
    >
      {/* ascolto: cerchi che si allargano dal pulsante */}
      {listening && (
        <>
          <span className="absolute inset-0 rounded-full border-2 border-gold-500 animate-radar" aria-hidden />
          <span className="absolute inset-0 rounded-full border-2 border-gold-500 animate-radar" style={{ animationDelay: '0.8s' }} aria-hidden />
        </>
      )}
      {/* pensiero o collegamento: anello che gira */}
      {busy && <span className="absolute -inset-1 rounded-full assistant-ring" aria-hidden />}
      {listening ? (
        <Mic className="w-7 h-7" aria-hidden />
      ) : speaking ? (
        <VoiceBars color="bg-white" slow />
      ) : status === 'error' ? (
        <MicOff className="w-6 h-6" aria-hidden />
      ) : (
        <AgentIcon state={busy ? 'thinking' : 'idle'} className="w-10 h-10" />
      )}
      <span id={hintId} className="sr-only">
        Tocca per aprire la chat, tieni premuto per parlare. Nella chat c’è anche il pulsante del microfono.
      </span>
    </button>
  );
}
