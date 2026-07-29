import Link from 'next/link';
import Image from 'next/image';
import { navLinks, siteConfig } from '@/lib/site-config';

const footerLinks = [
  { label: 'GitHub', href: navLinks.github, external: true as const },
  { label: 'Download', href: navLinks.download, external: true as const },
  { label: 'Terms', href: navLinks.terms, external: false as const },
  { label: 'Privacy', href: navLinks.privacy, external: false as const },
  { label: 'Security', href: navLinks.security, external: false as const },
];

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Image src="/icon.svg" alt="" width={20} height={20} className="rounded-sm" />
          <span>
            © {year} {siteConfig.name} · {siteConfig.license} licensed
          </span>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
          {footerLinks.map((link) =>
            link.external ? (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-foreground"
              >
                {link.label}
              </a>
            ) : (
              <Link key={link.label} href={link.href} className="transition-colors hover:text-foreground">
                {link.label}
              </Link>
            ),
          )}
        </nav>
      </div>
    </footer>
  );
}
