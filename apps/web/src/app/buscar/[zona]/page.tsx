import type { Metadata } from 'next';
import Link from 'next/link';

const PRODUCT_NAME = process.env.NEXT_PUBLIC_PRODUCT_NAME || 'MatchProp';
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://match-prop-web.vercel.app';

type Props = { params: Promise<{ zona: string }> };

function slugToTitle(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { zona } = await params;
  const zonaTitle = slugToTitle(zona);
  const title = `Propiedades en ${zonaTitle} - ${PRODUCT_NAME}`;
  const description = `Buscá propiedades en venta y alquiler en ${zonaTitle}. ${PRODUCT_NAME} te ayuda a encontrar tu próximo hogar con match tipo Tinder y alertas.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${BASE_URL}/buscar/${zona}`,
      type: 'website',
      locale: 'es_AR',
    },
    alternates: {
      canonical: `${BASE_URL}/buscar/${zona}`,
    },
    robots: { index: true, follow: true },
  };
}

export default async function BuscarZonaPage({ params }: Props) {
  const { zona } = await params;
  const zonaTitle = slugToTitle(zona);

  return (
    <main className="min-h-screen flex flex-col bg-gradient-to-br from-sky-50 via-white to-blue-50">
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="text-center max-w-lg">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-lg">
            <span className="text-4xl">🏠</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-3">
            Propiedades en {zonaTitle}
          </h1>
          <p className="text-slate-600 mb-8">
            Encontrá tu próximo hogar en {zonaTitle}. Decí qué buscás y te matcheamos con las mejores
            opciones.
          </p>
          <div className="space-y-3">
            <Link
              href="/login"
              className="block w-full px-6 py-4 bg-gradient-to-r from-sky-500 to-blue-600 text-white font-semibold rounded-2xl hover:from-sky-600 hover:to-blue-700 shadow-lg shadow-sky-500/25 transition-all text-center"
            >
              Buscar en {zonaTitle}
            </Link>
            <Link
              href="/feed"
              className="block text-sm text-slate-500 hover:text-sky-600"
            >
              ¿Ya tenés cuenta? Ver feed
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
