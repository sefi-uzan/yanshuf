import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@yanshuf/ui';
import { Bot } from 'lucide-react';
import type { IntegrationClient } from '@yanshuf/shared';

interface PostCertIntegrationPromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChooseClient: (client: IntegrationClient) => void;
  onDismiss: () => void;
}

export function PostCertIntegrationPrompt({
  open,
  onOpenChange,
  onChooseClient,
  onDismiss,
}: PostCertIntegrationPromptProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 p-0">
        <div className="border-b px-6 py-5">
          <DialogHeader className="space-y-3 text-left">
            <div className="flex items-center gap-2 text-teal-600 dark:text-teal-400">
              <Bot className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-wide">Optional</span>
            </div>
            <DialogTitle>Connect to Cursor or Claude Code?</DialogTitle>
            <DialogDescription>
              Yanshuf can install its MCP server, the /yanshuf skill, and a session cleanup hook so
              AI assistants can inspect and debug your traffic.
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="space-y-3 px-6 py-5">
          <Button className="w-full" onClick={() => onChooseClient('cursor')}>
            Set up Cursor
          </Button>
          <Button className="w-full" variant="outline" onClick={() => onChooseClient('claude-code')}>
            Set up Claude Code
          </Button>
          <Button
            className="w-full"
            variant="ghost"
            onClick={() => {
              onDismiss();
              onOpenChange(false);
            }}
          >
            Not now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
