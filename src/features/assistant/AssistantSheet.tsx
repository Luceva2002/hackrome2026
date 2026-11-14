'use client';

import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, SendHorizontal } from 'lucide-react';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { useAssistant } from './AssistantProvider';

const SUGGESTIONS = [
  'Campi da basket accessibili nel Municipio XV',
  'Yoga questo weekend con posti liberi',
  'Piscine vicino a me',
];

export function AssistantSheet() {
  const { chatOpen, closeChat, messages, sendText, status, startVoice, stopVoice } = useAssistant();
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const listening = status === 'listening';

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, chatOpen]);

  const submit = (t: string) => {
    sendText(t);
    setText('');
  };

  return (
    <BottomSheet
      open={chatOpen}
      onClose={closeChat}
      title="Assistente"
      footer={
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(text);
          }}
          className="flex items-center gap-2"
        >
          <button
            type="button"
            onClick={() => (listening ? stopVoice() : startVoice())}
            aria-pressed={listening}
            aria-label={listening ? 'Smetti di parlare' : 'Parla con l’assistente'}
            className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 border ${
              listening ? 'bg-gold-500 border-gold-500 text-(--on-gold)' : 'bg-white border-(--stroke-dark) text-hi'
            }`}
          >
            {listening ? <MicOff className="w-5 h-5" aria-hidden /> : <Mic className="w-5 h-5" aria-hidden />}
          </button>
          <label htmlFor="assistant-input" className="sr-only">
            Scrivi all’assistente
          </label>
          <input
            id="assistant-input"
            data-autofocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Chiedi qualcosa…"
            autoComplete="off"
            className="flex-1 min-w-0 h-12 px-4 rounded-full bg-white border border-(--stroke-dark) text-[16px] text-hi outline-none focus:border-gold-500"
          />
          <button
            type="submit"
            disabled={!text.trim()}
            aria-label="Invia"
            className="w-12 h-12 rounded-full bg-ink text-white flex items-center justify-center shrink-0 disabled:opacity-40"
          >
            <SendHorizontal className="w-5 h-5" aria-hidden />
          </button>
        </form>
      }
    >
      <div role="log" aria-live="polite" aria-label="Conversazione" className="flex flex-col gap-2.5 py-2">
        {messages.length === 0 && (
          <div className="py-4">
            <p className="text-[15px] text-mid mb-3">
              Chiedimi un luogo o un’attività. Puoi anche tenere premuto il microfono e parlare.
            </p>
            <ul className="flex flex-col gap-2">
              {SUGGESTIONS.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => submit(s)}
                    className="w-full text-left px-4 py-3 rounded-2xl bg-white/80 border border-(--stroke-dark) text-[15px] font-semibold text-hi hover:bg-white"
                  >
                    “{s}”
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[85%] px-4 py-2.5 rounded-[20px] text-[15px] leading-snug ${
              m.role === 'user' ? 'self-end bg-ink text-white rounded-br-md' : 'self-start bg-white text-hi border border-(--stroke) rounded-bl-md'
            }`}
          >
            <span className="sr-only">{m.role === 'user' ? 'Tu: ' : 'Assistente: '}</span>
            {m.text}
            {m.sources?.length ? (
              <ul className="mt-1.5 text-[12px] text-mid">
                {m.sources.map((s) => (
                  <li key={s.url}>
                    Fonte:{' '}
                    <a href={s.url} target="_blank" rel="noreferrer" className="underline">
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </BottomSheet>
  );
}
