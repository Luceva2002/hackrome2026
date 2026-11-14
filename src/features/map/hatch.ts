import { MUNICIPIO_COLORS } from './areas';

interface ImageMap {
  hasImage(id: string): boolean;
  addImage(id: string, img: ImageData, opts: { pixelRatio: number }): void;
}

/**
 * Retino delle zone funzionali, come registraRetini della vista 3D di Urbe Hub (MIT):
 * una tessera per colore della palette, fondo al 16%, riga di 2,4 px all'85%,
 * passo di 7 px a 45 gradi (tessera di ~10 px che si ripete senza giunte).
 */
export function registerHatches(map: ImageMap) {
  if (typeof document === 'undefined') return;
  const pr = Math.min(window.devicePixelRatio || 1, 2);
  const side = 10;
  const px = Math.round(side * pr);
  MUNICIPIO_COLORS.forEach((col, i) => {
    const id = `retino-${i}`;
    if (map.hasImage(id)) return;
    const cv = document.createElement('canvas');
    cv.width = px;
    cv.height = px;
    const x = cv.getContext('2d');
    if (!x) return;
    x.scale(px / side, px / side);
    x.globalAlpha = 0.16;
    x.fillStyle = col;
    x.fillRect(0, 0, side, side);
    x.globalAlpha = 0.85;
    x.strokeStyle = col;
    x.lineWidth = 2.4;
    x.lineCap = 'square';
    for (const o of [-side, 0, side]) {
      x.beginPath();
      x.moveTo(o - 1, side + 1);
      x.lineTo(o + side + 1, -1);
      x.stroke();
    }
    map.addImage(id, x.getImageData(0, 0, px, px), { pixelRatio: px / side });
  });
}
