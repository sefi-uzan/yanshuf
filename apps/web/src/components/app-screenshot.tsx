import Image from 'next/image';
import { cn } from '@yanshuf/ui/lib/utils';

type AppScreenshotProps = {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  priority?: boolean;
  variant?: 'default' | 'hero';
};

export function AppScreenshot({
  src,
  alt,
  width,
  height,
  className,
  priority = false,
  variant = 'default',
}: AppScreenshotProps) {
  const isHero = variant === 'hero';

  return (
    <div
      className={cn(
        isHero
          ? 'overflow-hidden rounded-xl'
          : 'overflow-hidden rounded-xl border border-border/80 bg-card shadow-2xl shadow-black/40',
        className,
      )}
    >
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        quality={92}
        className="h-auto w-full"
        sizes={
          isHero
            ? '(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 1152px'
            : '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 576px'
        }
      />
    </div>
  );
}
