import { LLMProvider, GenerateInput, GenerateOutput } from "./types";

// Shared helpers for real, HTTP-based provider adapters.
// Adapters throw ProviderUnavailable when the key/model is unusable so the
// model-router gateway can fall through to the next candidate / mock.

export class ProviderUnavailableError extends Error {
  status = 503;
  constructor(message: string) {
    super(message);
    this.name = "ProviderUnavailableError";
  }
}

export async function fetchWithTimeout(url: string, init: RequestInit, ms = 30000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    const e = err as Error;
    if (e.name === "AbortError") throw new ProviderUnavailableError(`Provider timeout after ${ms}ms`);
    throw new ProviderUnavailableError(`Network error: ${e.message}`);
  } finally {
    clearTimeout(timer);
  }
}

/** Estimate cost from per-1k rate (input-weighted approximation). */
export function estimateCost(costPer1k: number | undefined, tokens: number): number {
  if (!costPer1k || !tokens) return 0;
  return Number(((costPer1k * tokens) / 1000).toFixed(6));
}

function requireKey(name: string): string {
  const key = process.env[name]?.trim();
  if (!key) throw new ProviderUnavailableError(`${name} is not configured — provider unavailable`);
  return key;
}

export const openaiLLM: LLMProvider = {
  name: "openai",
  async generate(input: GenerateInput): Promise<GenerateOutput> {
    const apiKey = requireKey("OPENAI_API_KEY");
    const modelId = input.modelId || "gpt-4o-mini";
    const body: Record<string, unknown> = {
      model: modelId,
      messages: [
        ...(input.systemPrompt ? [{ role: "system", content: input.systemPrompt }] : []),
        { role: "user", content: input.prompt },
      ],
      temperature: input.temperature ?? 0.7,
    };
    if (input.maxTokens) body.max_tokens = input.maxTokens;
    if (input.jsonMode) {
      body.response_format = { type: "json_object" };
      body.temperature = input.temperature ?? 0.2;
    }

    const res = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      if (res.status === 401 || res.status === 403) throw new ProviderUnavailableError(`OpenAI ${res.status}: invalid or expired API key`);
      if (res.status === 429) throw new ProviderUnavailableError(`OpenAI 429: rate limited`);
      throw new ProviderUnavailableError(`OpenAI ${res.status}: ${detail.slice(0, 300)}`);
    }
    const json = await res.json();
    const text = json?.choices?.[0]?.message?.content ?? "";
    const usage = json?.usage;
    const promptTokens = usage?.prompt_tokens || Math.ceil(input.prompt.length / 4);
    const completionTokens = usage?.completion_tokens || Math.ceil(text.length / 4);
    return {
      text,
      modelId,
      provider: "openai",
      tokensUsed: promptTokens + completionTokens,
      cost: estimateCost(0.0015, promptTokens + completionTokens),
    };
  },
};

const GENERIC_COST_PER_1K: Record<string, number> = {
  "claude-3-5-haiku": 0.001,
  "claude-3-5-sonnet": 0.003,
  "claude-3-7-sonnet": 0.003,
};

export const anthropicLLM: LLMProvider = {
  name: "anthropic",
  async generate(input: GenerateInput): Promise<GenerateOutput> {
    const apiKey = requireKey("ANTHROPIC_API_KEY");
    const modelId = input.modelId || "claude-3-5-haiku";

    const res = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: modelId,
        max_tokens: input.maxTokens ?? 2048,
        temperature: input.jsonMode ? (input.temperature ?? 0.2) : (input.temperature ?? 0.7),
        system: input.systemPrompt,
        messages: [{ role: "user", content: input.prompt }],
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      if (res.status === 401 || res.status === 403) throw new ProviderUnavailableError(`Anthropic ${res.status}: invalid or expired API key`);
      if (res.status === 429) throw new ProviderUnavailableError(`Anthropic 429: rate limited`);
      throw new ProviderUnavailableError(`Anthropic ${res.status}: ${detail.slice(0, 300)}`);
    }
    const json = await res.json();
    const text = (json?.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("\n");
    const usage = json?.usage;
    const promptTokens = usage?.input_tokens || Math.ceil(input.prompt.length / 4);
    const completionTokens = usage?.output_tokens || Math.ceil(text.length / 4);
    const rate = GENERIC_COST_PER_1K[modelId] || 0.001;
    return {
      text,
      modelId,
      provider: "anthropic",
      tokensUsed: promptTokens + completionTokens,
      cost: estimateCost(rate, promptTokens + completionTokens),
    };
  },
};

/**
 * FreeLLMAPI — OpenAI-compatible gateway (self-hosted LLM router).
 * Routes to Google/Groq/OpenRouter/Ollama/etc. using keys configured in the
 * FreeLLMAPI dashboard. Requires FREELLMAPI_API_KEY (the unified API key).
 */
export const freellmapiLLM: LLMProvider = {
  name: "freellmapi",
  async generate(input: GenerateInput): Promise<GenerateOutput> {
    const apiKey = requireKey("FREELLMAPI_API_KEY");
    const baseUrl = (process.env.FREELLMAPI_BASE_URL || "https://freellmapi.onrender.com/v1").replace(/\/$/, "");
    const modelId = input.modelId || "gemini-2.5-flash";
    const body: Record<string, unknown> = {
      model: modelId,
      messages: [
        ...(input.systemPrompt ? [{ role: "system", content: input.systemPrompt }] : []),
        { role: "user", content: input.prompt },
      ],
      temperature: input.temperature ?? 0.7,
    };
    if (input.maxTokens) body.max_tokens = input.maxTokens;
    if (input.jsonMode) {
      body.response_format = { type: "json_object" };
      body.temperature = input.temperature ?? 0.2;
    }

    const res = await fetchWithTimeout(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      if (res.status === 401 || res.status === 403) throw new ProviderUnavailableError(`FreeLLMAPI ${res.status}: invalid or expired API key`);
      if (res.status === 429) throw new ProviderUnavailableError(`FreeLLMAPI 429: rate limited`);
      throw new ProviderUnavailableError(`FreeLLMAPI ${res.status}: ${detail.slice(0, 300)}`);
    }
    const json = await res.json();
    const text = json?.choices?.[0]?.message?.content ?? "";
    const usage = json?.usage;
    const promptTokens = usage?.prompt_tokens || Math.ceil(input.prompt.length / 4);
    const completionTokens = usage?.completion_tokens || Math.ceil(text.length / 4);
    return {
      text,
      modelId,
      provider: "freellmapi",
      tokensUsed: promptTokens + completionTokens,
      cost: estimateCost(0, promptTokens + completionTokens),
    };
  },
};