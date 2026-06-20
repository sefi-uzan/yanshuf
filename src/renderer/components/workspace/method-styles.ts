export function methodBorderClass(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET':
      return 'border-l-emerald-500';
    case 'POST':
      return 'border-l-sky-500';
    case 'PUT':
      return 'border-l-amber-500';
    case 'PATCH':
      return 'border-l-orange-500';
    case 'DELETE':
      return 'border-l-red-500';
    case 'HEAD':
    case 'OPTIONS':
      return 'border-l-slate-400';
    default:
      return 'border-l-violet-500';
  }
}

export function methodBadgeClass(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET':
      return 'border-emerald-500/30 text-emerald-700 dark:text-emerald-400';
    case 'POST':
      return 'border-sky-500/30 text-sky-700 dark:text-sky-400';
    case 'PUT':
      return 'border-amber-500/30 text-amber-700 dark:text-amber-400';
    case 'PATCH':
      return 'border-orange-500/30 text-orange-700 dark:text-orange-400';
    case 'DELETE':
      return 'border-red-500/30 text-red-700 dark:text-red-400';
    default:
      return 'border-violet-500/30 text-violet-700 dark:text-violet-400';
  }
}

export function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
