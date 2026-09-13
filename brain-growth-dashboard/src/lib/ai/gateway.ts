import { prisma } from "@/lib/db";
import type { Capability, ModelDef, ModelPolicy, ProviderName } from "@/lib/models/types";
import { getModelsForCapabilityAll, isProviderAllowed } from "@/lib/models/registry";
import { mockLLM } from "@/lib/providers/mock";
import { openaiLLM, anthropicLLM, freellmapiLLM, ProviderUnavailableError } from "@/lib/providers/http";
import type { GenerateOutput } from "@/lib/providers/types";
import { sanitizePrompt } from "@/lib/harness";
import { logger } from "@/lib/logger";

/*
 * AI Gateway — the single entry point for text generation.
 *
 * Route by capability → apply workspace model policy → try providers best-first
 * (real adapters; each throws ProviderUnavailable when its key/model is unusable)
 * → retry transient failures once → fall back to lower-quality candidates and
 * finally the mock (dev) adapter → record every attempt in AiUsage.
 *
 * No provider API keys ever reach the client; all keys stay server-side in env.
 */

const LLM_ADAPTERS: Record<string, typeof mockLLM> = {
  mock: mockLLM,
  openai: openaiLLM,
  anthropic: anthropicLLM,
  freellmapi: freellmapiLLM,
};

export interface AiGenerateParams {
  companyId: string;
  userId?: string | null;
  capability?: Capability;
  prompt: string;
  systemPrompt?: string;
  task?: string;
  agent?: string;
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
  policy?: ModelPolicy;
  allowedProviders?: ProviderName[];
  preferModelId?: string;
  allowMockFallback?: boolean;
}

export interface AiGenerateResult {
  text: string;
  modelId: string;
  provider: string;
  tokensUsed: number;
  cost: number;
  fallbackUsed: boolean;
  latencyMs: number;
}

async function loadCompanyPolicy(companyId: string): Promise<{ policy: ModelPolicy; allowedProviders?: ProviderName[] }> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { modelPolicy: true, allowedProviders: true, allowPaidGeneration: true },
  });
  if (!company) throw Object.assign(new Error("Company not found"), { status: 404 });
  return {
    policy: (company.modelPolicy as ModelPolicy) || "BEST_AVAILABLE",
    allowedProviders: company.allowedProviders ? (JSON.parse(company.allowedProviders) as ProviderName[]) : undefined,
  };
}

function rankCandidates(capability: Capability, policy: ModelPolicy, allowedProviders?: ProviderName[], preferModelId?: string): ModelDef[] {
  let candidates = getModelsForCapabilityAll(capability).filter((m) => isProviderAllowed(m.provider, policy, allowedProviders));
  if (preferModelId) {
    const preferred = candidates.find((m) => m.id === preferModelId);
    if (preferred) candidates = [preferred, ...candidates.filter((m) => m.id !== preferModelId)];
  }
  candidates.sort((a, b) => {
    const q = (b.quality || 0) - (a.quality || 0);
    if (q !== 0) return q;
    return (a.costPer1k || 0) - (b.costPer1k || 0);
  });
  // Mock is a last-resort dev fallback, never ahead of a real provider.
  return [...candidates.filter((m) => m.provider !== "mock"), ...candidates.filter((m) => m.provider === "mock")];
}

function isTransient(err: unknown): boolean {
  if (!(err instanceof ProviderUnavailableError)) return false;
  const msg = err.message;
  return /timeout|429|network|5\d\d/i.test(msg) && !/401|403|invalid/i.test(msg);
}

async function callWithRetry(adapter: { generate(i: unknown): Promise<GenerateOutput> }, input: Record<string, unknown>): Promise<GenerateOutput> {
  try {
    return await adapter.generate(input);
  } catch (err) {
    if (isTransient(err)) return adapter.generate(input); // single retry
    throw err;
  }
}

export async function aiGenerate(params: AiGenerateParams): Promise<AiGenerateResult> {
  const capability = params.capability ?? "writing";
  const started = Date.now();
  const { policy, allowedProviders } = params.policy
    ? { policy: params.policy, allowedProviders: params.allowedProviders }
    : await loadCompanyPolicy(params.companyId);

  const prompt = sanitizePrompt(params.prompt);
  const candidates = rankCandidates(capability, policy, allowedProviders, params.preferModelId);
  const errors: string[] = [];
  let anyRealFailed = false;
  const useMockFallback = params.allowMockFallback !== false;
  const attempts: Array<{ modelId: string; provider: string; status: string; error?: string }> = [];

  if (candidates.length === 0) {
    throw Object.assign(new Error(`No model available for capability "${capability}" under policy ${policy}`), { status: 422 });
  }

  for (const candidate of candidates) {
    const adapter = LLM_ADAPTERS[candidate.provider];
    if (!adapter) continue;
    if (candidate.provider === "mock" && !useMockFallback) continue;

    try {
      const output = await callWithRetry(adapter, {
        prompt,
        systemPrompt: params.systemPrompt,
        modelId: candidate.id,
        maxTokens: params.maxTokens,
        temperature: params.temperature,
        jsonMode: params.jsonMode,
        companyId: params.companyId,
      });
      const status = anyRealFailed ? "fallback" : "success";
      attempts.push({ modelId: output.modelId, provider: output.provider, status });
      await recordUsage(params, output.modelId, output.provider, status, output.tokensUsed, output.cost, Date.now() - started, capability);
      return {
        text: output.text,
        modelId: output.modelId,
        provider: output.provider,
        tokensUsed: output.tokensUsed || 0,
        cost: output.cost || 0,
        fallbackUsed: status === "fallback",
        latencyMs: Date.now() - started,
      };
    } catch (err) {
      const e = err as Error;
      errors.push(`${candidate.id}: ${e.message}`);
      attempts.push({ modelId: candidate.id, provider: candidate.provider, status: "error", error: e.message });
      await recordUsage(params, candidate.id, candidate.provider, "error", null, null, Date.now() - started, capability, e.message);
      if (candidate.provider !== "mock") anyRealFailed = true;
      if (!(err instanceof ProviderUnavailableError)) {
        // Non-provider error (validation, bad request) — stop, don't mask with mock.
        const out = Object.assign(new Error(`AI generation failed (${candidate.id}): ${e.message}`), { status: 500 });
        logger.error("aiGenerate failed", { ...logger.errorMeta(err), companyId: params.companyId, capability });
        throw out;
      }
    }
  }

  const out = Object.assign(new Error(`All AI providers failed for ${capability} (${errors.join("; ") || "no providers"})`), { status: 503 });
  logger.error("aiGenerate exhausted providers", { companyId: params.companyId, capability, errors });
  throw out;
}

async function recordUsage(
  params: AiGenerateParams,
  modelId: string,
  provider: string,
  status: string,
  tokens?: number | null,
  cost?: number | null,
  latencyMs?: number,
  capability?: Capability,
  error?: string
) {
  try {
    await prisma.aiUsage.create({
      data: {
        companyId: params.companyId,
        userId: params.userId || null,
        agent: params.agent || null,
        task: params.task || null,
        capability: capability || params.capability || null,
        modelId,
        providerName: provider,
        status,
        totalTokens: tokens ?? null,
        cost: cost ?? null,
        latencyMs: latencyMs ?? null,
        meta: error ? JSON.stringify({ error }) : null,
      },
    });
  } catch (e) {
    logger.error("recordUsage failed", logger.errorMeta(e));
  }
}

export function getUsageModelForProvider(provider: string): ProviderName | null {
  return (["openai", "anthropic", "freellmapi", "mock"] as ProviderName[]).includes(provider as ProviderName) ? (provider as ProviderName) : null;
}