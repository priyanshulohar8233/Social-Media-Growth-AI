import { LLMProvider, ImageProvider, EmbeddingProvider, GenerateInput, GenerateOutput, ImageGenInput, ImageGenOutput, EmbeddingInput } from "./types";

/**
 * Mock adapters — clearly marked as DEV only.
 * Return deterministic, explainable outputs.
 * Real providers (openai.ts, anthropic.ts, fal.ts) replace these when keys are configured.
 */

export const mockLLM: LLMProvider = {
  name: "mock",
  async generate(input: GenerateInput): Promise<GenerateOutput> {
    // Deterministic mock — never claim to be real AI
    const preview = input.prompt.slice(0, 80).replace(/\n/g, " ");
    const text = `[MOCK:${input.jsonMode ? "JSON" : "TEXT"}] Response for: "${preview}..." — Configure a real provider (OPENAI_API_KEY / ANTHROPIC_API_KEY) for production AI.`;
    return {
      text,
      modelId: "mock-reasoning",
      provider: "mock",
      tokensUsed: Math.ceil(input.prompt.length / 4),
      cost: 0,
    };
  },
};

export const mockImage: ImageProvider = {
  name: "mock",
  async generate(input: ImageGenInput): Promise<ImageGenOutput> {
    // Return a placeholder — real generation requires fal / comfyui
    const seed = encodeURIComponent(input.prompt.slice(0, 20));
    return {
      url: `https://picsum.photos/seed/${seed}/1024/1024`,
      provider: "mock",
      modelId: "mock-image",
    };
  },
};

export const mockVideo: {
  name: string;
  generate(input: { prompt: string; companyId?: string; jobId?: string }): Promise<{ url: string; note: string; modelId: string }>;
} = {
  name: "mock",
  async generate(input: { prompt: string; companyId?: string; jobId?: string }) {
    return {
      url: input.jobId ? `https://mock.video/${input.jobId}.mp4` : `https://mock.video/${encodeURIComponent(input.prompt.slice(0, 12))}.mp4`,
      note: "Mock video — configure fal/comfyui for real generation",
      modelId: "mock-video",
    };
  },
};

export const mockEmbedding: EmbeddingProvider = {
  name: "mock",
  async embed(input: EmbeddingInput): Promise<number[]> {
    // Simple hash-based embedding for dev (not semantic)
    const dim = 384;
    const arr = new Array(dim).fill(0);
    for (let i = 0; i < input.text.length; i++) {
      arr[i % dim] = (arr[i % dim] + input.text.charCodeAt(i)) % 100 / 100;
    }
    return arr;
  },
};
