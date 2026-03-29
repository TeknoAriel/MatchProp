import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '../components/ThemeProvider';
import { ToastProvider } from '../components/FunToast';
import { UserEngagementProvider } from '../components/UserEngagementProvider';
import AppShell from '../components/AppShell';
import { BuildStamp } from '../components/BuildStamp';

const PRODUCT_NAME = process.env.NEXT_PUBLIC_PRODUCT_NAME || 'MatchProp';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://match-prop-web.vercel.app';

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: { default: PRODUCT_NAME, template: `%s | ${PRODUCT_NAME}` },
  description:
    'Buscá y encontrá tu próximo inmueble. Match tipo Tinder, listas, alertas y consultas directas con inmobiliarias.',
  keywords: [
    'inmuebles',
    'propiedades',
    'alquiler',
    'venta',
    'búsqueda inmobiliaria',
    'Palermo',
    'Rosario',
    'CABA',
  ],
  openGraph: {
    type: 'website',
    locale: 'es_AR',
    siteName: PRODUCT_NAME,
    url: APP_URL,
    title: PRODUCT_NAME,
    description:
      'Encontrá tu próximo hogar. Match tipo Tinder, alertas y consultas con inmobiliarias.',
  },
  twitter: { card: 'summary_large_image' },
  alternates: { canonical: APP_URL },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="antialiased min-h-screen overflow-x-hidden">
        <ThemeProvider>
          <ToastProvider>
            <UserEngagementProvider>
              <AppShell>{children}</AppShell>
            </UserEngagementProvider>
            <BuildStamp />
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
