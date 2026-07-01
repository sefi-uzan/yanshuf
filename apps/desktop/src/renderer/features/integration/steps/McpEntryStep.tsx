import { Button } from '@yanshuf/ui';
import { cn } from '@yanshuf/ui/lib/utils';
import { Loader2 } from 'lucide-react';
import type { IntegrationStepResult } from '@yanshuf/shared';
import { CLIENT_LABEL, type IntegrationClient } from '@yanshuf/shared';

interface McpEntryStepProps {
  client: IntegrationClient;
  busy: boolean;
  result?: IntegrationStepResult;
  onInstall: () => void;
}

export function McpEntryStep({ client, busy, result, onInstall }: McpEntryStepProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Add MCP entry</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Registers the Yanshuf MCP server in {CLIENT_LABEL[client]} config.
        </p>
      </div>
      {result && (
        <p
          className={cn(
            'break-words text-sm',
            result.ok ? 'text-emerald-600' : 'text-destructive',
          )}
        >
          {result.message}
        </p>
      )}
      <Button className="w-full" size="lg" onClick={onInstall} disabled={busy}>
        {busy ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Installing…
          </>
        ) : (
          'Install MCP entry'
        )}
      </Button>
    </div>
  );
}
