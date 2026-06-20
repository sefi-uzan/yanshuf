import { useState } from 'react';
import { ChevronDown, ChevronRight, ArrowRightLeft, PenLine, Timer, Zap } from 'lucide-react';
import type { CaptureEntry, HttpMessage } from '@yanshuf/shared';
import { SyntaxHighlight } from '@/components/SyntaxHighlight';
import { JsonViewer } from '@/components/JsonViewer';
import { ScrollArea } from '@yanshuf/ui';
import { detectContentLanguage, formatBytes, formatDuration } from '@yanshuf/shared';
import { cn } from '@yanshuf/ui/lib/utils';

const LARGE_BODY_THRESHOLD = 256 * 1024;

interface MessagePaneProps {
  title: string;
  message: HttpMessage | null;
  timing?: number;
  synthetic?: boolean;
}

function HeadersSection({ headers }: { headers: Record<string, string> }) {
  const [open, setOpen] = useState(false);
  const entries = Object.entries(headers);

  return (
    <div className="shrink-0 overflow-hidden rounded-xl border bg-muted/20 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center gap-1.5 px-3 py-2.5 text-left hover:bg-accent/30"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        <span className="text-sm font-semibold">Headers</span>
        {!open && entries.length > 0 && (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {entries.length}
          </span>
        )}
      </button>
      {open && (
        <div className="max-h-48 overflow-y-auto border-t">
          <table className="w-full select-text text-xs">
            <tbody>
              {entries.map(([key, value]) => (
                <tr key={key} className="border-b last:border-b-0">
                  <td className="w-1/3 py-1.5 pl-3 pr-2 font-medium text-muted-foreground">{key}</td>
                  <td className="break-all py-1.5 pr-3 font-mono">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function LargeBody({ content, size }: { content: string; size?: number }) {
  const [showFull, setShowFull] = useState(false);
  const truncated = !showFull && content.length > LARGE_BODY_THRESHOLD;
  const shown = truncated ? content.slice(0, LARGE_BODY_THRESHOLD) : content;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-1.5 text-xs text-muted-foreground">
        <span>Large body{size ? ` (${formatBytes(size)})` : ''} — syntax highlighting disabled</span>
        {truncated && (
          <button
            type="button"
            className="rounded border px-1.5 py-0.5 text-foreground hover:bg-accent"
            onClick={() => setShowFull(true)}
          >
            Show full
          </button>
        )}
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <pre className="select-text whitespace-pre-wrap break-all p-3 font-mono text-xs">{shown}</pre>
      </ScrollArea>
    </div>
  );
}

export function MessagePane({ title, message, timing, synthetic }: MessagePaneProps) {
  if (!message) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <p className="text-sm text-muted-foreground">Select a request to view {title.toLowerCase()}</p>
      </div>
    );
  }

  const contentType = message.headers['content-type'] ?? message.headers['Content-Type'];
  const bodyContent = message.body?.preview ?? message.body?.content ?? '';
  const language = detectContentLanguage(bodyContent, contentType);
  const isLarge = bodyContent.length > LARGE_BODY_THRESHOLD;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b bg-background px-3 py-2.5">
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        {synthetic && (
          <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
            Mocked
          </span>
        )}
        {timing !== undefined && (
          <span
            title="Duration"
            className={cn(
              'ml-auto inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-0.5 text-xs font-normal text-muted-foreground',
            )}
          >
            <Timer className="h-3.5 w-3.5" />
            {formatDuration(timing)}
          </span>
        )}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
        <HeadersSection headers={message.headers} />
        <div className="min-h-0 flex-1 overflow-hidden rounded-xl border bg-muted/15 shadow-sm">
          {bodyContent ? (
            isLarge ? (
              <LargeBody content={bodyContent} size={message.body?.size} />
            ) : language === 'json' ? (
              <JsonViewer content={bodyContent} />
            ) : (
              <SyntaxHighlight content={bodyContent} language={language} />
            )
          ) : (
            <div className="p-4 text-xs text-muted-foreground">No body</div>
          )}
        </div>
      </div>
    </div>
  );
}

interface CaptureDetailProps {
  entry: CaptureEntry | null;
}

function SourceBanner({
  icon: Icon,
  label,
  accent,
}: {
  icon: typeof PenLine;
  label: string;
  accent: 'primary' | 'amber' | 'emerald';
}) {
  return (
    <div className={cn(
      'flex items-center gap-2 border-b px-3 py-2 text-xs font-medium',
      accent === 'primary' && 'bg-primary/10 text-primary',
      accent === 'amber' && 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
      accent === 'emerald' && 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </div>
  );
}

export function RequestPane({ entry }: CaptureDetailProps) {
  return (
    <div className="flex h-full flex-col">
      {entry?.fromComposer && (
        <SourceBanner icon={PenLine} label="Composer — sent request" accent="primary" />
      )}
      {entry?.matchedRuleId && (
        <SourceBanner icon={Zap} label="Mock rule — synthetic response" accent="amber" />
      )}
      {entry?.mappedToUrl && (
        <SourceBanner
          icon={ArrowRightLeft}
          label={`Map Remote — forwarded to ${entry.mappedToUrl}`}
          accent="emerald"
        />
      )}
      <div className="min-h-0 flex-1">
        <MessagePane title="Request" message={entry?.client ?? null} />
      </div>
    </div>
  );
}

export function ResponsePane({ entry }: CaptureDetailProps) {
  return (
    <MessagePane
      title="Response"
      message={entry?.server ?? null}
      timing={entry?.durationMs}
      synthetic={Boolean(entry?.matchedRuleId)}
    />
  );
}
