// Model Registry types — capability-based routing, not hard-coded provider checks

export type Capability =
  | "reasoning"
  | "research"
  | "writing"
  | "coding"
  | "vision"
  | "image_generation"
  | "video_generation"
  | "embedding"
  | "transcription"
  | "audio";

export type ProviderName = "openai" | "anthropic" | "local" | "huggingface" | "fal" | "comfyui" | "mock";

export type ModelPolicy = "LOCAL_ONLY" | "FREE_ONLY" | "APPROVED_PROVIDERS" | "BEST_AVAILABLE";

export interface ModelDef {
  id: string; // modelId
  provider: ProviderName;
  displayName: string;
  capabilities: Capability[];
  contextLength?: number;
  vision?: boolean;
  toolCalling?: boolean;
  structuredOutput?: boolean;
  enabled: boolean;
  costPer1k?: number; // USD
  quality?: number; // 0-1
  speed?: number; // 0-1 (higher = faster)
  requiresPaid?: boolean;
}

export interface ProviderDef {
  name: ProviderName;
  displayName: string;
  enabled: boolean;
  requiresKey?: boolean;
}
