import Link from 'next/link';
import Image from 'next/image';
import { Badge } from '@yanshuf/ui/badge';
import { Star } from 'lucide-react';
import { navLinks, siteConfig } from '@/lib/site-config';

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5 text-sm font-medium tracking-tight">
          <Image src="/icon.svg" alt="" width={24} height={24} className="rounded-md" />
          <span>{siteConfig.name}</span>
        </Link>
        <a
          href={navLinks.github}
          target="_blank"
          rel="noopener noreferrer"
          className="transition-opacity hover:opacity-80"
        >
          <Badge variant="secondary" className="gap-1.5 border border-border/80 bg-secondary/60 px-2.5 py-1 font-normal">
            <Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden />
            Open source on GitHub
          </Badge>
        </a>
      </div>
    </header>
  );
}
