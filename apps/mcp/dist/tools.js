import { z } from 'zod';
function textResult(data) {
    return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
    };
}
export function registerTools(server, client) {
    server.registerTool('yanshuf_status', {
        description: 'Get Yanshuf capture status. Call this before yanshuf_toggle_capture. Returns capturing state, proxy port, entry count, and certTrusted.',
        inputSchema: {},
    }, async () => textResult(await client.getStatus()));
    server.registerTool('yanshuf_toggle_capture', {
        description: 'Toggle capture on or off (system proxy + MITM together). Call yanshuf_status first. Returns the state after toggle.',
        inputSchema: {},
    }, async () => textResult(await client.toggleCapture()));
    server.registerTool('yanshuf_clear_session', {
        description: 'Clear all captured requests. Returns entryCount after clear (0). Call when the user says debugging is done.',
        inputSchema: {},
    }, async () => textResult(await client.clearSession()));
    server.registerTool('yanshuf_search_captures', {
        description: 'Search captured request summaries (latest first, max 100). Use before yanshuf_get_capture to find IDs.',
        inputSchema: {
            query: z.string().optional().describe('Free-text search across url, host, method, status'),
            url: z.string().optional(),
            host: z.string().optional(),
            method: z.string().optional(),
            status: z.string().optional(),
            limit: z.number().optional().describe('Max results (default 100)'),
        },
    }, async (args) => textResult(await client.searchCaptures(args)));
    server.registerTool('yanshuf_get_capture', {
        description: 'Get full request/response details for a capture ID from yanshuf_search_captures.',
        inputSchema: { id: z.string() },
    }, async ({ id }) => textResult(await client.getCapture(id)));
    server.registerTool('yanshuf_wait_for_capture', {
        description: 'Block until a new capture arrives or timeout. Use after triggering traffic or yanshuf_send_request.',
        inputSchema: {
            query: z.string().optional(),
            url: z.string().optional(),
            host: z.string().optional(),
            method: z.string().optional(),
            status: z.string().optional(),
            sinceId: z.string().optional().describe('Only captures newer than this ID'),
            timeoutMs: z.number().optional().describe('Timeout in ms (default 30000, max 120000)'),
        },
    }, async (args) => textResult(await client.waitForCapture(args)));
    server.registerTool('yanshuf_send_request', {
        description: 'Send an HTTP request through Yanshuf proxy. Optionally pass captureId to replay a captured request.',
        inputSchema: {
            captureId: z.string().optional(),
            method: z.string().optional(),
            url: z.string().optional(),
            headers: z.record(z.string()).optional(),
            body: z.string().optional(),
        },
    }, async (args) => {
        if (args.captureId) {
            return textResult(await client.sendRequest({ captureId: args.captureId }));
        }
        if (!args.url)
            throw new Error('url is required when captureId is not provided');
        return textResult(await client.sendRequest({
            method: args.method,
            url: args.url,
            headers: args.headers,
            body: args.body,
        }));
    });
    server.registerTool('yanshuf_list_mock_rules', {
        description: 'List mock response rules ordered by priority (first match wins).',
        inputSchema: {},
    }, async () => textResult(await client.listMockRules()));
    server.registerTool('yanshuf_save_mock_rule', {
        description: 'Create or update a mock response rule. Optionally pass captureId to bootstrap from a capture.',
        inputSchema: {
            id: z.string().optional(),
            captureId: z.string().optional(),
            name: z.string().optional(),
            enabled: z.boolean().optional(),
            urlRegex: z.string().optional(),
            status: z.number().optional(),
            headers: z.record(z.string()).optional(),
            body: z.string().optional(),
            delayMs: z.number().optional(),
        },
    }, async (args) => textResult(await client.saveMockRule(args)));
    server.registerTool('yanshuf_delete_mock_rule', {
        description: 'Delete a mock rule by ID.',
        inputSchema: { id: z.string() },
    }, async ({ id }) => textResult(await client.deleteMockRule(id)));
    server.registerTool('yanshuf_list_intercept_rules', {
        description: 'List intercept rules (rewrite and breakpoint).',
        inputSchema: {},
    }, async () => textResult(await client.listInterceptRules()));
    server.registerTool('yanshuf_save_intercept_rule', {
        description: 'Create or update an intercept rule (rewrite or breakpoint). Optionally pass captureId to bootstrap.',
        inputSchema: {
            id: z.string().optional(),
            captureId: z.string().optional(),
            name: z.string().optional(),
            enabled: z.boolean().optional(),
            mode: z.enum(['rewrite', 'breakpoint']),
            phase: z.enum(['request', 'response']),
            urlRegex: z.string().optional(),
            headers: z.record(z.string()).optional(),
            body: z.string().optional(),
            status: z.number().optional(),
        },
    }, async (args) => textResult(await client.saveInterceptRule(args)));
    server.registerTool('yanshuf_delete_intercept_rule', {
        description: 'Delete an intercept rule by ID.',
        inputSchema: { id: z.string() },
    }, async ({ id }) => textResult(await client.deleteInterceptRule(id)));
    server.registerTool('yanshuf_list_pending_breakpoints', {
        description: 'List captures awaiting breakpoint continue/abort.',
        inputSchema: {},
    }, async () => textResult(await client.listPendingBreakpoints()));
    server.registerTool('yanshuf_continue_breakpoint', {
        description: 'Continue a paused breakpoint with optional edits.',
        inputSchema: {
            id: z.string().describe('Breakpoint ID'),
            headers: z.record(z.string()).optional(),
            body: z.string().optional(),
            status: z.number().optional(),
        },
    }, async ({ id, headers, body, status }) => textResult(await client.continueBreakpoint(id, { headers, body, status })));
    server.registerTool('yanshuf_abort_breakpoint', {
        description: 'Abort a paused breakpoint.',
        inputSchema: { id: z.string() },
    }, async ({ id }) => textResult(await client.abortBreakpoint(id)));
    server.registerTool('yanshuf_wait_for_breakpoint', {
        description: 'Block until a breakpoint is hit or timeout.',
        inputSchema: { timeoutMs: z.number().optional() },
    }, async ({ timeoutMs }) => textResult(await client.waitForBreakpoint(timeoutMs)));
}
//# sourceMappingURL=tools.js.map