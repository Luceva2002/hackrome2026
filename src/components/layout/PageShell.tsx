'use client';

import { ArrowLeft } from 'lucide-react';

import { GlassIconButton } from '@/components/ui/GlassIconButton';

/** Guscio delle pagine interne (attività, gestore, admin): indietro, titolo, contenuto che scorre. */
export function PageShell({
  title,
  back,
  backLabel,
  action,
  children,
}: {
  title: string;
  back: string;
  backLabel: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="h-full overflow-y-auto bg-(--bg) pb-[calc(var(--dock-space)+24px)] lg:pt-20">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between gap-3 pt-safe pb-4">
          <GlassIconButton href={back} ariaLabel={backLabel} className="rounded-2xl! shrink-0">
            <ArrowLeft className="w-5 h-5" aria-hidden />
          </GlassIconButton>
          <h1 className="text-[17px] font-bold text-hi truncate" style={{ fontFamily: 'var(--font-display)' }}>
            {title}
          </h1>
          <div className="w-11 h-11 shrink-0 flex items-center justify-center">{action}</div>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Stato vuoto, di errore o di attesa, sempre con una frase e (se serve) un'azione. */
export function Notice({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="card rounded-[24px] p-6 text-center">
      <p className="text-[15px] text-mid">{children}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export const inputClass =
  'w-full h-12 px-4 rounded-2xl bg-white border border-(--stroke-dark) text-[16px] text-hi placeholder:text-low focus:outline-none focus:border-gold-500';
export const labelClass = 'block text-[13px] font-bold text-hi mb-1.5';
export const primaryBtn =
  'h-12 px-6 rounded-full bg-gold-500 hover:bg-gold-400 text-(--on-gold) font-bold text-[15px] flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-transform';
export const quietBtn =
  'h-12 px-5 rounded-full card font-bold text-[14px] text-hi flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-transform';
