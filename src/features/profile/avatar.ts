'use client';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * Ridimensiona a 512 px (quadrato, ritaglio centrale) e ricodifica in JPEG:
 * file leggero e, soprattutto, senza metadati EXIF (niente posizione GPS dello scatto).
 */
async function toSquareJpeg(file: File, size = 512): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('Formato non leggibile da questo browser: usa una foto JPG o PNG.');
  }
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Non riesco a preparare la foto. Riprova.');
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Non riesco a preparare la foto. Riprova.'))), 'image/jpeg', 0.86));
}

/** Carica la foto profilo e la salva nei metadati dell'utente. Restituisce l'URL pubblico. */
export async function uploadAvatar(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Scegli un’immagine (JPG, PNG o WebP).');
  if (file.size > 15 * 1024 * 1024) throw new Error('L’immagine è troppo grande (massimo 15 MB).');
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error('Servizio non disponibile.');
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error('Accedi per cambiare la foto.');

  const blob = await toSquareJpeg(file);
  const path = `${uid}/avatar-${Date.now()}.jpg`;
  const up = await supabase.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (up.error) {
    const msg = up.error.message ?? '';
    console.error('[avatar] upload', up.error);
    // Il dettaglio tecnico (bucket, migration 030, policy) resta in console per il team
    if (/bucket not found/i.test(msg)) throw new Error('Le foto profilo non sono ancora attive. Riprova più tardi.');
    if (/mime|size|too large|payload/i.test(msg)) throw new Error('Questa immagine non va bene: prova con una foto JPG o PNG più piccola.');
    throw new Error('Caricamento non riuscito. Riprova.');
  }
  const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;

  const upd = await supabase.auth.updateUser({ data: { avatar_url: url } });
  if (upd.error) {
    await supabase.storage.from('avatars').remove([path]);
    throw new Error('Foto caricata ma non salvata nel profilo. Riprova.');
  }
  await deleteOldAvatars(supabase, uid, path);
  return url;
}

/**
 * Le foto precedenti vanno cancellate davvero: il bucket è pubblico, un vecchio
 * link resterebbe visibile per sempre anche dopo "Togli".
 */
async function deleteOldAvatars(supabase: NonNullable<ReturnType<typeof getSupabaseBrowserClient>>, uid: string, keep?: string) {
  const { data } = await supabase.storage.from('avatars').list(uid, { limit: 100 });
  const old = ((data ?? []) as { name: string }[]).map((f) => `${uid}/${f.name}`).filter((p) => p !== keep);
  if (old.length) await supabase.storage.from('avatars').remove(old);
}

export async function removeAvatar(): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error('Servizio non disponibile.');
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error('Accedi per togliere la foto.');
  const upd = await supabase.auth.updateUser({ data: { avatar_url: null } });
  if (upd.error) throw new Error('Non riesco a togliere la foto. Riprova.');
  await deleteOldAvatars(supabase, uid);
}
