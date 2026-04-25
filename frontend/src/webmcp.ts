/**
 * WebMCP — expose Daily AI Bird tools to AI agents via the browser
 * (navigator.modelContext API, WebMCP spec / Chrome EPP).
 *
 * Tools mirror the MCP endpoint at /mcp but are callable directly from
 * the browser context without a network round-trip for the tool registry.
 * Each tool's execute() calls the /mcp JSON-RPC endpoint.
 */

const BASE = window.location.origin

async function callMcpTool(toolName: string, args: Record<string, unknown>): Promise<string> {
  const res = await fetch(`${BASE}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: { name: toolName, arguments: args },
    }),
  })
  const json = await res.json()
  if (json.error) throw new Error(json.error.message)
  const content = json.result?.content
  if (Array.isArray(content) && content.length > 0) return content[0].text ?? ''
  return JSON.stringify(json.result)
}

const TOOLS = [
  {
    name: 'search_articles',
    description:
      'Search published AI news articles on Daily AI Bird. Filter by topic and sort by relevance or date.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        topic: {
          type: 'string',
          description: 'Topic category filter.',
          enum: ['research', 'products', 'policy', 'business', 'safety', 'open_source', 'tools', 'agents'],
        },
        sort: { type: 'string', enum: ['relevance', 'date'], default: 'relevance' },
        page: { type: 'integer', default: 1, minimum: 1 },
        per_page: { type: 'integer', default: 10, minimum: 1, maximum: 50 },
      },
    },
    execute: (args: Record<string, unknown>) => callMcpTool('search_articles', args),
  },
  {
    name: 'get_article',
    description: 'Get a specific AI news article by its numeric ID, including full AI-generated summary.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'integer', description: 'Article ID from search_articles results.' },
      },
      required: ['id'],
    },
    execute: (args: Record<string, unknown>) => callMcpTool('get_article', args),
  },
  {
    name: 'get_digest',
    description: 'Get the curated daily AI news digest. Omit date for the latest.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        date: { type: 'string', description: 'Date in YYYY-MM-DD format. Optional.' },
      },
    },
    execute: (args: Record<string, unknown>) => callMcpTool('get_digest', args),
  },
  {
    name: 'list_topics',
    description: 'List all available AI news topic categories with article counts.',
    inputSchema: { type: 'object' as const, properties: {} },
    execute: (args: Record<string, unknown>) => callMcpTool('list_topics', args),
  },
]

export function initWebMcp(): void {
  // navigator.modelContext is the WebMCP browser API (Chrome EPP / WebMachinelearning spec).
  // Guard with a type-safe check — the API may not exist in all browsers.
  const nav = navigator as Navigator & {
    modelContext?: {
      provideContext: (ctx: {
        name: string
        description: string
        tools: typeof TOOLS
      }) => void
    }
  }

  if (typeof nav.modelContext?.provideContext !== 'function') return

  nav.modelContext.provideContext({
    name: 'Daily AI Bird',
    description:
      'AI-assisted news intelligence. Search, browse, and read the latest AI research, products, policy, and open-source news — curated and editor-reviewed daily.',
    tools: TOOLS,
  })
}
