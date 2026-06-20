import { useEffect, useState } from 'react';
import { Toaster as Sonner } from 'sonner';
import { prefersDark } from '@/lib/theme';

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (prefersDark() ? 'dark' : 'light'));

  useEffect(() => {
    const update = () => setTheme(prefersDark() ? 'dark' : 'light');
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', update);
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', update);
    return () => {
      window.matchMedia('(prefers-color-scheme: light)').removeEventListener('change', update);
      window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', update);
    };
  }, []);

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
