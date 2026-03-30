import { MetadataRoute } from 'next';
import { getServerApiOrigin } from '../lib/server-api-origin';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://match-prop-web.vercel.app';

/** Zonas comunes para SEO (búsquedas indexables) */
const ZONAS_COMUNES = [
  'Palermo',
  'Belgrano',
  'Recoleta',
  'Caballito',
  'Villa Crespo',
  'Nunez',
  'Colegiales',
  'Almagro',
  'San Telmo',
  'Puerto Madero',
  'Rosario',
  'Cordoba',
  'Mendoza',
  'La Plata',
  'San Isidro',
  'Vicente Lopez',
  'Tigre',
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    {
      url: `${BASE_URL}/login`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    { url: `${BASE_URL}/feed`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    {
      url: `${BASE_URL}/feed/list`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/assistant`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/me/premium`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
  ];

  const zonaRoutes: MetadataRoute.Sitemap = ZONAS_COMUNES.map((zona) => ({
    url: `${BASE_URL}/buscar/${encodeURIComponent(zona.toLowerCase().replace(/\s+/g, '-'))}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.7,
  }));

  let listingRoutes: MetadataRoute.Sitemap = [];
  try {
    const origin = getServerApiOrigin();
    const res = await fetch(`${origin}/public/listings/sitemap-ids`, {
      next: { revalidate: 3600 },
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const data = (await res.json()) as { items?: { id: string; updatedAt: string }[] };
      const items = data.items ?? [];
      listingRoutes = items.map((it) => ({
        url: `${BASE_URL.replace(/\/$/, '')}/listing/${it.id}`,
        lastModified: new Date(it.updatedAt),
        changeFrequency: 'daily' as const,
        priority: 0.65,
      }));
    }
  } catch {
    /* build o API caída: sitemap solo con rutas estáticas */
  }

  return [...staticRoutes, ...zonaRoutes, ...listingRoutes];
}
