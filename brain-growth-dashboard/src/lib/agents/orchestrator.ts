import { prisma } from "@/lib/db";
import { buildBrainContext, brainContextToPrompt } from "@/lib/brain";
import { sanitizePrompt } from "@/lib/harness";
import { aiGenerate } from "@/lib/ai/gateway";
import { logger } from "@/lib/logger";
import type { AgentType } from "./types";
import { AGENT_SKILLS, buildAgentSystemPrompt, buildAgentTaskPrompt } from "./skills";

/**
 * Orchestrator — selects agents, enforces order, handles failures.
 * Flow: RESEARCH → STRATEGY → CONTENT → IMAGE/VIDEO → REVIEW → APPROVAL → PUBLISH → ANALYTICS → MEMORY
 * Every agent now runs with an ultra-advanced, research-backed skill definition
 * (expert system prompt + reasoning methodology + output schema + quality bar).
 */

const WORKFLOWS: Record<string, AgentType[]> = {
  "content-generation": ["RESEARCH", "STRATEGY", "CONTENT", "IMAGE", "VIDEO", "REVIEW"],
  "research-only": ["RESEARCH"],
  "strategy-only": ["RESEARCH", "STRATEGY"],
  "full-cycle": ["RESEARCH", "STRATEGY", "CONTENT", "IMAGE", "VIDEO", "REVIEW", "ANALYTICS", "GROWTH"],
};

export async function runOrchestrator(params: {
  companyId: string;
  userId: string;
  workflow: keyof typeof WORKFLOWS | string;
  input: string;
}): Promise<{ runId: string; outputs: Record<string, unknown> }> {
  const workflow = WORKFLOWS[params.workflow] || ["RESEARCH", "STRATEGY", "CONTENT", "REVIEW"];
  const brain = await buildBrainContext(params.companyId);
  const brainPrompt = brainContextToPrompt(brain);

  const run = await prisma.agentRun.create({
    data: {
      companyId: params.companyId,
      agentType: "ORCHESTRATOR",
      status: "RUNNING",
      input: JSON.stringify({ workflow, input: params.input }),
      startedAt: new Date(),
    },
  });

  const outputs: Record<string, unknown> = {};
  const sanitizedInput = sanitizePrompt(params.input);

  for (const agentType of workflow) {
    try {
      const skill = AGENT_SKILLS[agentType];
      const systemPrompt = buildAgentSystemPrompt(agentType, skill, brainPrompt, params.companyId);
      const prompt = buildAgentTaskPrompt(agentType, skill, sanitizedInput, outputs);

      // Create task record
      const task = await prisma.agentTask.create({
        data: { runId: run.id, name: agentType, status: "RUNNING", input: JSON.stringify({ prompt: prompt.slice(0, 2000) }) },
      });

      // Route through the model router (real provider → fallback → mock), which
      // also records per-agent usage/cost.
      const llm = await aiGenerate({
        companyId: params.companyId,
        userId: params.userId,
        capability: "reasoning",
        task: `agent:${agentType}`.toLowerCase(),
        agent: agentType.toLowerCase(),
        prompt,
        systemPrompt,
        jsonMode: true,
      });
      const text = llm.text;

      // Use the REAL LLM structured output when it parses and validates against
      // the agent's schema; otherwise project the deterministic fallback
      // (explicitly labeled) — the LLM text is never wasted.
      const parsed = tryJSON(text);
      const structured = parsed && validateAgainstSchema(parsed, skill.outputSchema)
          ? { ...parsed, _model: `${llm.modelId}@${llm.provider}`, _fallback: llm.fallbackUsed ? "fallback" : "primary" }
          : { ...mockAgentOutput(agentType, params.input, brain), _model: null, _fallback: "deterministic-fallback" };
      outputs[agentType] = structured;

      await prisma.agentTask.update({
        where: { id: task.id },
        data: { status: "COMPLETED", output: JSON.stringify(structured).slice(0, 8000) },
      });

      await prisma.toolCall.create({
        data: { runId: run.id, tool: agentType, input: JSON.stringify({ prompt: prompt.slice(0, 1000) }), output: JSON.stringify(structured).slice(0, 5000) },
      });
    } catch (e: unknown) {
      const err = e as Error;
      logger.error(`orchestrator agent ${agentType} failed`, logger.errorMeta(err));
      outputs[agentType] = { error: err.message };
      await prisma.agentTask.create({
        data: { runId: run.id, name: `${agentType}_error`, status: "FAILED", error: err.message },
      });
    }
  }

  await prisma.agentRun.update({
    where: { id: run.id },
    data: { status: "COMPLETED", output: JSON.stringify(outputs).slice(0, 10000), endedAt: new Date() },
  });

  return { runId: run.id, outputs };
}

function tryJSON(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/```(?:json)?/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Lightweight schema validation — checks that all required keys exist and that
 * enum/array/object shapes are respected. Returns true when the parsed output
 * is structurally usable for the agent's contract.
 */
function validateAgainstSchema(output: Record<string, unknown>, schema: Record<string, unknown>): boolean {
  const props = (schema.properties as Record<string, { type?: string; required?: string[] }>) || {};
  const required = (schema.required as string[]) || [];
  for (const key of required) {
    if (output[key] === undefined || output[key] === null) return false;
    const def = props[key];
    if (!def) continue;
    if (def.type === "array" && !Array.isArray(output[key])) return false;
    if (def.type === "object" && (typeof output[key] !== "object" || Array.isArray(output[key]))) return false;
    if (def.type === "number" && typeof output[key] !== "number") return false;
    if (def.type === "string" && typeof output[key] !== "string") return false;
    if (def.type === "boolean" && typeof output[key] !== "boolean") return false;
  }
  return true;
}

function mockAgentOutput(agentType: string, input: string, brain: ReturnType<typeof buildBrainContext> extends Promise<infer T> ? T : never): Record<string, unknown> {
  const base = input.slice(0, 100);
  const isCreator = (brain as unknown as { profileType?: string })?.profileType === "CREATOR" || (brain as unknown as { profileType?: string })?.profileType === "PERSONAL_BRAND";
  switch (agentType) {
    case "RESEARCH":
      return isCreator
        ? {
            trends: [`Creator trend for: ${base} — viral format emerging`],
            peers: ["Peer creator: 3x Reels with 2-sec hook outperform"],
            audienceSignals: ["Audience saves storytelling Reels 40% more"],
            evidence: ["mock-research-creator"],
            confidence: 0.74,
          }
        : {
            trends: [`Trend for: ${base} — emerging`],
            competitors: ["Competitor A: 40% more educational content"],
            audienceSignals: ["Audience asks for tutorials"],
            evidence: ["mock-research"],
            confidence: 0.72,
          };
    case "STRATEGY":
      return isCreator
        ? {
            objective: `Grow creator reach/followers for: ${base}`,
            pillars: ["Storytelling", "Value hooks", "Community"],
            recommendation: "Create 3 Reels with 2-sec direct hook + personal story",
            reasoning: "Your Content DNA shows storytelling Reels get 3.2x saves",
            expected_impact: "+18% follower growth, +25% saves",
            confidence: 0.8,
          }
        : {
            objective: `Grow business reach/leads for: ${base}`,
            pillars: ["Education", "Behind-scenes", "Social proof"],
            recommendation: "Create 5-part educational series + lunch campaign",
            reasoning: "Fills content gap, aligns with weekday lunch signals",
            expected_impact: "+22% follower growth, +15% bookings",
            confidence: 0.78,
          };
    case "CONTENT":
      return isCreator
        ? {
            platform: "Instagram",
            content_type: "REEL",
            hook: `2-sec hook: "${base.slice(0, 30)}..." — personal story`,
            body: `Story-driven Reel about ${base}. Hook in 2s, narrative, CTA.`,
            cta: "Follow for part 2 & comment your take",
            hashtags: ["#creator", "#viral", "#storytelling"],
            visual_prompt: `Creator-style vertical video for: ${base}, fast cuts`,
            strategy_reason: "Uses Content DNA: 2-sec hook + storytelling",
            company_context_used: ["creatorVoice", "contentDna", "audience"],
            review_status: "pending",
          }
        : {
            platform: "Instagram",
            content_type: "POST",
            hook: `Stop scrolling: ${base.slice(0, 30)}...`,
            body: `Here is a value-packed post about ${base}. Learn, apply, grow.`,
            cta: "Book now - link in bio",
            hashtags: ["#growth", "#business", "#offer"],
            visual_prompt: `Clean business visual for: ${base}, brand-aware`,
            strategy_reason: "Uses business pillar + strong hook",
            company_context_used: ["brandVoice", "audienceSignals"],
            review_status: "pending",
          };
    case "REVIEW":
      return {
        issues: [],
        brandConsistency: "pass",
        safety: "pass",
        recommendation: "approve_with_minor_edits",
        confidence: 0.88,
      };
    case "ANALYTICS":
      return isCreator
        ? { predicted_score: 7.8, strengths: ["hook (2-sec)", "storytelling"], weaknesses: ["CTA could add save prompt"], confidence: 0.68 }
        : { predicted_score: 7.2, strengths: ["hook"], weaknesses: ["CTA could be stronger"], confidence: 0.65 };
    case "GROWTH":
      return isCreator
        ? {
            objective: "Grow creator followers 15% via storytelling Reels",
            recommendation: "Test 3 hook variations + collab with peer creator",
            reasoning: "Content DNA: storytelling hooks drive saves; peer collab opportunity",
            evidence: ["mock-analytics-creator"],
            expected_impact: "+15% followers, +20% shares",
            confidence: 0.72,
            risks: ["Hook fatigue"],
            required_approval: true,
            suggested_next_step: "Create Reel scripts + outreach draft",
          }
        : {
            objective: "Increase weekday lunch bookings 15%",
            recommendation: "Run Reel + Carousel for lunch offer",
            reasoning: "Weak weekday performance in analytics",
            evidence: ["mock-analytics"],
            expected_impact: "+15% bookings",
            confidence: 0.7,
            risks: ["Offer fatigue"],
            required_approval: true,
            suggested_next_step: "Create calendar items",
          };
    case "IMAGE":
      return {
        platform: "Instagram",
        format: "1080x1350 portrait",
        composition: "Focal point center-left, generous negative space top for text overlay",
        color_palette: ["brand primary", "brand accent", "neutral background"],
        typography: "Bold condensed headline, 2-line max, high contrast",
        text_overlay: base.slice(0, 40),
        mood: "Clean, confident, scroll-stopping",
        accessibility: "WCAG AA contrast, text within safe zones",
        image_prompt: `Professional social media visual for: ${base}, brand-aware, mobile-first`,
      };
    case "VIDEO":
      return {
        platform: "Instagram",
        format: "9:16 vertical, 15-30s",
        hook_shot: `2-sec hook: "${base.slice(0, 30)}..."`,
        hook_text_overlay: base.slice(0, 30),
        shots: [
          { visual: "Hook close-up", action: "Direct address", text_overlay: base.slice(0, 30), duration_sec: 2 },
          { visual: "Value sequence", action: "Fast cuts", text_overlay: "Key point", duration_sec: 8 },
          { visual: "Payoff", action: "Reveal result", text_overlay: "Result", duration_sec: 4 },
          { visual: "CTA", action: "On-screen CTA", text_overlay: "Follow/comment", duration_sec: 3 },
        ],
        pacing: "Fast cuts with pattern interrupts every 3-4s",
        payoff: "Clear result or insight that rewards the watch",
        cta_placement: "End screen + mid-roll text",
        captions: "Full burned-in captions for sound-off viewing",
        music_direction: "Trending upbeat track, low volume under voiceover",
        video_prompt: `Short-form vertical video for: ${base}, hook-first, captioned`,
      };
    default:
      return { result: `Mock output for ${agentType}: ${base}` };
  }
}
