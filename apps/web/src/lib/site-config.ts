export const siteConfig = {
  name: 'Yanshuf',
  tagline: 'The open-source network debugger for macOS.',
  description:
    'Inspect, modify, and replay HTTP and HTTPS traffic on your Mac. Route system or app traffic through Yanshuf, mock responses with Auto Responder, and connect AI coding tools via MCP.',
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
