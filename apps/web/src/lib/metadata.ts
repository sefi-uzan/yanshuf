import type { Metadata } from 'next';
import { siteConfig } from './site-config';

type PageMetadataOptions = {
  title?: string;
  description?: string;
  path?: string;
};

export function createMetadata({
  title,
  description = siteConfig.description,
  path = '',
}: PageMetadataOptions = {}): Metadata {
  const pageTitle = title ? `${title} · ${siteConfig.name}` : `${siteConfig.name} — ${siteConfig.tagline}`;
  const url = `${siteConfig.url}${path}`;

  return {
    title: pageTitle,
    description,
    metadataBase: new URL(siteConfig.url),
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      locale: 'en_US',
      url,
      siteName: siteConfig.name,
      title: pageTitle,
      description,
    },
    twitter: {
      card: 'summary_large_image',
      title: pageTitle,
      description,
    },
    icons: {
      icon: '/icon.svg',
      apple: '/icon.svg',
    },
  };
}
