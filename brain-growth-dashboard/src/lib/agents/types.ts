// Structured contracts per spec Phase 41

export interface RecommendationOutput {
  objective: string;
  recommendation: string;
  reasoning: string;
  evidence: string[];
  expected_impact: string;
  confidence: number; // 0-1
  risks: string[];
  required_approval: boolean;
  suggested_next_step: string;
}

export interface ContentOutput {
  platform: string;
  content_type: string;
  hook: string;
  body: string;
  cta: string;
  hashtags: string[];
  visual_prompt: string;
  strategy_reason: string;
  company_context_used: string[];
  review_status: "pending" | "approved" | "needs_revision";
}

export interface MemoryOutput {
  memory_type: string;
  content: string;
  source: string;
  provenance: string;
  confidence: number;
  verification_status: "PENDING" | "VERIFIED" | "REJECTED";
  company_id: string;
}

export type AgentType = "ORCHESTRATOR" | "RESEARCH" | "STRATEGY" | "CONTENT" | "IMAGE" | "VIDEO" | "REVIEW" | "ANALYTICS" | "GROWTH";

export interface AgentInput {
  companyId: string;
  userId: string;
  task: string;
  context?: Record<string, unknown>;
}

export interface AgentResult {
  success: boolean;
  output?: unknown;
  error?: string;
  tokensUsed?: number;
  modelId?: string;
}
