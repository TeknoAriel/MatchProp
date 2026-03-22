import type { Metadata } from 'next';

const PRODUCT_NAME = process.env.NEXT_PUBLIC_PRODUCT_NAME || 'MatchProp';

export const metadata: Metadata = {
  title: 'Buscar',
  description: `Decí qué buscás y ${PRODUCT_NAME} te matchea con las mejores propiedades. Búsqueda por voz y texto.`,
  robots: { index: true, follow: true },
};

export default function AssistantLayout({ children }: { children: React.ReactNode }) {
  return children;
}
