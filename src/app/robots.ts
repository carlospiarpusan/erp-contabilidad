import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/login'],
        disallow: ['/api/', '/dashboard/', '/seleccionar-empresa', '/cambiar-password'],
      },
    ],
    sitemap: 'https://www.clovent.co/sitemap.xml',
    host: 'https://www.clovent.co',
  }
}
