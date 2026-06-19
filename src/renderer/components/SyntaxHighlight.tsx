import { useEffect, useState } from 'react';
import { codeToHtml } from 'shiki';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getCodeTheme } from '@/lib/theme';

interface SyntaxHighlightProps {
  content: string;
  language?: string;
}

export function SyntaxHighlight({ content, language = 'text' }: SyntaxHighlightProps) {
  const [html, setHtml] = useState<string>('');
  const [theme, setTheme] = useState(getCodeTheme);

  useEffect(() => {
    const updateTheme = () => setTheme(getCodeTheme());
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', updateTheme);
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateTheme);
    return () => {
      window.matchMedia('(prefers-color-scheme: light)').removeEventListener('change', updateTheme);
      window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', updateTheme);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void codeToHtml(content, {
      lang: language,
      theme,
    }).then((result) => {
      if (!cancelled) setHtml(result);
    }).catch(() => {
      if (!cancelled) {
        setHtml(`<pre><code>${escapeHtml(content)}</code></pre>`);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [content, language, theme]);

  return (
    <ScrollArea className="h-full w-full">
      <div
        className="select-text p-3 text-xs [&_pre]:m-0 [&_pre]:bg-transparent [&_code]:font-mono"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </ScrollArea>
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
