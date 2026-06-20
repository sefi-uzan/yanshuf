import { useState } from 'react';
import { ChevronDown, ChevronRight, PenLine, Timer, Zap } from 'lucide-react';
import type { CaptureEntry, HttpMessage } from '../../../shared/types';
import { SyntaxHighlight } from '@/components/SyntaxHighlight';
import { JsonViewer } from '@/components/JsonViewer';
import { detectContentLanguage, formatDuration } from '../../../shared/utils';
import { cn } from '@/lib/utils';

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
    <div className="shrink-0 rounded-md border">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs font-medium text-muted-foreground hover:bg-accent/50"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
        Headers
        {!open && entries.length > 0 && (
          <span className="font-normal text-muted-foreground/70">
            ({entries.length})
          </span>
        )}
      </button>
      {open && (
        <div className="max-h-48 overflow-y-auto border-t">
          <table className="w-full select-text text-xs">
            <tbody>
              {entries.map(([key, value]) => (
                <tr key={key} className="border-b last:border-b-0">
                  <td className="w-1/3 py-1 pl-3 pr-2 font-medium text-muted-foreground">{key}</td>
                  <td className="break-all py-1 pr-3 font-mono">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function MessagePane({ title, message, timing, synthetic }: MessagePaneProps) {
  if (!message) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Select a request to view {title.toLowerCase()}
      </div>
    );
  }

  const contentType = message.headers['content-type'] ?? message.headers['Content-Type'];
  const bodyContent = message.body?.preview ?? message.body?.content ?? '';
  const language = detectContentLanguage(bodyContent, contentType);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-3 py-2 text-sm font-medium">
        {title}
        {synthetic && (
          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
            Mocked
          </span>
        )}
        {timing !== undefined && (
          <span
            title="Duration"
            className={cn(
              'inline-flex items-center gap-1 text-xs font-normal text-muted-foreground',
              !synthetic && 'ml-1',
            )}
          >
            <Timer className="h-3.5 w-3.5" />
            {formatDuration(timing)}
          </span>
        )}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 px-3 py-2">
        <HeadersSection headers={message.headers} />
        <div className="min-h-0 flex-1 rounded-md border bg-muted/20">
          {bodyContent ? (
            language === 'json' ? (
              <JsonViewer content={bodyContent} />
            ) : (
              <SyntaxHighlight content={bodyContent} language={language} />
            )
          ) : (
            <div className="p-3 text-xs text-muted-foreground">No body</div>
          )}
        </div>
      </div>
    </div>
  );
}

interface CaptureDetailProps {
  entry: CaptureEntry | null;
}

export function RequestPane({ entry }: CaptureDetailProps) {
  return (
    <div className="flex h-full flex-col">
      {entry?.fromComposer && (
        <div className="flex items-center gap-1.5 border-b bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
          <PenLine className="h-3.5 w-3.5" />
          Composer — sent request
        </div>
      )}
      {entry?.matchedRuleId && (
        <div className="flex items-center gap-1.5 border-b bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
          <Zap className="h-3.5 w-3.5" />
          Auto Responder — synthetic response
        </div>
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
