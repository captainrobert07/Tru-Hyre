import Anthropic from "@anthropic-ai/sdk";

/**
 * Shared Claude access for Tru Hyre's AI features. Mirrors lib/parse-ai.ts:
 * graceful no-op (returns null) when ANTHROPIC_API_KEY is absent, so every
 * AI feature degrades cleanly in dev / when the key isn't configured.
 *
 * All AI features funnel through callTool() — a single forced-tool-call path —
 * so retries, error handling, and the no-key fallback live in one place.
 */

const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";

export function aiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let cachedClient: Anthropic | null = null;

function getClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  if (!cachedClient) cachedClient = new Anthropic({ apiKey });
  return cachedClient;
}

export type ToolSpec = {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
};

/**
 * Force a single tool call and return its validated input object, or null on
 * any failure (no key, API error, malformed response). Callers narrow the
 * shape themselves.
 */
export async function callTool<T = Record<string, unknown>>(opts: {
  system: string;
  prompt: string;
  tool: ToolSpec;
  maxTokens?: number;
}): Promise<T | null> {
  const client = getClient();
  if (!client) return null;

  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: opts.maxTokens ?? 1500,
      system: opts.system,
      tools: [opts.tool as unknown as Anthropic.Tool],
      tool_choice: { type: "tool", name: opts.tool.name },
      messages: [{ role: "user", content: opts.prompt }],
    });
    const toolUse = msg.content.find((c) => c.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") return null;
    return toolUse.input as T;
  } catch (e) {
    console.error(`[ai] ${opts.tool.name} threw`, (e as Error).message);
    return null;
  }
}

/** Free-text generation (no tool). Returns null on failure. */
export async function callText(opts: {
  system: string;
  prompt: string;
  maxTokens?: number;
}): Promise<string | null> {
  const client = getClient();
  if (!client) return null;

  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: opts.maxTokens ?? 1200,
      system: opts.system,
      messages: [{ role: "user", content: opts.prompt }],
    });
    const text = msg.content
      .map((c) => (c.type === "text" ? c.text : ""))
      .join("")
      .trim();
    return text || null;
  } catch (e) {
    console.error("[ai] callText threw", (e as Error).message);
    return null;
  }
}
