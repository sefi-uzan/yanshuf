import { Button } from '@yanshuf/ui/button';
import { Apple } from 'lucide-react';
import { AppScreenshot } from '@/components/app-screenshot';
import { GitHubIcon } from '@/components/github-icon';
import { navLinks, siteConfig } from '@/lib/site-config';
import { screenshots } from '@/lib/screenshots';

export function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      <div className="hero-glow grid-bg absolute inset-0" aria-hidden />
      <div className="relative mx-auto max-w-6xl px-6 pb-8 pt-16 sm:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <p
            className="animate-fade-up text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground"
            style={{ animationDelay: '0ms' }}
          >
            {siteConfig.name}
          </p>
          <h1
            className="animate-fade-up mt-4 text-balance text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl"
            style={{ animationDelay: '80ms' }}
          >
            {siteConfig.headline}
          </h1>
          <p
            className="animate-fade-up mx-auto mt-6 max-w-2xl text-balance text-lg text-muted-foreground sm:text-xl"
            style={{ animationDelay: '160ms' }}
          >
            {siteConfig.description}
          </p>
          <div
            className="animate-fade-up mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
            style={{ animationDelay: '240ms' }}
          >
            <Button asChild size="lg" className="h-11 min-w-[220px] rounded-lg bg-primary text-primary-foreground hover:bg-primary/90">
              <a href={navLinks.download} target="_blank" rel="noopener noreferrer">
                <Apple className="size-4" aria-hidden />
                Download for macOS
              </a>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-11 min-w-[220px] rounded-lg border-border/80 bg-transparent">
              <a href={navLinks.github} target="_blank" rel="noopener noreferrer">
                <GitHubIcon />
                View on GitHub
              </a>
            </Button>
          </div>
        </div>
        <div className="animate-fade-in mt-16 sm:mt-20" style={{ animationDelay: '400ms' }}>
          <AppScreenshot
            {...screenshots.capture}
            variant="hero"
            priority
          />
        </div>
      </div>
    </section>
  );
}
