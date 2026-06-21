import type { MapRemoteRule } from '@yanshuf/shared';
import { FloatingLabelInput, FloatingLabelSelect } from '@yanshuf/ui';
import { CopyUrlButton } from '@/components/CopyUrlButton';

interface MapRemoteRuleEditorProps {
  selected: MapRemoteRule;
  onUpdate: (patch: Partial<MapRemoteRule>) => void;
}

export function MapRemoteRuleEditor({ selected, onUpdate }: MapRemoteRuleEditorProps) {
  const protocolValue = selected.mapTo.protocol ?? 'preserve';

  return (
    <div className="animate-in fade-in slide-in-from-right-2 space-y-3 duration-200">
      <FloatingLabelInput
        label="Rule name"
        value={selected.name}
        onChange={(e) => onUpdate({ name: e.target.value })}
      />
      <div className="flex w-full items-center gap-1">
        <div className="min-w-0 flex-1">
          <FloatingLabelInput
            className="font-mono"
            label="URL regex"
            value={selected.match.urlRegex ?? ''}
            onChange={(e) => onUpdate({ match: { ...selected.match, urlRegex: e.target.value } })}
          />
        </div>
        <CopyUrlButton value={selected.match.urlRegex ?? ''} fromRegex title="Copy match URL" />
      </div>
      <div className="rounded-lg border bg-muted/10 p-3 space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Map to
        </p>
        <FloatingLabelInput
          className="font-mono"
          label="Host"
          value={selected.mapTo.host}
          onChange={(e) => onUpdate({ mapTo: { ...selected.mapTo, host: e.target.value } })}
        />
        <div className="grid grid-cols-2 gap-2">
          <FloatingLabelInput
            type="number"
            label="Port (optional)"
            value={selected.mapTo.port ?? ''}
            onChange={(e) => {
              const raw = e.target.value;
              onUpdate({
                mapTo: {
                  ...selected.mapTo,
                  port: raw === '' ? undefined : Number(raw),
                },
              });
            }}
          />
          <FloatingLabelSelect
            label="Protocol"
            value={protocolValue}
            onChange={(e) =>
              onUpdate({
                mapTo: {
                  ...selected.mapTo,
                  protocol: e.target.value === 'preserve' ? undefined : (e.target.value as 'http' | 'https'),
                },
              })
            }
          >
            <option value="preserve">Preserve</option>
            <option value="http">HTTP</option>
            <option value="https">HTTPS</option>
          </FloatingLabelSelect>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Path and query from the original request are preserved.
        </p>
      </div>
    </div>
  );
}
