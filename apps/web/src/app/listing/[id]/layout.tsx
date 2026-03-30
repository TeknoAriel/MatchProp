import type { Metadata } from 'next';
import { getServerApiOrigin } from '../../../lib/server-api-origin';

const PRODUCT_NAME = process.env.NEXT_PUBLIC_PRODUCT_NAME || 'MatchProp';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://match-prop-web.vercel.app';

const INVALID_IDS = new Set(['', 'undefined', 'null']);

type PublicListingSeo = {
  id: string;
  title: string | null;
  description: string | null;
  operationType: string | null;
  propertyType: string | null;
  price: number | null;
  currency: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  locationText: string | null;
  heroImageUrl: string | null;
};

function buildDescription(p: PublicListingSeo): string {
  const bits: string[] = [];
  if (p.operationType && p.propertyType) bits.push(`${p.operationType} · ${p.propertyType}`);
  if (p.price != null) {
    const cur = p.currency?.trim() || '';
    bits.push(`${cur ? `${cur} ` : ''}${p.price.toLocaleString('es-AR')}`.trim());
  }
  if (p.bedrooms != null) bits.push(`${p.bedrooms} dorm.`);
  if (p.bathrooms != null) bits.push(`${p.bathrooms} baños`);
  if (p.locationText?.trim()) bits.push(p.locationText.trim());
  const head = bits.join(' · ');
  const body = p.description?.trim() ?? '';
  if (head && body) return `${head}. ${body}`;
  if (body) return body;
  if (head) return `${head}. Encontrá más en ${PRODUCT_NAME}.`;
  return `Propiedad en ${PRODUCT_NAME}.`;
}

async function fetchPublicListing(id: string): Promise<PublicListingSeo | null> {
  try {
    const origin = getServerApiOrigin();
    const res = await fetch(`${origin}/public/listings/${encodeURIComponent(id)}`, {
      next: { revalidate: 300 },
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return (await res.json()) as PublicListingSeo;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (!id || INVALID_IDS.has(id)) {
    return { title: 'Propiedad', robots: { index: false, follow: true } };
  }

  const p = await fetchPublicListing(id);
  if (!p) {
    return {
      title: 'Propiedad no disponible',
      description: `Esta publicación no está disponible o fue dada de baja en ${PRODUCT_NAME}.`,
      robots: { index: false, follow: true },
    };
  }

  const title = p.title?.trim() || 'Propiedad';
  const description = buildDescription(p);
  const canonical = `${APP_URL.replace(/\/$/, '')}/listing/${id}`;

  return {
    title,
    description,
    openGraph: {
      type: 'website',
      locale: 'es_AR',
      siteName: PRODUCT_NAME,
      url: canonical,
      title,
      description,
      images: p.heroImageUrl ? [{ url: p.heroImageUrl }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: p.heroImageUrl ? [p.heroImageUrl] : undefined,
    },
    alternates: { canonical: `/listing/${id}` },
    robots: { index: true, follow: true },
  };
}

export default function ListingDetailLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
