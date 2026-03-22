import type { Metadata } from 'next';

const PRODUCT_NAME = process.env.NEXT_PUBLIC_PRODUCT_NAME || 'MatchProp';

export const metadata: Metadata = {
  title: 'Feed',
  description: `Buscá propiedades con match tipo Tinder. ${PRODUCT_NAME} te matchea con inmuebles según lo que buscás.`,
  robots: { index: false, follow: true },
};

export default function FeedLayout({ children }: { children: React.ReactNode }) {
  return children;
}
