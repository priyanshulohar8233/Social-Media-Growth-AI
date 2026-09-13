import { requireAuth } from "@/lib/auth-server";
import { assertMembership } from "@/lib/tenant";
import { isProviderAllowed } from "@/lib/models/registry";
import { prisma } from "@/lib/db";
import type { ModelPolicy } from "@/lib/models/types";
import { auditLog, getClientIp } from "@/lib/audit";

/**
 * AI Harness — centralized policy enforcement.
 * Every agent/tool call MUST go through harness.call()
 */

export interface HarnessContext {
  userId: string;
  companyId: string;
  policy: ModelPolicy;
  allowedProviders?: string[];
  allowedPlatforms?: string[];
  requireApproval: boolean;
}

export async function getHarnessContext(request: Request, companyId: string): Promise<HarnessContext> {
  const auth = await requireAuth(request);
  if (!auth) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  await assertMembership(auth.userId, companyId);

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { modelPolicy: true, allowedProviders: true, allowedPlatforms: true, requireApproval: true },
  });
  if (!company) throw Object.assign(new Error("Company not found"), { status: 404 });

  return {
    userId: auth.userId,
    companyId,
    policy: (company.modelPolicy as ModelPolicy) || "BEST_AVAILABLE",
    allowedProviders: company.allowedProviders ? JSON.parse(company.allowedProviders) : undefined,
    allowedPlatforms: company.allowedPlatforms ? JSON.parse(company.allowedPlatforms) : undefined,
    requireApproval: company.requireApproval,
  };
}

export function enforceProviderPolicy(provider: string, ctx: HarnessContext) {
  const allowed = isProviderAllowed(provider as never, ctx.policy, ctx.allowedProviders as never);
  if (!allowed) {
    throw Object.assign(
      new Error(`Provider ${provider} blocked by policy ${ctx.policy}`),
      { status: 403 }
    );
  }
}

export function sanitizePrompt(input: string): string {
  // Basic injection defense — strip common injection patterns
  const patterns = [
    /ignore\s+previous\s+instructions/gi,
    /system\s*:\s*/gi,
    /\[INST\]/gi,
  ];
  let out = input;
  for (const p of patterns) out = out.replace(p, "[filtered]");
  return out.slice(0, 8000); // limit length
}

export async function logToolCall(params: {
  companyId?: string;
  runId?: string;
  tool: string;
  input?: unknown;
  output?: unknown;
}) {
  if (params.runId) {
    await prisma.toolCall.create({
      data: {
        runId: params.runId,
        tool: params.tool,
        input: params.input ? JSON.stringify(params.input) : null,
        output: params.output ? JSON.stringify(params.output) : null,
      },
    });
  }
  await auditLog({
    companyId: params.companyId || null,
    action: `tool.${params.tool}`,
    entity: "ToolCall",
    meta: params.input as Record<string, unknown>,
  });
}
