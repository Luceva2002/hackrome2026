/**
 * Icona dell'assistente: due stelline a quattro punte, gradiente dal viola al rosa.
 * `state` le anima: ascolto = pulsano, pensiero = ruotano piano.
 */
export function AgentIcon({ state = 'idle', className = '' }: { state?: 'idle' | 'listening' | 'thinking'; className?: string }) {
  const anim = state === 'listening' ? 'animate-pulse' : state === 'thinking' ? 'animate-[spin_3s_linear_infinite]' : '';
  const star = (cx: number, cy: number, r: number) => {
    const k = r * 0.22; // spessore della vita della stella
    return `M${cx} ${cy - r} C${cx + k} ${cy - k} ${cx + k} ${cy - k} ${cx + r} ${cy} C${cx + k} ${cy + k} ${cx + k} ${cy + k} ${cx} ${cy + r} C${cx - k} ${cy + k} ${cx - k} ${cy + k} ${cx - r} ${cy} C${cx - k} ${cy - k} ${cx - k} ${cy - k} ${cx} ${cy - r}Z`;
  };
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <defs>
        <linearGradient id="agent-stars" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7c3aed" />
          <stop offset="55%" stopColor="#c026d3" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
      </defs>
      <g className={anim} style={{ transformOrigin: '20px 27px', transformBox: 'view-box' }}>
        <path d={star(20, 27, 15)} fill="url(#agent-stars)" />
      </g>
      <path d={star(36, 11, 7.5)} fill="url(#agent-stars)" className={state === 'listening' ? 'animate-pulse' : ''} />
    </svg>
  );
}
