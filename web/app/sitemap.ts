import type {MetadataRoute} from 'next';
import {getSiteMapData} from '@/lib/data/public';
import {DEFAULT_LOCALE} from '@/lib/i18n';
import {localeAlternateUrls, localizedPath, toAbsoluteUrl} from '@/lib/seo';

function withAlternates(path: string) {
  const canonicalPath = localizedPath(DEFAULT_LOCALE, path);
  return {
    url: toAbsoluteUrl(canonicalPath),
    alternates: {
      languages: localeAlternateUrls(path)
    }
  } as const;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const dynamic = await getSiteMapData();

  const staticEntries: MetadataRoute.Sitemap = [
    {
      ...withAlternates('/'),
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1
    },
    {
      ...withAlternates('/explore'),
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9
    }
  ];

  const cityEntries: MetadataRoute.Sitemap = dynamic.cityPaths.map((path) => ({
    ...withAlternates(path),
    lastModified: now,
    changeFrequency: 'daily',
    priority: 0.8
  }));

  const serviceEntries: MetadataRoute.Sitemap = dynamic.servicePaths.map((path) => ({
    ...withAlternates(path),
    lastModified: now,
    changeFrequency: 'daily',
    priority: 0.7
  }));

  const salonEntries: MetadataRoute.Sitemap = dynamic.salonPaths.map((path) => ({
    ...withAlternates(path),
    lastModified: now,
    changeFrequency: 'daily',
    priority: 0.9
  }));

  return [...staticEntries, ...cityEntries, ...serviceEntries, ...salonEntries];
}
