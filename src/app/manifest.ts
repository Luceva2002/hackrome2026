import { APP_NAME } from '@/lib/brand';
import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description:
      'La mappa di tutti i luoghi dove fare sport a Roma e la bacheca delle attività aperte a tutti.',
    // id fisso: l'app installata resta la stessa anche se cambia start_url
    id: '/',
    scope: '/',
    start_url: '/mappa',
    display: 'standalone',
    // Come --bg in globals.css e themeColor in layout.tsx: barra di stato e splash uguali all'app
    background_color: '#f4f5f7',
    theme_color: '#f4f5f7',
    lang: 'it',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
      {
        src: '/icon-maskable.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  };
}
