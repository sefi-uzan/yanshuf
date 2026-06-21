import type { InterceptPhase, InterceptRule } from '@yanshuf/shared';
import {
  FloatingLabelInput,
  FloatingLabelSelect,
  FloatingLabelTextarea,
} from '@yanshuf/ui';
import { CopyUrlButton } from '@/components/CopyUrlButton';

interface InterceptRuleEditorProps {
  selected: InterceptRule;
  requestHeadersDraft: string;
  responseHeadersDraft: string;
  onRequestHeadersDraftChange: (value: string) => void;
  onResponseHeadersDraftChange: (value: string) => void;
  onUpdate: (patch: Partial<InterceptRule>) => void;
}

export function InterceptRuleEditor({
  selected,
  requestHeadersDraft,
  responseHeadersDraft,
  onRequestHeadersDraftChange,
  onResponseHeadersDraftChange,
  onUpdate,
}: InterceptRuleEditorProps) {
  const isRequest = selected.phase === 'request';

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
            onChange={(e) => onUpdate({ match: { urlRegex: e.target.value } })}
          />
        </div>
        <CopyUrlButton value={selected.match.urlRegex ?? ''} fromRegex title="Copy match URL" />
      </div>
      <FloatingLabelSelect
        label="Phase"
        value={selected.phase}
        onChange={(e) => onUpdate({ phase: e.target.value as InterceptPhase })}
      >
        <option value="request">Request</option>
        <option value="response">Response</option>
      </FloatingLabelSelect>

      {isRequest ? (
        <>
          <FloatingLabelTextarea
            className="min-h-[80px] font-mono text-xs"
            label="Request headers (JSON object)"
            value={requestHeadersDraft}
            onChange={(e) => {
              onRequestHeadersDraftChange(e.target.value);
              try {
                const headers = JSON.parse(e.target.value) as Record<string, string>;
                onUpdate({ request: { ...selected.request, headers } });
              } catch {
                // Allow invalid JSON while editing.
              }
            }}
          />
          <FloatingLabelTextarea
            className="font-mono text-xs"
            label="Request body override (leave empty to keep original)"
            value={selected.request?.body ?? ''}
            onChange={(e) => onUpdate({
              request: { ...selected.request, body: e.target.value },
            })}
          />
        </>
      ) : (
        <>
          <FloatingLabelInput
            type="number"
            label="Response status override"
            value={selected.response?.status ?? 200}
            onChange={(e) => onUpdate({
              response: { ...selected.response, status: Number(e.target.value) },
            })}
          />
          <FloatingLabelTextarea
            className="min-h-[80px] font-mono text-xs"
            label="Response headers (JSON object)"
            value={responseHeadersDraft}
            onChange={(e) => {
              onResponseHeadersDraftChange(e.target.value);
              try {
                const headers = JSON.parse(e.target.value) as Record<string, string>;
                onUpdate({ response: { ...selected.response, headers } });
              } catch {
                // Allow invalid JSON while editing.
              }
            }}
          />
          <FloatingLabelTextarea
            className="font-mono text-xs"
            label="Response body override (leave empty to keep original)"
            value={selected.response?.body ?? ''}
            onChange={(e) => onUpdate({
              response: { ...selected.response, body: e.target.value },
            })}
          />
        </>
      )}

      <p className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        {selected.mode === 'rewrite'
          ? 'Rewrite rules apply automatically and forward to the real backend.'
          : 'Breakpoint rules pause matching traffic in the capture list until you continue or abort.'}
      </p>
    </div>
  );
}
