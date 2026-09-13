// Provider adapter interfaces — agents depend on capability, not concrete provider

export interface GenerateInput {
  prompt: string;
  systemPrompt?: string;
  modelId?: string;
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
  companyId?: string;
}

export interface GenerateOutput {
  text: string;
  modelId: string;
  provider: string;
  tokensUsed?: number;
  cost?: number;
}

export interface ImageGenInput {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  companyId?: string;
}

export interface ImageGenOutput {
  url: string;
  provider: string;
  modelId: string;
}

export interface VideoGenInput {
  prompt: string;
  duration?: number;
  companyId?: string;
}

export interface EmbeddingInput {
  text: string;
  companyId?: string;
}

export interface LLMProvider {
  name: string;
  generate(input: GenerateInput): Promise<GenerateOutput>;
}

export interface ImageProvider {
  name: string;
  generate(input: ImageGenInput): Promise<ImageGenOutput>;
}

export interface EmbeddingProvider {
  name: string;
  embed(input: EmbeddingInput): Promise<number[]>;
}
