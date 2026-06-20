import type { ReactNode } from 'react';
import { cn } from '@yanshuf/ui/lib/utils';

interface SettingsSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function SettingsSection({ title, description, children, className }: SettingsSectionProps) {
  return (
    <section className={cn('space-y-3', className)}>
      <div>
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
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
