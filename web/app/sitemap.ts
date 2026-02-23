import type {MetadataRoute} from 'next';
import {getSiteMapData} from '@/lib/data/public';
import {toAbsoluteUrl} from '@/lib/seo';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const dynamic = await getSiteMapData();

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: toAbsoluteUrl('/'),
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1
    },
    {
      url: toAbsoluteUrl('/explore'),
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9
    }
  ];

  const cityEntries: MetadataRoute.Sitemap = dynamic.cityPaths.map((path) => ({
    url: toAbsoluteUrl(path),
    lastModified: now,
    changeFrequency: 'daily',
    priority: 0.8
  }));

  const serviceEntries: MetadataRoute.Sitemap = dynamic.servicePaths.map((path) => ({
    url: toAbsoluteUrl(path),
    lastModified: now,
    changeFrequency: 'daily',
    priority: 0.7
  }));

  const salonEntries: MetadataRoute.Sitemap = dynamic.salonPaths.map((path) => ({
    url: toAbsoluteUrl(path),
    lastModified: now,
    changeFrequency: 'daily',
    priority: 0.9
  }));

  return [...staticEntries, ...cityEntries, ...serviceEntries, ...salonEntries];
}
