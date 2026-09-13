import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-server";
import { assertMembership } from "@/lib/tenant";
import { buildBrainContext, brainContextToPrompt, retrieveMemories } from "@/lib/brain";
import { aiGenerate } from "@/lib/ai/gateway";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const auth = await requireAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await assertMembership(auth.userId, companyId);
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    return NextResponse.json({ error: err.message }, { status: err.status || 403 });
  }

  const body = await request.json();
  const { message, history } = body as { message?: string; history?: Array<{ role: string; content: string }> };
  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true, industry: true, profileType: true },
  });
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  try {
    const brain = await buildBrainContext(companyId);
    const memories = await retrieveMemories(companyId, message, 4);
    const contextPrompt = brainContextToPrompt(brain);
    const memoryBlock = memories.length
      ? "Retrieved from memory:\n" + memories.map((m) => `[${m.type}] ${m.content}`).join("\n")
      : "";

    const prompt = [
      `You are BrainGrow AI copilot for "${company.name}" (${company.profileType}, ${company.industry || "n/a"}).`,
      contextPrompt,
      memoryBlock,
      "User asked: " + message,
    ].join("\n");

    // Lightweight intent routing so the "AI" surfaces meaningful guidance
    const lower = message.toLowerCase();
    let assistant: string;

    if (["content idea", "ideas", "caption", "write", "post idea"].some((k) => lower.includes(k))) {
      const pillars = brain.pillars.length ? brain.pillars.map((p) => p.name).join(", ") : "your core niche";
      assistant =
        "Here are 5 content ideas tailored to your brand (pillars: " + pillars + "):\n" +
        "1. **Education**: break down one confusing topic in " + (brain.contentDna[0]?.topic || "your niche") + "\n" +
        "2. **Behind-the-scenes**: show how you produce your best-performing content\n" +
        "3. **Trend adaptation**: remix the trend \"" + (brain.trends[0]?.title || "short-form video") + "\" with your own angle\n" +
        "4. **Proof narrative**: share a result/fact learned from your verified performance data\n" +
        "5. **Engagement bait**: a carousel that asks your audience a question in the first 3 lines";
    } else if (["analyze", "performance", "what's working", "predict"].some((k) => lower.includes(k))) {
      const perf = brain.recentPerformance.slice(0, 8).map((p) => `${p.metric}=${p.value}`).join(", ");
      assistant =
        "Here's what your recent performance says (latest 30d):\n" +
        (perf ? "- Measured metrics: " + perf + "\n" : "- No metrics yet — run a seed or publish content to populate analytics.\n") +
        (brain.contentDna[0]?.hook
          ? "- Your strongest hook pattern: \"" + brain.contentDna[0].hook + "\" — reuse this style for +engagement.\n"
          : "") +
        (brain.verifiedMemories.length
          ? "- Verified facts I rely on: " + brain.verifiedMemories.slice(0, 3).map((m) => m.content).join("; ") + "\n"
          : "");
    } else if (["trend", "what's hot", "hashtag"].some((k) => lower.includes(k))) {
      assistant =
        (brain.trends.length
          ? "Trends I'm tracking right now:\n" + brain.trends.map((t) => `- **${t.title}** — ${t.description ?? ""}`).join("\n")
          : "No tracked trends yet. I can help you watch competitor activity and rising topics.") +
        "\n\nTip: pair a rising trend with your strongest pillar (" + (brain.pillars[0]?.name || "your niche") + ") for maximum lift.";
    } else if (["competitor", "competition", "rival"].some((k) => lower.includes(k))) {
      assistant =
        (brain.competitors.length
          ? "Competitors in your space:\n" + brain.competitors.map((c) => `- **${c.name}**: ${c.notes ?? "no notes yet"}`).join("\n")
          : "No competitors tracked yet.") +
        "\n\nRecommended playbook: publish 2 educational pieces per week — most competitors in your space focus on promotions, leaving an education gap.";
    } else {
      // Default — grounded answer via the model router (best provider w/ fallback)
      const llm = await aiGenerate({
        companyId,
        userId: auth.userId,
        capability: "writing",
        task: "chat",
        agent: "ai-chat",
        prompt: prompt.slice(0, 4000),
        jsonMode: false,
      });
      assistant =
        llm.text +
        "\n\nContext I used: " + (brain.brandRules[0] ? `brand rule "${brain.brandRules[0]}"` : "your workspace profile") +
        (brain.verifiedMemories.length ? ` · ${brain.verifiedMemories.length} verified facts` : "") +
        (brain.trends.length ? ` · ${brain.trends.length} tracked trends` : "");
    }

    return NextResponse.json({ response: assistant, sources: { memories: memories.length, context: contextPrompt.length } });
  } catch (e: unknown) {
    const err = e as Error;
    return NextResponse.json({ error: "AI request failed: " + err.message }, { status: 500 });
  }
}