"use client";

import Link from "next/link";
import { useMemo } from "react";
import { LocateFixed } from "lucide-react";

import { useGeolocation } from "@/hooks/use-geolocation";
import { useVenues } from "@/features/venues/hooks/use-venues";
import {
  nearestVenues,
  recommendVenues,
  type Recommendation,
} from "./recommend";
import { VenueCard } from "./VenueCard";

function Rail({
  id,
  title,
  hint,
  items,
}: {
  id: string;
  title: string;
  hint?: string;
  items: Recommendation[] | null;
}) {
  return (
    <section aria-labelledby={id} className="mt-7">
      <div className="px-4 sm:px-6 flex items-baseline justify-between gap-3">
        <h2
          id={id}
          className="text-[21px] font-bold text-hi"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {title}
        </h2>
        {hint && <p className="text-[13px] text-mid">{hint}</p>}
      </div>
      <ul
        className="mt-3 px-4 sm:px-6 flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-px-4 sm:scroll-px-6 no-scrollbar pb-2"
        aria-busy={!items}
      >
        {items
          ? items.map((r) => (
              <VenueCard
                key={r.venue.id}
                venue={r.venue}
                reason={r.reason}
                distanceKm={r.distanceKm}
              />
            ))
          : Array.from({ length: 3 }).map((_, i) => (
              <li
                key={i}
                className="shrink-0 w-[78vw] max-w-[300px] sm:w-[280px]"
                aria-hidden
              >
                <div className="aspect-[4/3] rounded-[22px] bg-white/70 animate-pulse" />
                <div className="h-4 mt-3 w-3/4 rounded bg-white/70 animate-pulse" />
              </li>
            ))}
      </ul>
    </section>
  );
}

export function HomeScreen() {
  const { venues, error, reload } = useVenues();
  const geo = useGeolocation();
  const loc = geo.location
    ? { lat: geo.location.latitude, lng: geo.location.longitude }
    : null;

  // loc è un oggetto nuovo a ogni render: si ricalcola solo quando cambiano le coordinate
  const recommended = useMemo(
    () => (venues ? recommendVenues(venues, { location: loc }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [venues, loc?.lat, loc?.lng],
  );
  const nearest = useMemo(
    () => (venues && loc ? nearestVenues(venues, loc) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [venues, loc?.lat, loc?.lng],
  );

  return (
    <div className="h-full overflow-y-auto pt-[calc(env(safe-area-inset-top)+5rem)] pb-dock">
      <div
        className="fixed z-30 top-0 inset-x-0 h-[calc(env(safe-area-inset-top)+4.5rem)] pointer-events-none"
        style={{
          background: "linear-gradient(to bottom, var(--bg) 55%, transparent)",
        }}
        aria-hidden
      />
      <div className="max-w-6xl mx-auto">
        <div className="px-4 sm:px-6">
          <h1
            className="text-[30px] leading-tight font-bold text-hi"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Fai sport a Roma
          </h1>
          <p className="text-[15px] text-mid mt-1">
            {venues
              ? `${venues.length.toLocaleString("it-IT")} luoghi dai dati pubblici, con la fonte di ogni informazione.`
              : "Carico i luoghi…"}
          </p>
        </div>

        <Link
          href="/attivita"
          className="mx-4 mt-5 card rounded-[24px] p-4 flex items-center gap-3 hover:bg-(--surface-muted) transition-colors"
        >
          <span className="w-11 h-11 rounded-2xl bg-(--gold-tint) flex items-center justify-center text-[22px] shrink-0" aria-hidden>
            📅
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[15px] font-bold text-hi">Attività in programma</span>
            <span className="block text-[13px] text-mid">Partite, corsi e allenamenti aperti, gratuiti o con prezzo</span>
          </span>
          <span className="text-low text-[20px]" aria-hidden>›</span>
        </Link>

        {error ? (
          <div className="mx-4 mt-8 text-center">
            <p className="text-[14px] text-mid mb-3">
              Non riesco a caricare i luoghi.
            </p>
            <button
              type="button"
              onClick={reload}
              className="h-11 px-5 rounded-xl bg-ink text-white font-bold"
            >
              Riprova
            </button>
          </div>
        ) : (
          <>
            <Rail
              id="home-consigliati"
              title="Consigliati per te"
              hint="Schede più complete"
              items={recommended}
            />

            {loc ? (
              <Rail id="home-vicini" title="Vicino a te" items={nearest} />
            ) : (
              <section
                aria-labelledby="home-vicini"
                className="mt-7 mx-4 sm:mx-6 liquid-glass rounded-[26px] p-5"
              >
                <h2
                  id="home-vicini"
                  className="text-[19px] font-bold text-hi"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  Vicino a te
                </h2>
                <p className="text-[14px] text-mid mt-1">
                  {geo.status === "denied"
                    ? "Hai negato la posizione. Puoi riattivarla dalle impostazioni del browser."
                    : "Condividi la posizione per vedere i luoghi più vicini. Non la salviamo sui nostri server."}
                </p>
                {geo.status !== "denied" && (
                  <button
                    type="button"
                    onClick={() => geo.requestAccess()}
                    className="mt-3 h-12 px-5 rounded-full bg-ink text-white font-bold flex items-center gap-2"
                  >
                    <LocateFixed
                      className={`w-5 h-5 ${geo.loading ? "animate-pulse" : ""}`}
                      aria-hidden
                    />
                    Usa la mia posizione
                  </button>
                )}
                {geo.error && (
                  <p className="text-[13px] text-red-700 mt-2" role="alert">
                    {geo.error}
                  </p>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
