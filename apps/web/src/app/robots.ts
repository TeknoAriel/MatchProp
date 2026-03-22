import { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://match-prop-web.vercel.app';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/auth/', '/me/', '/settings/', '/leads/', '/dashboard/'],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
