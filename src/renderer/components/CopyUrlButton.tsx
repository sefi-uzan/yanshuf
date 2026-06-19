import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { copyToClipboard, urlFromMatchRegex } from '@/lib/copy';
import { cn } from '@/lib/utils';

interface CopyUrlButtonProps {
  value: string;
  /** When set, unescape a URL regex before copying. */
  fromRegex?: boolean;
  className?: string;
  title?: string;
}

export function CopyUrlButton({
  value,
  fromRegex = false,
  className,
  title = 'Copy URL',
}: CopyUrlButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const text = fromRegex ? urlFromMatchRegex(value) : value;
    if (!text) return;
    const ok = await copyToClipboard(text);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn('h-7 w-7 shrink-0', className)}
      onClick={() => void handleCopy()}
      disabled={!value}
      title={title}
      aria-label={title}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-500" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </Button>
  );
}
