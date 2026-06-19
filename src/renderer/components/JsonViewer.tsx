import { useCallback, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  collectCollapsiblePaths,
  collapsibleChildCount,
  formatJson,
  isCollapsibleJson,
  tryParseJson,
  type JsonValue,
} from '../../shared/json';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SyntaxHighlight } from '@/components/SyntaxHighlight';
import { cn } from '@/lib/utils';

interface JsonViewerProps {
  content: string;
  className?: string;
}

interface JsonNodeProps {
  name?: string | number;
  value: JsonValue;
  path: string;
  depth: number;
  collapsedPaths: ReadonlySet<string>;
  onToggle: (path: string) => void;
  isLast?: boolean;
}

export function JsonViewer({ content, className }: JsonViewerProps) {
  const parsed = useMemo(() => tryParseJson(content), [content]);
  const formatted = useMemo(() => formatJson(content), [content]);
  const allPaths = useMemo(
    () => (parsed !== null ? collectCollapsiblePaths(parsed) : []),
    [parsed],
  );
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(() => new Set());

  const togglePath = useCallback((path: string) => {
    setCollapsedPaths((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setCollapsedPaths(new Set());
  }, []);

  const collapseAll = useCallback(() => {
    setCollapsedPaths(new Set(allPaths));
  }, [allPaths]);

  if (parsed === null || formatted === null) {
    return <SyntaxHighlight content={content} language="json" />;
  }

  const hasCollapsibleNodes = allPaths.length > 0;

  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)}>
      {hasCollapsibleNodes && (
        <div className="flex items-center gap-1 border-b px-2 py-1.5">
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={expandAll}>
            Expand all
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={collapseAll}>
            Collapse all
          </Button>
        </div>
      )}
      <ScrollArea className="min-h-0 flex-1">
        <div className="select-text p-3 font-mono text-xs leading-5">
          <JsonNode
            value={parsed}
            path="$"
            depth={0}
            collapsedPaths={collapsedPaths}
            onToggle={togglePath}
            isLast
          />
        </div>
      </ScrollArea>
    </div>
  );
}

function JsonNode({ name, value, path, depth, collapsedPaths, onToggle, isLast = false }: JsonNodeProps) {
  const isCollapsed = collapsedPaths.has(path);
  const suffix = isLast ? '' : ',';

  if (!isCollapsibleJson(value)) {
    return (
      <div className="whitespace-pre-wrap break-all" style={{ paddingLeft: depth * 16 }}>
        {name !== undefined && (
          <>
            <span className="text-sky-600 dark:text-sky-400">{formatKey(name)}</span>
            <span className="text-muted-foreground">: </span>
          </>
        )}
        <PrimitiveValue value={value} />
        <span className="text-muted-foreground">{suffix}</span>
      </div>
    );
  }

  const childCount = collapsibleChildCount(value);
  const isEmpty = childCount === 0;
  const openBracket = Array.isArray(value) ? '[' : '{';
  const closeBracket = Array.isArray(value) ? ']' : '}';

  if (isEmpty) {
    return (
      <div style={{ paddingLeft: depth * 16 }}>
        {name !== undefined && (
          <>
            <span className="text-sky-600 dark:text-sky-400">{formatKey(name)}</span>
            <span className="text-muted-foreground">: </span>
          </>
        )}
        <span className="text-muted-foreground">{openBracket}{closeBracket}</span>
        <span className="text-muted-foreground">{suffix}</span>
      </div>
    );
  }

  if (isCollapsed) {
    return (
      <div style={{ paddingLeft: depth * 16 }}>
        <button
          type="button"
          aria-label="Expand"
          className="mr-1 inline-flex align-middle text-muted-foreground hover:text-foreground"
          onClick={() => onToggle(path)}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
        {name !== undefined && (
          <>
            <span className="text-sky-600 dark:text-sky-400">{formatKey(name)}</span>
            <span className="text-muted-foreground">: </span>
          </>
        )}
        <span className="text-muted-foreground">{openBracket}</span>
        <span className="text-muted-foreground/80"> … </span>
        <span className="text-muted-foreground">{closeBracket}</span>
        <span className="ml-1 text-[10px] text-muted-foreground/80">
          {childCount} {childCount === 1 ? 'item' : 'items'}
        </span>
        <span className="text-muted-foreground">{suffix}</span>
      </div>
    );
  }

  const entries = Array.isArray(value)
    ? value.map((item, index) => [index, item] as const)
    : Object.entries(value);

  return (
    <div>
      <div style={{ paddingLeft: depth * 16 }}>
        <button
          type="button"
          aria-label="Collapse"
          className="mr-1 inline-flex align-middle text-muted-foreground hover:text-foreground"
          onClick={() => onToggle(path)}
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        {name !== undefined && (
          <>
            <span className="text-sky-600 dark:text-sky-400">{formatKey(name)}</span>
            <span className="text-muted-foreground">: </span>
          </>
        )}
        <span className="text-muted-foreground">{openBracket}</span>
      </div>
      {entries.map(([key, childValue], index) => (
        <JsonNode
          key={`${path}-${String(key)}`}
          name={key}
          value={childValue}
          path={Array.isArray(value) ? `${path}[${key}]` : `${path}.${String(key)}`}
          depth={depth + 1}
          collapsedPaths={collapsedPaths}
          onToggle={onToggle}
          isLast={index === entries.length - 1}
        />
      ))}
      <div style={{ paddingLeft: depth * 16 }}>
        <span className="text-muted-foreground">{closeBracket}</span>
        <span className="text-muted-foreground">{suffix}</span>
      </div>
    </div>
  );
}

function PrimitiveValue({ value }: { value: Exclude<JsonValue, JsonValue[] | Record<string, JsonValue>> }) {
  if (value === null) {
    return <span className="text-violet-600 dark:text-violet-400">null</span>;
  }
  if (typeof value === 'boolean') {
    return <span className="text-violet-600 dark:text-violet-400">{String(value)}</span>;
  }
  if (typeof value === 'number') {
    return <span className="text-amber-600 dark:text-amber-400">{String(value)}</span>;
  }
  return (
    <span className="whitespace-pre-wrap break-all text-emerald-600 dark:text-emerald-400">
      &quot;{escapeString(value)}&quot;
    </span>
  );
}

function formatKey(name: string | number): string {
  return typeof name === 'number' ? String(name) : `"${escapeString(name)}"`;
}

function escapeString(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}
