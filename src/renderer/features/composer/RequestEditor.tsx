import { useMemo, useState, type ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { ComposerRequest } from '../../../shared/types';
import { exportCurl } from '../../../shared/composer-curl';
import { HTTP_METHODS, methodSupportsBody, normalizeBodyForMethod } from '../../../shared/http';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CopyUrlButton } from '@/components/CopyUrlButton';
import {
  FloatingLabelInput,
  FloatingLabelSelect,
} from '@/components/ui/floating-label-input';
import { copyToClipboard } from '@/lib/copy';
import { Check, ChevronDown, ChevronRight, Copy, Plus, X } from 'lucide-react';

export function normalizeRequest(request: ComposerRequest): ComposerRequest {
  return {
    ...request,
    body: normalizeBodyForMethod(request.method, request.body),
  };
}

interface RequestEditorProps {
  request: ComposerRequest;
  onChange: (request: ComposerRequest) => void;
  editorKey?: number;
  loading?: boolean;
  onSend?: () => void;
  sendLabel?: string;
  extraActions?: ReactNode;
  name?: string;
  onNameChange?: (name: string) => void;
}

export function RequestEditor({
  request,
  onChange,
  editorKey = 0,
  loading = false,
  onSend,
  sendLabel = 'Send Request',
  extraActions,
  name,
  onNameChange,
}: RequestEditorProps) {
  const bodyEnabled = methodSupportsBody(request.method);
  const curlPreview = useMemo(() => exportCurl(normalizeRequest(request)), [request]);

  return (
    <div className="flex min-h-0 min-w-0 flex-col gap-3 pt-2.5">
      {onNameChange && (
        <FloatingLabelInput
          label="Name"
          value={name ?? ''}
          onChange={(e) => onNameChange(e.target.value)}
        />
      )}

      <div className="flex min-w-0 items-end gap-2">
        <FloatingLabelInput
          wrapperClassName="min-w-0 flex-1"
          className="font-mono"
          label="URL"
          value={request.url}
          onChange={(e) => onChange({ ...request, url: e.target.value })}
        />
        <CopyUrlButton value={request.url} title="Copy URL" className="mb-0.5 shrink-0" />
      </div>

      <div className="flex items-end gap-2">
        <FloatingLabelSelect
          wrapperClassName="w-[112px] shrink-0"
          label="Method"
          value={request.method}
          onChange={(e) => onChange(normalizeRequest({ ...request, method: e.target.value }))}
        >
          {HTTP_METHODS.map((method) => (
            <option key={method} value={method}>{method}</option>
          ))}
        </FloatingLabelSelect>
        <div className="flex-1" />
        {extraActions}
        <CopyCurlButton value={curlPreview} className="mb-0.5 shrink-0" />
        {onSend && (
          <Button className="mb-0.5 shrink-0" onClick={onSend} disabled={loading}>
            {loading ? 'Sending…' : sendLabel}
          </Button>
        )}
      </div>

      <RequestHeadersEditor
        key={editorKey}
        headers={request.headers}
        onChange={(headers) => onChange({ ...request, headers })}
      />

      <div className="flex min-h-0 flex-1 flex-col rounded-md border">
        <div className="flex shrink-0 items-center justify-between border-b px-3 py-2 text-xs font-medium text-muted-foreground">
          <span>Body</span>
          {!bodyEnabled && (
            <span className="font-normal text-muted-foreground/70">
              {request.method.toUpperCase()} has no body
            </span>
          )}
        </div>
        <Textarea
          className="min-h-0 flex-1 resize-none rounded-none border-0 bg-muted/20 font-mono text-xs shadow-none focus-visible:ring-0 disabled:opacity-60"
          spellCheck={false}
          disabled={!bodyEnabled}
          placeholder={bodyEnabled ? 'Request body' : `${request.method.toUpperCase()} requests cannot include a body`}
          value={bodyEnabled ? (request.body ?? '') : ''}
          onChange={(e) => onChange({ ...request, body: e.target.value })}
        />
      </div>
    </div>
  );
}

function CopyCurlButton({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const ok = await copyToClipboard(value, { message: 'cURL copied to clipboard' });
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Button
      type="button"
      variant="outline"
      className={className}
      title="Copy as cURL"
      disabled={!value}
      onClick={() => void handleCopy()}
    >
      {copied ? (
        <Check className="mr-1 h-3.5 w-3.5 text-emerald-500" />
      ) : (
        <Copy className="mr-1 h-3.5 w-3.5" />
      )}
      cURL
    </Button>
  );
}

interface HeaderRow {
  id: string;
  key: string;
  value: string;
}

function headersToRows(headers: Record<string, string>): HeaderRow[] {
  return Object.entries(headers).map(([key, value]) => ({ id: uuidv4(), key, value }));
}

function rowsToHeaders(rows: HeaderRow[]): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const row of rows) {
    const key = row.key.trim();
    if (key) headers[key] = row.value;
  }
  return headers;
}

function RequestHeadersEditor({
  headers,
  onChange,
}: {
  headers: Record<string, string>;
  onChange: (headers: Record<string, string>) => void;
}) {
  const [open, setOpen] = useState(true);
  const [rows, setRows] = useState<HeaderRow[]>(() => headersToRows(headers));

  const commit = (next: HeaderRow[]) => {
    setRows(next);
    onChange(rowsToHeaders(next));
  };

  const addRow = () => {
    setOpen(true);
    commit([...rows, { id: uuidv4(), key: '', value: '' }]);
  };

  const count = rows.filter((row) => row.key.trim()).length;

  return (
    <div className="rounded-md border">
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="flex min-w-0 flex-1 items-center gap-1.5 px-3 py-2 text-left text-xs font-medium text-muted-foreground hover:bg-accent/50"
        >
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          )}
          Headers
          {count > 0 && <span className="font-normal text-muted-foreground/70">({count})</span>}
        </button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mr-1 h-7 shrink-0 px-2 text-xs"
          onClick={addRow}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add
        </Button>
      </div>
      {open && (
        <div className="border-t">
          {rows.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">
              No headers.{' '}
              <button type="button" className="text-foreground underline-offset-2 hover:underline" onClick={addRow}>
                Add one
              </button>
            </div>
          ) : (
            rows.map((row, index) => (
              <div
                key={row.id}
                className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_32px] items-center gap-2 border-b px-2 py-1.5 last:border-b-0"
              >
                <Input
                  className="h-7 font-mono text-xs"
                  placeholder="Header"
                  value={row.key}
                  onChange={(e) => {
                    const next = [...rows];
                    next[index] = { ...row, key: e.target.value };
                    commit(next);
                  }}
                />
                <Input
                  className="h-7 font-mono text-xs"
                  placeholder="Value"
                  value={row.value}
                  onChange={(e) => {
                    const next = [...rows];
                    next[index] = { ...row, value: e.target.value };
                    commit(next);
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  aria-label="Remove header"
                  onClick={() => commit(rows.filter((item) => item.id !== row.id))}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
