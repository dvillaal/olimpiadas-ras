import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ToastProvider } from '@/components/toast';

export const metadata: Metadata = {
  title: {
    default: 'Olimpiadas Scouts',
    template: '%s · Olimpiadas Scouts',
  },
  description:
    'Sistema de inscripción de las Olimpiadas Scouts: grupos, participantes, países, deportes, equipos intergrupales, pagos y stands.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#15b680',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        {/* Salto directo al contenido: navegación por teclado y lectores de pantalla. */}
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50
                     focus:rounded-lg focus:bg-scout-600 focus:px-4 focus:py-2 focus:font-semibold focus:text-white"
        >
          Saltar al contenido
        </a>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
