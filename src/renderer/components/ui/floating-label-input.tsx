import * as React from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

const floatingLabelClassName = cn(
  'pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-sm leading-none text-muted-foreground transition-all',
  'peer-focus:top-0 peer-focus:left-2.5 peer-focus:-translate-y-1/2 peer-focus:bg-background peer-focus:px-1 peer-focus:text-xs',
  'peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:left-2.5 peer-[:not(:placeholder-shown)]:-translate-y-1/2 peer-[:not(:placeholder-shown)]:bg-background peer-[:not(:placeholder-shown)]:px-1 peer-[:not(:placeholder-shown)]:text-xs',
);

const borderLabelClassName =
  'pointer-events-none absolute left-2.5 top-0 z-10 -translate-y-1/2 bg-background px-1 text-xs leading-none text-muted-foreground';

export const FloatingLabelInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { label: string; wrapperClassName?: string }
>(({ className, label, id, wrapperClassName, placeholder: _placeholder, ...props }, ref) => {
  const generatedId = React.useId();
  const inputId = id ?? generatedId;

  return (
    <div className={cn('relative w-full overflow-visible', wrapperClassName)}>
      <Input
        ref={ref}
        id={inputId}
        placeholder=" "
        className={cn('peer', className)}
        {...props}
      />
      <label htmlFor={inputId} className={floatingLabelClassName}>
        {label}
      </label>
    </div>
  );
});
FloatingLabelInput.displayName = 'FloatingLabelInput';

export const FloatingLabelTextarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; wrapperClassName?: string }
>(({ className, label, id, wrapperClassName, placeholder: _placeholder, ...props }, ref) => {
  const generatedId = React.useId();
  const inputId = id ?? generatedId;

  return (
    <div className={cn('relative w-full overflow-visible', wrapperClassName)}>
      <textarea
        ref={ref}
        id={inputId}
        placeholder=" "
        className={cn(
          'flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 pb-2 pt-5 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      />
      <label htmlFor={inputId} className={borderLabelClassName}>
        {label}
      </label>
    </div>
  );
});
FloatingLabelTextarea.displayName = 'FloatingLabelTextarea';

interface FloatingLabelSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  wrapperClassName?: string;
}

export const FloatingLabelSelect = React.forwardRef<HTMLSelectElement, FloatingLabelSelectProps>(
  ({ className, label, id, wrapperClassName, ...props }, ref) => {
    const generatedId = React.useId();
    const selectId = id ?? generatedId;

    return (
      <div className={cn('relative w-full overflow-visible', wrapperClassName)}>
        <select
          ref={ref}
          id={selectId}
          className={cn(
            'flex h-9 w-full appearance-none rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
          {...props}
        />
        <label htmlFor={selectId} className={borderLabelClassName}>
          {label}
        </label>
      </div>
    );
  },
);
FloatingLabelSelect.displayName = 'FloatingLabelSelect';
