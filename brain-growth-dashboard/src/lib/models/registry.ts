import { ModelDef, Capability, ModelPolicy, ProviderName } from "./types";

// Global registry — seeded from config, can be extended via DB
const MODELS: ModelDef[] = [
  {
    id: "mock-reasoning",
    provider: "mock",
    displayName: "Mock Reasoning (dev)",
    capabilities: ["reasoning", "research", "writing"],
    contextLength: 8000,
    toolCalling: true,
    structuredOutput: true,
    enabled: true,
    costPer1k: 0,
    quality: 0.5,
    speed: 1,
    requiresPaid: false,
  },
  {
    id: "mock-vision",
    provider: "mock",
    displayName: "Mock Vision (dev)",
    capabilities: ["vision"],
    vision: true,
    enabled: true,
    costPer1k: 0,
    quality: 0.4,
    speed: 1,
    requiresPaid: false,
  },
  {
    id: "mock-embedding",
    provider: "mock",
    displayName: "Mock Embedding (dev)",
    capabilities: ["embedding"],
    enabled: true,
    costPer1k: 0,
    quality: 0.4,
    speed: 1,
    requiresPaid: false,
  },
  {
    id: "mock-image",
    provider: "mock",
    displayName: "Mock Image (dev)",
    capabilities: ["image_generation"],
    enabled: true,
    costPer1k: 0,
    quality: 0.4,
    speed: 1,
    requiresPaid: false,
  },
  {
    id: "mock-video",
    provider: "mock",
    displayName: "Mock Video (dev)",
    capabilities: ["video_generation"],
    enabled: true,
    costPer1k: 0,
    quality: 0.3,
    speed: 0.6,
    requiresPaid: false,
  },
  // Real providers — disabled until keys configured
  {
    id: "gpt-4o-mini",
    provider: "openai",
    displayName: "OpenAI GPT-4o mini",
    capabilities: ["reasoning", "research", "writing", "vision"],
    contextLength: 128000,
    vision: true,
    toolCalling: true,
    structuredOutput: true,
    enabled: false,
    costPer1k: 0.0015,
    quality: 0.92,
    speed: 0.85,
    requiresPaid: true,
  },
  {
    id: "claude-3-5-haiku",
    provider: "anthropic",
    displayName: "Anthropic Claude 3.5 Haiku",
    capabilities: ["reasoning", "research", "writing", "vision"],
    contextLength: 200000,
    vision: true,
    toolCalling: true,
    structuredOutput: true,
    enabled: false,
    costPer1k: 0.001,
    quality: 0.93,
    speed: 0.88,
    requiresPaid: true,
  },
  {
    id: "flux-schnell",
    provider: "fal",
    displayName: "FAL Flux Schnell (image)",
    capabilities: ["image_generation"],
    enabled: false,
    costPer1k: 0.02,
    quality: 0.88,
    speed: 0.9,
    requiresPaid: true,
  },
];

export function getAllModels(): ModelDef[] {
  return MODELS.filter((m) => m.enabled);
}

export function getAllModelsUnfiltered(): ModelDef[] {
  return [...MODELS];
}

export function getModelsForCapability(capability: Capability): ModelDef[] {
  return MODELS.filter((m) => m.enabled && m.capabilities.includes(capability));
}

export function getModelsForCapabilityAll(capability: Capability): ModelDef[] {
  return MODELS.filter((m) => m.capabilities.includes(capability));
}

export function getModelById(id: string): ModelDef | undefined {
  return MODELS.find((m) => m.id === id);
}

/**
 * Resolve best model for a capability under a policy.
 * Never returns a paid model when policy is LOCAL_ONLY or FREE_ONLY.
 */
export function resolveModel(
  capability: Capability,
  policy: ModelPolicy,
  approvedProviders?: ProviderName[]
): ModelDef | null {
  let candidates = getModelsForCapability(capability);

  if (policy === "LOCAL_ONLY") {
    candidates = candidates.filter((m) => m.provider === "local" || m.provider === "mock");
  } else if (policy === "FREE_ONLY") {
    candidates = candidates.filter((m) => !m.requiresPaid);
  } else if (policy === "APPROVED_PROVIDERS") {
    const allowed = new Set(approvedProviders || []);
    candidates = candidates.filter((m) => allowed.has(m.provider));
  }
  // BEST_AVAILABLE: sort by quality desc, then cost asc
  candidates.sort((a, b) => {
    const q = (b.quality || 0) - (a.quality || 0);
    if (q !== 0) return q;
    return (a.costPer1k || 0) - (b.costPer1k || 0);
  });

  return candidates[0] || null;
}

export function isProviderAllowed(provider: ProviderName, policy: ModelPolicy, approvedProviders?: ProviderName[]): boolean {
  if (policy === "LOCAL_ONLY") return provider === "local" || provider === "mock";
  if (policy === "FREE_ONLY") {
    const m = MODELS.find((x) => x.provider === provider);
    return m ? !m.requiresPaid : provider === "mock";
  }
  if (policy === "APPROVED_PROVIDERS") return !!approvedProviders?.includes(provider);
  return true;
}
