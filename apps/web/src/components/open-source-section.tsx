import { Button } from '@yanshuf/ui/button';
import { Check, GitFork } from 'lucide-react';
import { GitHubIcon } from '@/components/github-icon';
import { navLinks, siteConfig } from '@/lib/site-config';

const bullets = [
  'Change the UI. Restyle every surface to match your taste.',
  'Add rules and integrations. Wire in your own flows and tools.',
  'Ship your own build. Self-host it or distribute it as your own.',
];

const terminalLines = [
  { type: 'prompt', text: 'gh repo fork sefi-uzan/yanshuf --clone' },
  { type: 'success', text: 'Cloned yanshuf into ./yanshuf' },
  { type: 'prompt', text: 'cd yanshuf && pnpm install' },
  { type: 'success', text: 'Packages installed in 4.2s' },
  { type: 'prompt', text: 'pnpm start' },
  { type: 'info', text: 'Yanshuf dev server → Electron app launched' },
] as const;

export function OpenSourceSection() {
  return (
    <section className="border-t border-border/60">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Open source</p>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            If you don&apos;t like something, fork it.
          </h2>
        </div>
        <div className="mt-16 grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-xl shadow-black/30">
            <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
              <span className="size-2.5 rounded-full bg-red-500/80" />
              <span className="size-2.5 rounded-full bg-amber-400/80" />
              <span className="size-2.5 rounded-full bg-emerald-400/80" />
              <span className="ml-2 font-mono text-xs text-muted-foreground">~/code</span>
            </div>
            <div className="space-y-2 p-4 font-mono text-sm">
              {terminalLines.map((line) => (
                <p key={line.text} className="leading-relaxed">
                  {line.type === 'prompt' && <span className="text-muted-foreground">$ </span>}
                  {line.type === 'success' && <span className="text-emerald-400">✓ </span>}
                  {line.type === 'info' && <span className="text-sky-400">▲ </span>}
                  <span
                    className={
                      line.type === 'success' || line.type === 'info'
                        ? 'text-muted-foreground'
                        : 'text-foreground'
                    }
                  >
                    {line.text}
                  </span>
                </p>
              ))}
            </div>
          </div>
          <div>
            <ul className="space-y-4">
              {bullets.map((bullet) => (
                <li key={bullet} className="flex items-start gap-3">
                  <Check className="mt-0.5 size-4 shrink-0 text-sky-400" aria-hidden />
                  <span className="text-muted-foreground">{bullet}</span>
                </li>
              ))}
            </ul>
            <p className="mt-8 text-sm text-muted-foreground">
              {siteConfig.license} licensed · macOS only
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg" className="rounded-lg">
                <a href={`${navLinks.github}/fork`} target="_blank" rel="noopener noreferrer">
                  <GitFork className="size-4" aria-hidden />
                  Fork on GitHub
                </a>
              </Button>
              <Button asChild variant="ghost" size="lg" className="rounded-lg text-muted-foreground">
                <a href={navLinks.github} target="_blank" rel="noopener noreferrer">
                  Browse source ↗
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function CtaSection() {
  return (
    <section className="border-t border-border/60">
      <div className="hero-glow mx-auto max-w-6xl px-6 py-20 text-center sm:py-28">
        <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          Your traffic deserves better than guesswork.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
          Yanshuf is free, open source, and fast. Install it, trust the local CA when you&apos;re ready, and
          start inspecting.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="h-11 min-w-[220px] rounded-lg">
            <a href={navLinks.download} target="_blank" rel="noopener noreferrer">
              Download for macOS
            </a>
          </Button>
          <Button asChild variant="outline" size="lg" className="h-11 rounded-lg border-border/80">
            <a href={navLinks.github} target="_blank" rel="noopener noreferrer">
              <GitHubIcon />
              View on GitHub
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
