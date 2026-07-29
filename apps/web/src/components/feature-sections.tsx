import { Check } from 'lucide-react';
import { AppScreenshot } from '@/components/app-screenshot';
import { screenshots } from '@/lib/screenshots';

type FeatureSectionProps = {
  eyebrow: string;
  title: string;
  description: string;
  bullets: string[];
  screenshot: (typeof screenshots)[keyof typeof screenshots];
  reversed?: boolean;
};

const features: FeatureSectionProps[] = [
  {
    eyebrow: 'Traffic rules',
    title: 'Mock, rewrite, breakpoint, or map remote.',
    description:
      'Shape traffic with ordered regex rules. Return synthetic responses, modify live exchanges, pause for inspection, or forward requests to another host — first match wins.',
    bullets: [
      'Mock responses without hitting the server',
      'Rewrite live requests and responses',
      'Breakpoints to inspect, edit, and continue',
      'Map remote to forward matching traffic elsewhere',
    ],
    screenshot: screenshots.trafficRules,
  },
  {
    eyebrow: 'Composer',
    title: 'Build and send HTTP requests.',
    description:
      'Craft requests from scratch, drag captured traffic from the session list to pre-fill the editor, or start from quick templates. Results land back in the capture list.',
    bullets: [
      'Method, URL, headers, and body editor',
      'Drag captured requests to pre-fill',
      'Quick-start GET and POST templates',
      'Copy as cURL or send in one click',
    ],
    screenshot: screenshots.composer,
    reversed: true,
  },
  {
    eyebrow: 'AI integration',
    title: 'Connect Cursor or Claude Code via MCP.',
    description:
      'Install the bundled MCP server, hooks, and skills into your editor from Settings. Your agent can search captures, send requests, and debug traffic without leaving the IDE.',
    bullets: [
      'One-click MCP server install for Cursor',
      'Hooks and skills for agent workflows',
      'Search and inspect live captures from your agent',
      'Localhost-only API with auth token',
    ],
    screenshot: screenshots.aiIntegration,
  },
];

export function FeatureSections() {
  return (
    <div className="border-t border-border/60">
      {features.map((feature) => (
        <section key={feature.title} className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
          <div
            className={`grid items-center gap-12 lg:grid-cols-2 lg:gap-16 ${
              feature.reversed ? 'lg:[&>*:first-child]:order-2' : ''
            }`}
          >
            <div className="min-w-0">
              <AppScreenshot {...feature.screenshot} />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                {feature.eyebrow}
              </p>
              <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
                {feature.title}
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">{feature.description}</p>
              <ul className="mt-8 space-y-3">
                {feature.bullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-3 text-muted-foreground">
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-400" aria-hidden />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
