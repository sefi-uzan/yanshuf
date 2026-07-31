import { useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import { Input } from '@yanshuf/ui';
import { cn } from '@yanshuf/ui/lib/utils';

interface SettingsSectionProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function SettingsSection({
  title,
  description,
  actions,
  children,
  className,
}: SettingsSectionProps) {
  return (
    <section className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{actions}</div>
        ) : null}
      </div>
      {children}
    </section>
  );
}

interface SettingsCardProps {
  children: ReactNode;
  className?: string;
}

export function SettingsCard({ children, className }: SettingsCardProps) {
  return (
    <div className={cn('rounded-lg border bg-card/50 p-4 shadow-sm backdrop-blur-sm', className)}>
      {children}
    </div>
  );
}

interface SettingsFieldProps {
  id: string;
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}

export function SettingsField({ id, label, hint, children }: SettingsFieldProps) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium leading-none">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

interface NumberFieldProps
  extends Omit<ComponentProps<typeof Input>, 'id' | 'value' | 'onChange' | 'type'> {
  id: string;
  label: string;
  value: number;
  hint?: string;
  onCommit: (value: number) => void;
}

/**
 * Commits on blur or Enter rather than on every keystroke. These values restart the
 * proxy or resize the ring buffer, so committing mid-typing would thrash them.
 */
export function NumberField({
  id,
  label,
  value,
  hint,
  onCommit,
  disabled,
  className,
  ...inputProps
}: NumberFieldProps) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = () => {
    const parsed = Number(draft);
    if (!Number.isFinite(parsed)) {
      setDraft(String(value));
      return;
    }
    if (parsed !== value) onCommit(parsed);
  };

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <Input
        id={id}
        type="number"
        className={cn('h-8', className)}
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.currentTarget.blur();
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            setDraft(String(value));
          }
        }}
        {...inputProps}
      />
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

interface SettingsToggleProps {
  label: string;
  description?: ReactNode;
  children: ReactNode;
}

/** Label + description on the left, control on the right. */
export function SettingsToggle({ label, description, children }: SettingsToggleProps) {
  return (
    <div className="flex items-start justify-between gap-3 p-3">
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-medium">{label}</p>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <div className="shrink-0 pt-0.5">{children}</div>
    </div>
  );
}

interface SettingsFooterProps {
  children: ReactNode;
  className?: string;
}

export function SettingsFooter({ children, className }: SettingsFooterProps) {
  return (
    <div
      className={cn(
        'sticky bottom-0 -mx-6 -mb-6 mt-6 flex items-center justify-end gap-2 border-t bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80',
        className,
      )}
    >
      {children}
    </div>
  );
}

interface SettingsAlertProps {
  variant: 'warning' | 'success' | 'info';
  children: ReactNode;
  action?: ReactNode;
}

const alertStyles = {
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-100',
  success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100',
  info: 'border-border bg-muted/50 text-foreground',
};

export function SettingsAlert({ variant, children, action }: SettingsAlertProps) {
  return (
    <div className={cn('rounded-lg border p-4 text-sm', alertStyles[variant])}>
      <div className="space-y-3">
        <div>{children}</div>
        {action}
      </div>
    </div>
  );
}

interface SettingsDangerZoneProps {
  title?: string;
  description?: string;
  children: ReactNode;
}

export function SettingsDangerZone({
  title = 'Danger zone',
  description = 'These actions are destructive and may affect HTTPS interception.',
  children,
}: SettingsDangerZoneProps) {
  return (
    <SettingsSection title={title} description={description}>
      <SettingsCard className="border-destructive/20 bg-destructive/[0.03]">{children}</SettingsCard>
    </SettingsSection>
  );
}
