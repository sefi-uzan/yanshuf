import { useEffect, useState } from 'react';
import type { CaptureEntry, InterceptModifications } from '@yanshuf/shared';
import {
  Badge,
  Button,
  FloatingLabelInput,
  FloatingLabelTextarea,
  ScrollArea,
} from '@yanshuf/ui';
import { WorkspaceSectionCard } from '@/components/workspace/WorkspaceShell';
import { methodBadgeClass } from '@/components/workspace/method-styles';
import { cn } from '@yanshuf/ui/lib/utils';
import { ArrowRight, PauseCircle, XCircle } from 'lucide-react';

interface BreakpointPanelProps {
  entry: CaptureEntry;
  onResolved: () => void;
}

export function BreakpointPanel({ entry, onResolved }: BreakpointPanelProps) {
  const breakpoint = entry.awaitingBreakpoint;
  const isResponse = breakpoint?.phase === 'response';

  const [headersDraft, setHeadersDraft] = useState('{}');
  const [bodyDraft, setBodyDraft] = useState('');
  const [status, setStatus] = useState(200);

  useEffect(() => {
    if (isResponse) {
      setHeadersDraft(JSON.stringify(entry.server.headers, null, 2));
      setBodyDraft(entry.server.body?.preview ?? entry.server.body?.content ?? '');
      setStatus(entry.status || 200);
      return;
    }
    setHeadersDraft(JSON.stringify(entry.client.headers, null, 2));
    setBodyDraft(entry.client.body?.preview ?? entry.client.body?.content ?? '');
  }, [entry.id, isResponse, entry.client, entry.server, entry.status]);

  if (!breakpoint) return null;

  const buildModifications = (): InterceptModifications => {
    let headers: Record<string, string> | undefined;
    try {
      headers = JSON.parse(headersDraft) as Record<string, string>;
    } catch {
      headers = isResponse ? entry.server.headers : entry.client.headers;
    }
    return isResponse
      ? { status, headers, body: bodyDraft }
      : { headers, body: bodyDraft };
  };

  const handleContinue = () => {
    void window.yanshuf.intercept
      .continueBreakpoint(breakpoint.breakpointId, buildModifications())
      .then(onResolved);
  };

  const handleAbort = () => {
    void window.yanshuf.intercept.abortBreakpoint(breakpoint.breakpointId).then(onResolved);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b bg-orange-500/[0.06] px-3 py-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400">
          <PauseCircle className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h2 className="text-sm font-semibold tracking-tight">Breakpoint paused</h2>
            <Badge
              variant="outline"
              className="h-4 border-orange-500/30 px-1.5 text-[9px] font-semibold uppercase text-orange-700 dark:text-orange-400"
            >
              {breakpoint.phase}
            </Badge>
            <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
              {breakpoint.ruleName}
            </Badge>
          </div>
          <p className="mt-0.5 flex min-w-0 items-center gap-1.5 truncate font-mono text-[11px] text-muted-foreground">
            <Badge
              variant="outline"
              className={cn('h-4 shrink-0 px-1 font-mono text-[9px]', methodBadgeClass(entry.method))}
            >
              {entry.method}
            </Badge>
            <span className="truncate">{entry.url}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleAbort}>
            <XCircle className="mr-1 h-3.5 w-3.5" />
            Abort
          </Button>
          <Button size="sm" onClick={handleContinue}>
            <ArrowRight className="mr-1 h-3.5 w-3.5" />
            Continue
          </Button>
        </div>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 p-4">
          <WorkspaceSectionCard
            accent="orange"
            title={`Edit ${breakpoint.phase}`}
            description="Changes apply when you continue. Leave fields unchanged to pass through original values."
          >
            <div className="space-y-3">
              {isResponse && (
                <FloatingLabelInput
                  type="number"
                  label="Status"
                  value={status}
                  onChange={(e) => setStatus(Number(e.target.value))}
                />
              )}
              <FloatingLabelTextarea
                className="min-h-[96px] font-mono text-xs"
                label={`${breakpoint.phase} headers (JSON object)`}
                value={headersDraft}
                onChange={(e) => setHeadersDraft(e.target.value)}
              />
              <FloatingLabelTextarea
                className="min-h-[160px] font-mono text-xs"
                label={`${breakpoint.phase} body`}
                value={bodyDraft}
                onChange={(e) => setBodyDraft(e.target.value)}
              />
            </div>
          </WorkspaceSectionCard>
        </div>
      </ScrollArea>
    </div>
  );
}
