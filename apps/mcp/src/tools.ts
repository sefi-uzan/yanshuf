import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { YanshufApiClient } from './client.js';

/** Per-string cap for tool results; capture bodies can reach megabytes otherwise. */
export const DEFAULT_BODY_CHARS = 4096;

/**
 * Deep-truncate every string longer than maxChars. Only body previews and
 * payloads ever exceed the cap, so this is safe to apply to whole responses.
 */
export function truncateLargeStrings<T>(value: T, maxChars: number): T {
  if (typeof value === 'string') {
    if (value.length <= maxChars) return value;
    return `${value.slice(0, maxChars)}… [truncated ${value.length - maxChars} of ${value.length} chars; pass a larger maxBodyChars to see more]` as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => truncateLargeStrings(item, maxChars)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = truncateLargeStrings(item, maxChars);
    }
    return out as T;
  }
  return value;
}

function textResult(data: unknown, maxBodyChars?: number) {
  const capped = maxBodyChars === undefined ? data : truncateLargeStrings(data, maxBodyChars);
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(capped) }],
  };
}

const maxBodyCharsSchema = z
  .number()
  .optional()
  .describe(
    `Per-string cap on bodies in the result (default ${DEFAULT_BODY_CHARS}). Increase only when you need more of a large body.`,
  );

/** Shared by every rule tool so match semantics are described in exactly one place. */
const ruleMatchSchema = {
  url: z
    .string()
    .optional()
    .describe(
      'URL to match. Interpreted according to matchMode. The scheme is optional for exact and prefix.',
    ),
  matchMode: z
    .enum(['regex', 'exact', 'prefix'])
    .optional()
    .describe(
      "How to match `url`. 'prefix' (default) matches the host plus everything under the given path, 'exact' requires the whole URL including query, 'regex' tests an unanchored regular expression against the full URL.",
    ),
  urlRegex: z
    .string()
    .optional()
    .describe('Deprecated. Same as passing url with matchMode "regex".'),
};

const ruleTypeSchema = z
  .enum(['mock', 'intercept', 'map-remote'])
  .describe(
    "'mock' returns a canned response, 'intercept' rewrites or breakpoints live traffic, 'map-remote' forwards matching requests to another host.",
  );

type RuleType = z.infer<typeof ruleTypeSchema>;

export function registerTools(server: McpServer, client: YanshufApiClient): void {
  server.registerTool(
    'yanshuf_status',
    {
      description:
        'Get Yanshuf capture status. Call this before yanshuf_toggle_capture. Returns capturing state, proxy port, entry count, certTrusted, and throttle settings.',
      inputSchema: {},
    },
    async () => textResult(await client.getStatus()),
  );

  server.registerTool(
    'yanshuf_toggle_capture',
    {
      description:
        'Toggle capture on or off (system proxy + MITM together). Call yanshuf_status first. Returns the state after toggle.',
      inputSchema: {},
    },
    async () => textResult(await client.toggleCapture()),
  );

  server.registerTool(
    'yanshuf_set_throttle',
    {
      description:
        'Set or disable global network throttling. Pass enabled: false to disable. Returns updated status including throttle settings.',
      inputSchema: {
        enabled: z.boolean().optional().describe('Set false to disable throttling'),
        preset: z
          .enum(['edge', '3g', 'regular-3g', 'regular-4g', 'custom'])
          .optional()
          .describe('Built-in network profile'),
        latencyMs: z.number().optional(),
        downloadKbps: z.number().optional(),
        uploadKbps: z.number().optional(),
      },
    },
    async (args) => textResult(await client.setThrottle(args)),
  );

  server.registerTool(
    'yanshuf_cleanup_session',
    {
      description:
        'End a debugging session: clear all captures and disable all mock/intercept/map-remote rules atomically. Call when the user says debugging is done.',
      inputSchema: {},
    },
    async () => textResult(await client.cleanupSession()),
  );

  server.registerTool(
    'yanshuf_search_captures',
    {
      description:
        'Search captured request summaries (latest first; default 20, max 100). Use before yanshuf_get_capture to find IDs.',
      inputSchema: {
        query: z.string().optional().describe('Free-text search across url, host, method, status'),
        url: z.string().optional(),
        host: z.string().optional(),
        method: z.string().optional(),
        status: z.string().optional(),
        limit: z.number().optional().describe('Max results (default 20, max 100)'),
      },
    },
    async (args) => textResult(await client.searchCaptures({ ...args, limit: args.limit ?? 20 })),
  );

  server.registerTool(
    'yanshuf_get_capture',
    {
      description:
        'Get full request/response details for a capture ID from yanshuf_search_captures. Bodies are truncated to maxBodyChars per string.',
      inputSchema: { id: z.string(), maxBodyChars: maxBodyCharsSchema },
    },
    async ({ id, maxBodyChars }) =>
      textResult(await client.getCapture(id), maxBodyChars ?? DEFAULT_BODY_CHARS),
  );

  server.registerTool(
    'yanshuf_wait_for_capture',
    {
      description:
        'Block until a new capture arrives or timeout. Use after triggering traffic or yanshuf_send_request; never poll yanshuf_search_captures in a loop.',
      inputSchema: {
        query: z.string().optional(),
        url: z.string().optional(),
        host: z.string().optional(),
        method: z.string().optional(),
        status: z.string().optional(),
        sinceId: z.string().optional().describe('Only captures newer than this ID'),
        timeoutMs: z.number().optional().describe('Timeout in ms (default 30000, max 120000)'),
      },
    },
    async (args) => textResult(await client.waitForCapture(args), DEFAULT_BODY_CHARS),
  );

  server.registerTool(
    'yanshuf_send_request',
    {
      description:
        'Send an HTTP request through Yanshuf proxy. Optionally pass captureId to replay a captured request. Response bodies are truncated to maxBodyChars.',
      inputSchema: {
        captureId: z.string().optional(),
        method: z.string().optional(),
        url: z.string().optional(),
        headers: z.record(z.string()).optional(),
        body: z.string().optional(),
        maxBodyChars: maxBodyCharsSchema,
      },
    },
    async (args) => {
      const cap = args.maxBodyChars ?? DEFAULT_BODY_CHARS;
      if (args.captureId) {
        return textResult(await client.sendRequest({ captureId: args.captureId }), cap);
      }
      if (!args.url) throw new Error('url is required when captureId is not provided');
      return textResult(
        await client.sendRequest({
          method: args.method,
          url: args.url,
          headers: args.headers,
          body: args.body,
        }),
        cap,
      );
    },
  );

  server.registerTool(
    'yanshuf_list_rules',
    {
      description:
        'List rules of one type (mock, intercept, or map-remote), ordered by priority (first match wins).',
      inputSchema: { ruleType: ruleTypeSchema },
    },
    async ({ ruleType }) => {
      const byType: Record<RuleType, () => Promise<unknown>> = {
        mock: () => client.listMockRules(),
        intercept: () => client.listInterceptRules(),
        'map-remote': () => client.listMapRemoteRules(),
      };
      return textResult(await byType[ruleType]());
    },
  );

  server.registerTool(
    'yanshuf_save_rule',
    {
      description:
        'Create or update a rule. Optionally pass captureId to bootstrap match (and for mock, the response) from a capture. ' +
        'Fields by ruleType — mock: status/headers/body/delayMs; intercept: mode+phase (required) and headers/body/status edits; map-remote: host (required for new rules), port, protocol.',
      inputSchema: {
        ruleType: ruleTypeSchema,
        id: z.string().optional().describe('Omit to create, pass to update'),
        captureId: z.string().optional(),
        name: z.string().optional(),
        enabled: z.boolean().optional(),
        ...ruleMatchSchema,
        status: z.number().optional().describe('mock/intercept only'),
        headers: z.record(z.string()).optional().describe('mock/intercept only'),
        body: z.string().optional().describe('mock/intercept only. Inline JSON/text, no file paths'),
        delayMs: z.number().optional().describe('mock only'),
        mode: z.enum(['rewrite', 'breakpoint']).optional().describe('intercept only (required)'),
        phase: z.enum(['request', 'response']).optional().describe('intercept only (required)'),
        host: z.string().optional().describe('map-remote only (required for new rules)'),
        port: z.number().optional().describe('map-remote only'),
        protocol: z.enum(['http', 'https']).optional().describe('map-remote only'),
      },
    },
    async ({ ruleType, mode, phase, delayMs, host, port, protocol, ...common }) => {
      if (ruleType === 'mock') {
        return textResult(await client.saveMockRule({ ...common, delayMs }));
      }
      if (ruleType === 'intercept') {
        if (!mode || !phase) throw new Error('mode and phase are required for intercept rules');
        const { status, headers, body, ...rest } = common;
        return textResult(await client.saveInterceptRule({ ...rest, mode, phase, status, headers, body }));
      }
      const { status: _s, headers: _h, body: _b, ...rest } = common;
      return textResult(await client.saveMapRemoteRule({ ...rest, host, port, protocol }));
    },
  );

  server.registerTool(
    'yanshuf_delete_rule',
    {
      description: 'Delete a rule by ID and type.',
      inputSchema: { ruleType: ruleTypeSchema, id: z.string() },
    },
    async ({ ruleType, id }) => {
      const byType: Record<RuleType, () => Promise<unknown>> = {
        mock: () => client.deleteMockRule(id),
        intercept: () => client.deleteInterceptRule(id),
        'map-remote': () => client.deleteMapRemoteRule(id),
      };
      return textResult(await byType[ruleType]());
    },
  );

  server.registerTool(
    'yanshuf_list_pending_breakpoints',
    {
      description: 'List captures paused on a breakpoint, awaiting yanshuf_resolve_breakpoint.',
      inputSchema: {},
    },
    async () => textResult(await client.listPendingBreakpoints(), DEFAULT_BODY_CHARS),
  );

  server.registerTool(
    'yanshuf_resolve_breakpoint',
    {
      description:
        "Resolve a paused breakpoint: action 'continue' forwards it (with optional header/body/status edits), 'abort' cancels it (502 to client).",
      inputSchema: {
        id: z.string().describe('Breakpoint ID'),
        action: z.enum(['continue', 'abort']),
        headers: z.record(z.string()).optional().describe('continue only'),
        body: z.string().optional().describe('continue only'),
        status: z.number().optional().describe('continue only'),
      },
    },
    async ({ id, action, headers, body, status }) => {
      if (action === 'abort') return textResult(await client.abortBreakpoint(id));
      return textResult(await client.continueBreakpoint(id, { headers, body, status }));
    },
  );

  server.registerTool(
    'yanshuf_wait_for_breakpoint',
    {
      description: 'Block until a breakpoint is hit or timeout.',
      inputSchema: { timeoutMs: z.number().optional() },
    },
    async ({ timeoutMs }) => textResult(await client.waitForBreakpoint(timeoutMs), DEFAULT_BODY_CHARS),
  );
}
