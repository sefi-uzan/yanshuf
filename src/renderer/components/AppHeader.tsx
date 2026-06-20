import { PenLine, Settings, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExpandableSearch } from '@/components/ExpandableSearch';
import { Logo } from '@/components/Logo';
import { ShortcutHint } from '@/components/shortcut-hints';
import { cn } from '@/lib/utils';
import type { DetailMode } from '@/features/capture/detailMode';
import { SHORTCUTS } from '../../shared/shortcuts';

interface AppHeaderProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  searchOpen: boolean;
  onSearchOpenChange: (open: boolean) => void;
  detailMode: DetailMode;
  onToggleDetailMode: (mode: DetailMode) => void;
  onOpenSettings: () => void;
}

function ToolbarDivider() {
  return <div className="mx-0.5 h-4 w-px shrink-0 bg-border/70" aria-hidden />;
}

export function AppHeader({
  searchQuery,
  onSearchChange,
  searchOpen,
  onSearchOpenChange,
  detailMode,
  onToggleDetailMode,
  onOpenSettings,
}: AppHeaderProps) {
  return (
    <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b px-4 py-2">
      <Logo className="justify-self-start" />

      <div
        data-tour="rules-composer"
        className={cn(
          'inline-flex items-center gap-0.5 rounded-[10px] border border-border/50 bg-muted/20 p-0.5',
          'shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.04)]',
        )}
      >
        <ExpandableSearch
          value={searchQuery}
          onChange={onSearchChange}
          open={searchOpen}
          onOpenChange={onSearchOpenChange}
        />

        <ToolbarDivider />

        <Button
          variant={detailMode === 'rules' ? 'secondary' : 'ghost'}
          size="sm"
          className="h-7 rounded-[7px] px-2.5"
          onClick={() => onToggleDetailMode('rules')}
        >
          <Zap className="mr-1 h-3.5 w-3.5" />
          Rules
          <ShortcutHint keys={SHORTCUTS.autoResponder.keys} className="ml-1.5" reserveSpace />
        </Button>

        <Button
          variant={detailMode === 'composer' ? 'secondary' : 'ghost'}
          size="sm"
          className="h-7 rounded-[7px] px-2.5"
          onClick={() => onToggleDetailMode('composer')}
        >
          <PenLine className="mr-1 h-3.5 w-3.5" />
          Composer
          <ShortcutHint keys={SHORTCUTS.composer.keys} className="ml-1.5" reserveSpace />
        </Button>
      </div>

      <div className="justify-self-end">
        <Button variant="ghost" size="sm" className="h-8" onClick={onOpenSettings}>
          <Settings className="mr-1 h-4 w-4" />
          Settings
          <ShortcutHint keys={SHORTCUTS.settings.keys} className="ml-2" reserveSpace />
        </Button>
      </div>
    </header>
  );
}
