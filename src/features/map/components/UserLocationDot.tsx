/** Posizione dell'utente: punto oro con onde radar */
export function UserLocationDot() {
  return (
    <div className="relative flex items-center justify-center" aria-hidden>
      <span className="absolute w-10 h-10 rounded-full border border-(--gold-500)/60 animate-radar" />
      <span
        className="absolute w-10 h-10 rounded-full border border-(--gold-500)/60 animate-radar"
        style={{ animationDelay: '1.2s' }}
      />
      <span
        className="relative w-[15px] h-[15px] rounded-full bg-gold-500 border-2 border-white"
        style={{ boxShadow: '0 2px 10px rgba(245,179,1,0.7)' }}
      />
    </div>
  );
}
