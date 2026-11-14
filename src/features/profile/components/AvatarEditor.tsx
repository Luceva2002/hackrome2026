'use client';

import { useRef, useState } from 'react';
import { Camera, Loader2, Trash2 } from 'lucide-react';

import { useAuth } from '@/features/auth/hooks/use-auth';
import { removeAvatar, uploadAvatar } from '../avatar';

/** Foto profilo: tocca per cambiarla. Senza foto, l'iniziale su fondo oro. */
export function AvatarEditor({ initial }: { initial: string }) {
  const { user } = useAuth();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [local, setLocal] = useState<string | null | undefined>(undefined);
  const url = local !== undefined ? local : ((user?.user_metadata?.avatar_url as string | undefined) ?? null);

  const pick = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      setLocal(await uploadAvatar(file));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className="flex flex-col items-center gap-2 shrink-0">
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        aria-label={url ? 'Cambia la foto profilo' : 'Aggiungi una foto profilo'}
        className="relative w-[76px] h-[76px] rounded-full ring-4 ring-(--gold-tint) overflow-hidden group"
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="w-full h-full object-cover" />
        ) : (
          <span
            className="w-full h-full flex items-center justify-center text-[30px] font-bold text-(--on-gold)"
            style={{ background: 'linear-gradient(135deg, var(--gold-300), var(--gold-500))', fontFamily: 'var(--font-display)' }}
          >
            {initial}
          </span>
        )}
        <span className="absolute inset-x-0 bottom-0 h-7 bg-black/55 flex items-center justify-center text-white" aria-hidden>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => pick(e.target.files?.[0])}
      />
      {url && !busy && (
        <button
          type="button"
          onClick={async () => {
            setBusy(true);
            try {
              await removeAvatar();
              setLocal(null);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
          className="text-[12px] font-semibold text-mid hover:text-hi inline-flex items-center gap-1"
        >
          <Trash2 className="w-3.5 h-3.5" aria-hidden /> Togli
        </button>
      )}
      {error && (
        <p role="alert" className="text-[12px] text-danger max-w-[160px] text-center">
          {error}
        </p>
      )}
    </div>
  );
}
