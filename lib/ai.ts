import Anthropic from "@anthropic-ai/sdk";
import { getIntegration } from "@/lib/integrations";

/**
 * Shared Claude access for Tru Hyre's AI features. Resolves the API key + model
 * from the admin Integrations config (DB) with env-var fallback, so an admin
 * can supply/rotate the key at /settings/integrations and it reflects
 * everywhere. Graceful no-op (returns null) when no key is configured.
 *
 * All AI features funnel through callTool()/callText() so retries, error
 * handling, and the no-key fallback live in one place.
 */

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

/**
 * Hard cap on prompt input length (~6k tokens at ~4 chars/token). Most prompts
 * are built from short structured fields, but a couple of entry points pass
 * raw user/DB text (e.g. the AI-search box has no maxLength, semantic-search
 * sends the query verbatim). Capping at the chokepoint means no caller — now
 * or later — can paste-bomb a giant blob into a billed API call. Normal inputs
 * are a few hundred chars, so this is invisible in practice and only trims a
 * pathological worst case.
 */
const MAX_PROMPT_CHARS = 24_000;

function clampPrompt(prompt: string): string {
  if (prompt.length <= MAX_PROMPT_CHARS) return prompt;
  return prompt.slice(0, MAX_PROMPT_CHARS) + "\n\n[truncated]";
}

async function resolveAi(): Promise<{ apiKey?: string; model: string }> {
  const r = await getIntegration("anthropic");
  return { apiKey: r.values.apiKey, model: r.values.model || DEFAULT_MODEL };
}

export async function aiEnabled(): Promise<boolean> {
  const { apiKey } = await resolveAi();
  return Boolean(apiKey);
}

async function getClient(): Promise<{ client: Anthropic; model: string } | null> {
  const { apiKey, model } = await resolveAi();
  if (!apiKey) return null;
  return { client: new Anthropic({ apiKey }), model };
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
  const c = await getClient();
  if (!c) return null;
  const { client, model } = c;

  try {
    const msg = await client.messages.create({
      model,
      max_tokens: opts.maxTokens ?? 1500,
      system: opts.system,
      tools: [opts.tool as unknown as Anthropic.Tool],
      tool_choice: { type: "tool", name: opts.tool.name },
      messages: [{ role: "user", content: clampPrompt(opts.prompt) }],
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
  const c = await getClient();
  if (!c) return null;
  const { client, model } = c;

  try {
    const msg = await client.messages.create({
      model,
      max_tokens: opts.maxTokens ?? 1200,
      system: opts.system,
      messages: [{ role: "user", content: clampPrompt(opts.prompt) }],
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
