'use client';

import { useEffect, useState } from 'react';

/**
 * Icona dell'assistente: un piccolo agente (sfera con occhi e onda sonora).
 * Segnaposto vettoriale: sostituibile con l'icona definitiva senza toccare il pulsante.
 * `state` anima occhi e onda: ascolto = onda che pulsa, pensiero = occhi che guardano in alto.
 */
function AgentVector({ state = 'idle', className = '' }: { state?: 'idle' | 'listening' | 'thinking'; className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <defs>
        <radialGradient id="agent-orb" cx="35%" cy="28%" r="80%">
          <stop offset="0%" stopColor="#334155" />
          <stop offset="60%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#020617" />
        </radialGradient>
        <linearGradient id="agent-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffd23e" />
          <stop offset="100%" stopColor="#f5b301" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="25" r="18" fill="url(#agent-orb)" />
      <ellipse cx="18" cy="15.5" rx="7" ry="3.6" fill="#fff" opacity="0.18" transform="rotate(-20 18 15.5)" />
      {/* antenna */}
      <path d="M24 7v-2.5" stroke="url(#agent-gold)" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="24" cy="3.6" r="2.4" fill="url(#agent-gold)" />
      {/* occhi */}
      <g transform={state === 'thinking' ? 'translate(0 -2)' : undefined} style={{ transition: 'transform .3s' }}>
        <rect x="15.5" y="19" width="5" height="7" rx="2.5" fill="#fff" />
        <rect x="27.5" y="19" width="5" height="7" rx="2.5" fill="#fff" />
      </g>
      {/* onda sonora */}
      <path
        d="M16 32.5c1.6-1.6 3.2 1.6 4.8 0s3.2 1.6 4.8 0 3.2 1.6 4.8 0 1.6 1.6 1.6 1.6"
        fill="none"
        stroke="url(#agent-gold)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={state === 'listening' ? 'animate-pulse' : undefined}
      />
      {/* scintilla */}
      <path d="M39.5 8l1 2.6 2.6 1-2.6 1-1 2.6-1-2.6-2.6-1 2.6-1z" fill="url(#agent-gold)" />
    </svg>
  );
}

let hasFile: Promise<boolean> | null = null;

/**
 * Se c'è l'icona definitiva in public/brand/assistant.svg (generata con Higgsfield) usa quella,
 * altrimenti il disegno vettoriale qui sopra.
 */
export function AgentIcon(props: { state?: 'idle' | 'listening' | 'thinking'; className?: string }) {
  const [file, setFile] = useState(false);
  useEffect(() => {
    hasFile ??= fetch('/brand/assistant.svg', { method: 'HEAD' }).then((r) => r.ok, () => false);
    let alive = true;
    hasFile.then((ok) => alive && setFile(ok));
    return () => {
      alive = false;
    };
  }, []);
  if (!file) return <AgentVector {...props} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/assistant.svg" alt="" aria-hidden className={props.className} />;
}
