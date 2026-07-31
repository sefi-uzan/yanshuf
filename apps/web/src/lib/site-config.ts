export const siteConfig = {
  name: 'Yanshuf',
  tagline: 'The open-source network debugger for macOS.',
  headline: 'See every request your Mac sends.',
  description:
    'Yanshuf shows the HTTP and HTTPS traffic on your Mac. Read a request, change it, and send it again. Free and open source.',
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://yanshuf.dev',
  github: {
    repo: 'https://github.com/sefi-uzan/yanshuf',
    releases: 'https://github.com/sefi-uzan/yanshuf/releases',
  },
  author: 'Sefi',
  license: 'MIT',
  email: 'sefiuzan812@gmail.com',
} as const;

export const navLinks = {
  github: siteConfig.github.repo,
  download: siteConfig.github.releases,
  terms: '/terms',
  privacy: '/privacy',
  security: '/security',
} as const;
