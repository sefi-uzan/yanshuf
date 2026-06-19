import { cn } from '@/lib/utils';
import iconSrc from '../../../assets/icon.png';

interface LogoProps {
  className?: string;
  showName?: boolean;
}

export function Logo({ className, showName = true }: LogoProps) {
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <img src={iconSrc} alt="" className="h-4 w-4 grayscale" aria-hidden />
      {showName && <span className="text-sm font-semibold tracking-tight">Yanshuf</span>}
    </div>
  );
}
