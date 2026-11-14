import { APP_NAME } from '@/lib/brand';
import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description:
      'La mappa di tutti i luoghi dove fare sport a Roma e la bacheca delle attività aperte a tutti.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f2f4fa',
    theme_color: '#f2f4fa',
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
