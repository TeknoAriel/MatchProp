import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '../components/ThemeProvider';
import { ToastProvider } from '../components/FunToast';
import AppShell from '../components/AppShell';

const PRODUCT_NAME = process.env.NEXT_PUBLIC_PRODUCT_NAME || 'MatchProp';

export const metadata: Metadata = {
  title: { default: PRODUCT_NAME, template: `%s | ${PRODUCT_NAME}` },
  description:
    'Buscá y encontrá tu próximo inmueble. Match tipo Tinder, listas, alertas y consultas directas con inmobiliarias.',
  keywords: ['inmuebles', 'propiedades', 'alquiler', 'venta', 'búsqueda inmobiliaria'],
  openGraph: { type: 'website', locale: 'es_AR' },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="antialiased min-h-screen overflow-x-hidden">
        <ThemeProvider>
          <ToastProvider>
            <AppShell>{children}</AppShell>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
