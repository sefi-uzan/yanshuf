import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadApiClientConfig, YanshufApiClient } from './client.js';
import { registerTools } from './tools.js';

async function main(): Promise<void> {
  const config = await loadApiClientConfig();
  const client = new YanshufApiClient(config);

  const server = new McpServer({
    name: 'yanshuf',
    version: '1.0.0',
  });

  registerTools(server, client);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Warn on stderr if Yanshuf is unreachable — tools will return errors until the app starts.
  try {
    await client.getStatus();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[yanshuf-mcp] Warning: ${message}`);
  }
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(message);
  process.exit(1);
});
