import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';

import { Providers } from '@/components/providers/Providers';
import { PWARegister } from '@/components/providers/PWARegister';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-body',
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'RomaInCampo — Dove fare sport a Roma',
  description:
    'La mappa di tutti i luoghi dove fare sport a Roma, con la fonte di ogni dato, e la bacheca delle attività aperte a tutti.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'RomaInCampo',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f4f5f7',
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={`h-full ${inter.variable} ${spaceGrotesk.variable}`}>
      <body className="h-full antialiased bg-(--bg)">
        <Providers>{children}</Providers>
        <PWARegister />
      </body>
    </html>
  );
}
