import { Activity, PenLine, Settings, Zap } from 'lucide-react';
import { Badge, Button } from '@yanshuf/ui';
import { ShortcutHint } from '@/components/shortcut-hints';
import { cn } from '@yanshuf/ui/lib/utils';
import type { DetailMode } from '@/features/capture/detailMode';
import { SHORTCUTS } from '@yanshuf/shared';

interface AppHeaderProps {
  detailMode: DetailMode;
  onToggleDetailMode: (mode: DetailMode) => void;
  onOpenSettings: () => void;
  entryCount: number;
}

function ToolbarDivider() {
  return <div className="mx-0.5 h-4 w-px shrink-0 bg-border/70" aria-hidden />;
}

function CaptureCounter({ count }: { count: number }) {
  const formatted = count.toLocaleString();

  return (
    <Badge
      variant="outline"
      className="gap-1.5 border-border bg-background/60 px-2 py-1 font-medium text-muted-foreground"
      title={`${formatted} captured request${count === 1 ? '' : 's'}`}
    >
      <Activity className="h-3.5 w-3.5 opacity-70" aria-hidden />
      <span className="tabular-nums">{formatted}</span>
      <span className="text-muted-foreground/70">captured</span>
    </Badge>
  );
}

export function AppHeader({
  detailMode,
  onToggleDetailMode,
  onOpenSettings,
  entryCount,
}: AppHeaderProps) {
  return (
    <header className="grid grid-cols-[1fr_auto_1fr] items-center border-b px-4 py-2">
      <div className="col-start-2 flex min-w-0 justify-center">
        <div
          data-tour="rules-composer"
          className={cn(
            'inline-flex items-center gap-0.5 rounded-[10px] border border-border/50 bg-muted/20 p-0.5',
            'shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.04)]',
          )}
        >
          <Button
            variant={detailMode === 'rules' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 rounded-[7px] px-2.5"
            onClick={() => onToggleDetailMode('rules')}
          >
            <Zap className="mr-1 h-3.5 w-3.5" />
            Rules
            <ShortcutHint keys={SHORTCUTS.autoResponder.keys} className="ml-1.5" />
          </Button>

          <Button
            variant={detailMode === 'composer' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 rounded-[7px] px-2.5"
            onClick={() => onToggleDetailMode('composer')}
          >
            <PenLine className="mr-1 h-3.5 w-3.5" />
            Composer
            <ShortcutHint keys={SHORTCUTS.composer.keys} className="ml-1.5" />
          </Button>

          <ToolbarDivider />

          <Button variant="ghost" size="sm" className="h-7 rounded-[7px] px-2.5" onClick={onOpenSettings}>
            <Settings className="mr-1 h-3.5 w-3.5" />
            Settings
            <ShortcutHint keys={SHORTCUTS.settings.keys} className="ml-1.5" />
          </Button>
        </div>
      </div>
      <div className="col-start-3 flex justify-end">
        <CaptureCounter count={entryCount} />
      </div>
    </header>
  );
}
