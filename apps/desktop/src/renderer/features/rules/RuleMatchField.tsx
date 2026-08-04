import type { RuleMatch, UrlMatchMode } from '@yanshuf/shared';
import { normalizeRuleMatch } from '@yanshuf/shared';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  FloatingLabelInput,
} from '@yanshuf/ui';
import { cn } from '@yanshuf/ui/lib/utils';
import { CopyUrlButton } from '@/components/CopyUrlButton';
import { Check, ChevronDown } from 'lucide-react';

const MODES: { value: UrlMatchMode; label: string; field: string; hint: string }[] = [
  {
    value: 'prefix',
    label: 'Starts with',
    field: 'URL starts with',
    hint: 'Matches any URL on this host that begins with the path given. A host on its own matches every request to it.',
  },
  {
    value: 'exact',
    label: 'Exact',
    field: 'Exact URL',
    hint: 'The whole URL must match, query string included. The scheme and a trailing slash are ignored.',
  },
  {
    value: 'regex',
    label: 'Regex',
    field: 'URL regex',
    hint: 'Unanchored regular expression tested against the full URL. Use ^ and $ to anchor it.',
  },
];

interface RuleMatchFieldProps {
  match: RuleMatch;
  onChange: (match: RuleMatch) => void;
}

export function RuleMatchField({ match, onChange }: RuleMatchFieldProps) {
  const { pattern, mode } = normalizeRuleMatch(match);
  const active = MODES.find((option) => option.value === mode) ?? MODES[0]!;

  return (
    <div className="space-y-1">
      <div className="flex w-full items-center gap-1">
        <div className="min-w-0 flex-1">
          <FloatingLabelInput
            className="font-mono"
            label={active.field}
            value={pattern}
            onChange={(e) => onChange({ pattern: e.target.value, mode })}
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 shrink-0 gap-1 px-2 text-xs font-medium"
              aria-label="URL match mode"
            >
              {active.label}
              <ChevronDown className="h-3 w-3 opacity-50" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="p-1">
            {MODES.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onClick={() => onChange({ pattern, mode: option.value })}
                className="gap-2 rounded-sm px-2 py-1.5 text-xs"
              >
                <Check
                  className={cn('h-3.5 w-3.5', mode === option.value ? 'opacity-100' : 'opacity-0')}
                  aria-hidden
                />
                {option.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <CopyUrlButton value={pattern} fromRegex={mode === 'regex'} title="Copy match URL" />
      </div>
      <p className="px-1 text-[11px] text-muted-foreground">{active.hint}</p>
    </div>
  );
}
