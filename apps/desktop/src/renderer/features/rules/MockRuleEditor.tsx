import type { AutoResponderRule } from '@yanshuf/shared';
import { Button ,
  FloatingLabelInput,
  FloatingLabelTextarea,
} from '@yanshuf/ui';
import { CopyUrlButton } from '@/components/CopyUrlButton';
import { FolderOpen } from 'lucide-react';

interface MockRuleEditorProps {
  selected: AutoResponderRule;
  headersDraft: string;
  onHeadersDraftChange: (value: string) => void;
  onUpdate: (patch: Partial<AutoResponderRule>) => void;
}

export function MockRuleEditor({
  selected,
  headersDraft,
  onHeadersDraftChange,
  onUpdate,
}: MockRuleEditorProps) {
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
      <div className="grid grid-cols-2 gap-2">
        <FloatingLabelInput
          type="number"
          label="Status"
          value={selected.response.status}
          onChange={(e) => onUpdate({ response: { ...selected.response, status: Number(e.target.value) } })}
        />
        <FloatingLabelInput
          type="number"
          label="Delay ms"
          value={selected.response.delayMs ?? 0}
          onChange={(e) => onUpdate({ response: { ...selected.response, delayMs: Number(e.target.value) } })}
        />
      </div>
      <FloatingLabelTextarea
        className="min-h-[80px] font-mono text-xs"
        label="Response headers (JSON object)"
        value={headersDraft}
        onChange={(e) => {
          onHeadersDraftChange(e.target.value);
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
        label="Response body (inline JSON)"
        value={selected.response.body?.type === 'inline' ? selected.response.body.content : ''}
        onChange={(e) => onUpdate({
          response: {
            ...selected.response,
            body: { type: 'inline', content: e.target.value },
          },
        })}
      />
      <div className="flex gap-2">
        <FloatingLabelInput
          readOnly
          className="min-w-0 flex-1 font-mono text-xs"
          label="Response file"
          value={selected.response.body?.type === 'file' ? selected.response.body.path : ''}
        />
        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={() => {
            void window.yanshuf.dialog.pickFile({ title: 'Select response file' }).then((filePath) => {
              if (!filePath) return;
              onUpdate({
                response: {
                  ...selected.response,
                  body: { type: 'file', path: filePath },
                },
              });
            });
          }}
        >
          <FolderOpen className="mr-1 h-3.5 w-3.5" />
          Browse
        </Button>
        {selected.response.body?.type === 'file' && (
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => onUpdate({
              response: {
                ...selected.response,
                body: { type: 'inline', content: '' },
              },
            })}
          >
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
