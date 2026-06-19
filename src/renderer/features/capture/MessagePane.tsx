import { Zap } from 'lucide-react';
import type { CaptureEntry, HttpMessage } from '../../../shared/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SyntaxHighlight } from '@/components/SyntaxHighlight';
import { detectContentLanguage } from '../../../shared/utils';

interface MessagePaneProps {
  title: string;
  message: HttpMessage | null;
  status?: number;
  timing?: number;
  synthetic?: boolean;
}

export function MessagePane({ title, message, status, timing, synthetic }: MessagePaneProps) {
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
      </div>
      <Tabs defaultValue="headers" className="flex min-h-0 flex-1 flex-col px-3">
        <TabsList>
          <TabsTrigger value="headers">Headers</TabsTrigger>
          <TabsTrigger value="body">Body</TabsTrigger>
          {timing !== undefined && <TabsTrigger value="timing">Timing</TabsTrigger>}
        </TabsList>
        <TabsContent value="headers" className="min-h-0 flex-1">
          <ScrollArea className="h-[calc(100vh-220px)]">
            <table className="w-full select-text text-xs">
              <tbody>
                {Object.entries(message.headers).map(([key, value]) => (
                  <tr key={key} className="border-b">
                    <td className="w-1/3 py-1 pr-2 font-medium text-muted-foreground">{key}</td>
                    <td className="break-all py-1 font-mono">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        </TabsContent>
        <TabsContent value="body" className="min-h-0 flex-1">
          <div className="h-[calc(100vh-220px)] rounded-md border bg-muted/20">
            {bodyContent ? (
              <SyntaxHighlight content={bodyContent} language={language} />
            ) : (
              <div className="p-3 text-xs text-muted-foreground">No body</div>
            )}
          </div>
        </TabsContent>
        {timing !== undefined && (
          <TabsContent value="timing" className="min-h-0 flex-1">
            <div className="space-y-2 p-3 text-sm">
              {status !== undefined && <div>Status: {status}</div>}
              <div>Duration: {timing}ms</div>
              {message.body?.size !== undefined && <div>Body size: {message.body.size} bytes</div>}
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

interface CaptureDetailProps {
  entry: CaptureEntry | null;
}

export function RequestPane({ entry }: CaptureDetailProps) {
  return (
    <div className="flex h-full flex-col">
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
      status={entry?.status}
      timing={entry?.durationMs}
      synthetic={Boolean(entry?.matchedRuleId)}
    />
  );
}
