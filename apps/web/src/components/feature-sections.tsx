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
    eyebrow: 'Rules',
    title: 'Change a request before it reaches the server.',
    description:
      'A rule matches a URL with a regular expression. Yanshuf applies the first rule that matches, so the order of the rules is important.',
    bullets: [
      'Mock: return your own response and stop the request at Yanshuf.',
      'Rewrite: change the request or the response, then send it on.',
      'Breakpoint: hold the request, edit it, and then continue.',
      'Map Remote: send the request to a different host. The path stays the same.',
    ],
    screenshot: screenshots.trafficRules,
  },
  {
    eyebrow: 'Composer',
    title: 'Build and send HTTP requests.',
    description:
      'Write a new request in Composer, or drag a captured request into it. Yanshuf adds the result to the capture list.',
    bullets: [
      'Set the method, the URL, the headers, and the body.',
      'Drag a request from the capture list into Composer.',
      'Start from a GET or a POST template.',
      'Copy the request as a cURL command.',
    ],
    screenshot: screenshots.composer,
    reversed: true,
  },
  {
    eyebrow: 'AI Integration',
    title: 'Connect Cursor and Claude Code to Yanshuf.',
    description:
      'Yanshuf includes a Model Context Protocol (MCP) server. Install it from Settings, and your AI tool can then read the captures and send requests.',
    bullets: [
      'Install the MCP server into your editor with one click.',
      'Install hooks and skills for your agent at the same time.',
      'Your agent can search the captures and read a response.',
      'The API listens on localhost only, and it needs a token.',
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
