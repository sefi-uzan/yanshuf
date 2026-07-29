import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

type LegalLayoutProps = {
  title: string;
  updated: string;
  children: React.ReactNode;
};

export function LegalLayout({ title, updated, children }: LegalLayoutProps) {
  return (
    <article className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
      <Link
        href="/"
        className="mb-10 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to home
      </Link>
      <header className="mb-10 border-b border-border/60 pb-8">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated {updated}</p>
      </header>
      <div className="legal-content space-y-8 text-muted-foreground [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-foreground [&_h3]:mt-4 [&_h3]:text-base [&_h3]:font-medium [&_h3]:text-foreground [&_li]:mt-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:leading-relaxed [&_strong]:text-foreground [&_table]:mt-4 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border/60 [&_td]:px-3 [&_td]:py-2 [&_th]:border [&_th]:border-border/60 [&_th]:bg-secondary/40 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-foreground [&_ul]:list-disc [&_ul]:pl-6">
        {children}
      </div>
    </article>
  );
}
