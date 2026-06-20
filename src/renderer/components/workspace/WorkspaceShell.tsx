import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface WorkspaceShellProps {
  title: string;
  description?: string;
  headerActions?: ReactNode;
  sidebar?: ReactNode;
  sidebarHeader?: ReactNode;
  children: ReactNode;
  empty?: boolean;
  emptyContent?: ReactNode;
  className?: string;
}

export function WorkspaceShell({
  title,
  description,
  headerActions,
  sidebar,
  sidebarHeader,
  children,
  empty,
  emptyContent,
  className,
}: WorkspaceShellProps) {
  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)}>
      <header className="flex shrink-0 items-center justify-between gap-3 border-b bg-background px-3 py-2.5">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          {description && (
            <p className="text-[11px] text-muted-foreground">{description}</p>
          )}
        </div>
        {headerActions && (
          <div className="flex shrink-0 items-center gap-2">{headerActions}</div>
        )}
      </header>

      {empty && emptyContent ? (
        emptyContent
      ) : (
        <div className="grid min-h-0 min-w-0 flex-1 grid-cols-[240px_minmax(0,1fr)] gap-0">
          {sidebar !== undefined && (
            <aside className="flex min-h-0 flex-col border-r bg-muted/10">
              {sidebarHeader}
              {sidebar}
            </aside>
          )}
          <section className="flex min-h-0 min-w-0 flex-col">{children}</section>
        </div>
      )}
    </div>
  );
}

interface WorkspaceSectionCardProps {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  accent?: 'default' | 'violet' | 'amber' | 'sky' | 'orange';
}

const ACCENT_STYLES = {
  default: 'bg-muted/20',
  violet: 'bg-violet-500/[0.04]',
  amber: 'bg-amber-500/[0.04]',
  sky: 'bg-sky-500/[0.04]',
  orange: 'bg-orange-500/[0.04]',
};

export function WorkspaceSectionCard({
  title,
  description,
  actions,
  children,
  className,
  accent = 'default',
}: WorkspaceSectionCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border p-3 shadow-sm',
        ACCENT_STYLES[accent],
        className,
      )}
    >
      {(title || actions) && (
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            {title && <p className="text-sm font-semibold">{title}</p>}
            {description && (
              <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}

interface WorkspaceEmptyCardsProps {
  heading: string;
  description: string;
  footer?: string;
  compact?: boolean;
  cards: {
    key: string;
    icon: ReactNode;
    title: string;
    description: string;
    accent: string;
    border: string;
    onClick: () => void;
  }[];
}

export function WorkspaceEmptyCards({
  heading,
  description,
  footer,
  compact,
  cards,
}: WorkspaceEmptyCardsProps) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center',
      compact ? 'px-1 py-2' : 'min-h-0 flex-1 px-6 py-10',
    )}
    >
      <div className={cn('text-center', compact ? 'mb-3' : 'mb-6')}>
        <h3 className={cn('font-semibold tracking-tight', compact ? 'text-sm' : 'text-lg')}>{heading}</h3>
        <p className={cn('text-muted-foreground', compact ? 'mt-1 text-[11px]' : 'mt-2 max-w-md text-sm')}>
          {description}
        </p>
      </div>
      <div className={cn(
        'grid w-full gap-2',
        compact && 'grid-cols-1',
        !compact && cards.length === 1 && 'max-w-sm',
        !compact && cards.length === 2 && 'max-w-2xl sm:grid-cols-2',
        !compact && cards.length >= 3 && 'max-w-2xl sm:grid-cols-3',
      )}
      >
        {cards.map(({ key, icon, title, description: cardDesc, accent, border, onClick }) => (
          <button
            key={key}
            type="button"
            onClick={onClick}
            className={cn(
              'group flex text-left transition-all duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              compact
                ? 'items-center gap-2.5 rounded-lg border bg-card/80 p-2.5'
                : 'flex-col items-start rounded-xl border bg-card p-4',
              border,
            )}
          >
            <div className={cn(
              'flex shrink-0 items-center justify-center rounded-lg bg-muted',
              compact ? 'h-8 w-8' : 'mb-3 h-10 w-10',
              accent,
            )}
            >
              {icon}
            </div>
            <div className="min-w-0">
              <span className={cn('font-semibold', compact ? 'text-xs' : 'text-sm')}>{title}</span>
              <span className={cn(
                'block text-muted-foreground',
                compact ? 'mt-0.5 text-[10px] leading-snug' : 'mt-1.5 text-xs leading-relaxed',
              )}
              >
                {cardDesc}
              </span>
              {!compact && (
                <span className="mt-3 block text-[11px] font-medium text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                  Get started →
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
      {footer && !compact && (
        <p className="mt-8 max-w-md text-center text-xs text-muted-foreground">{footer}</p>
      )}
    </div>
  );
}
