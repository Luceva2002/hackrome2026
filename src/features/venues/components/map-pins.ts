/**
 * Pin della mappa disegnati su canvas: goccia nel colore della tipologia con
 * l'icona (emoji) del tipo di luogo. Registrati come immagini Mapbox, così la
 * mappa resta un solo layer WebGL anche con 2.000 luoghi.
 */
import { VENUE_KINDS } from '@/lib/sports/taxonomy';

const RATIO = 2;

function drawPin(color: string, emoji: string, selected: boolean) {
  const r = selected ? 22 : 17; // raggio della testa, in px CSS
  const ring = selected ? 4 : 3;
  const tail = selected ? 10 : 8;
  const pad = 6; // spazio per l'ombra
  const w = (r + ring + pad) * 2;
  const h = w + tail;
  const canvas = document.createElement('canvas');
  canvas.width = w * RATIO;
  canvas.height = h * RATIO;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.scale(RATIO, RATIO);
  const cx = w / 2;
  const cy = r + ring + pad;

  const shape = () => {
    ctx.beginPath();
    ctx.arc(cx, cy, r + ring, Math.PI * 0.8, Math.PI * 0.2);
    ctx.lineTo(cx, cy + r + ring + tail);
    ctx.closePath();
  };

  // ombra morbida
  ctx.save();
  ctx.shadowColor = 'rgba(15,23,42,0.35)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = selected ? '#f5b301' : '#ffffff';
  shape();
  ctx.fill();
  ctx.restore();

  // testa colorata
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  // riflesso in alto (vetro)
  const g = ctx.createLinearGradient(0, cy - r, 0, cy + r);
  g.addColorStop(0, 'rgba(255,255,255,0.38)');
  g.addColorStop(0.55, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = `${Math.round(r * 1.05)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, cx, cy + 1);

  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

interface ImageMap {
  hasImage(id: string): boolean;
  addImage(id: string, img: ImageData, opts: { pixelRatio: number }): void;
}

export function pinId(kind: string, selected = false) {
  return `pin-${kind}${selected ? '-sel' : ''}`;
}

export function registerPins(map: ImageMap, only?: string) {
  for (const k of VENUE_KINDS) {
    for (const sel of [false, true]) {
      const id = pinId(k.id, sel);
      if (only && only !== id) continue;
      if (map.hasImage(id)) continue;
      const img = drawPin(k.color, k.emoji, sel);
      if (img) map.addImage(id, img, { pixelRatio: RATIO });
    }
  }
}
