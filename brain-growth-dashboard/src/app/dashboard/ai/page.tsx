"use client";

import { useRef, useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Send, Bot, User, Loader2, Sparkles, Lightbulb, TrendingUp, PenTool, Plus, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCompany } from "@/lib/company-context";
import { apiFetch } from "@/lib/api-client";
import { AiGenerator } from "./ai-generator";

const suggestions = [
  { icon: PenTool, title: "Write a caption", prompt: "Write an engaging Instagram caption for a tech startup announcing a new AI feature" },
  { icon: TrendingUp, title: "Analyze my content", prompt: "Analyze my recent posts and suggest improvements for better engagement" },
  { icon: Lightbulb, title: "Content ideas", prompt: "Give me 10 content ideas for a social media management SaaS" },
  { icon: Sparkles, title: "Optimize hashtags", prompt: "Suggest trending hashtags for a post about AI-powered marketing tools" },
];

interface Message {
  role: "user" | "assistant";
  content: string;
}

function renderMarkdown(text: string): React.ReactNode {
  const parts = text.split(/(\*\*.*?\*\*|\n)/g);
  return parts.map((part, i) => {
    if (part === "\n") return <br key={i} />;
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

const WELCOME = { role: "assistant" as const, content: "Hello! I'm your AI copilot. I can help you create content, analyze performance, and optimize your strategy. What would you like to work on today?" };

export default function AIPage() {
  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id;
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"copilot" | "generator">("copilot");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    if (!companyId) return;
    const userMessage = input;
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setInput("");
    setLoading(true);

    try {
      const res = await apiFetch(`/api/companies/${companyId}/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage, history: messages.slice(-8) }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.response || "I'm sorry, I couldn't process that request." }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "I'm sorry, there was an error. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  const resetSession = () => {
    setMessages([WELCOME]);
    setInput("");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI studio"
        description="Your AI copilot for strategy, content and analysis."
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-line bg-surface p-0.5">
              <Button size="sm" variant={mode === "copilot" ? "default" : "ghost"} onClick={() => setMode("copilot")}><Bot className="mr-1.5 h-3.5 w-3.5" /> Copilot</Button>
              <Button size="sm" variant={mode === "generator" ? "default" : "ghost"} onClick={() => setMode("generator")}><Wand2 className="mr-1.5 h-3.5 w-3.5" /> Generator</Button>
            </div>
            <Button onClick={resetSession}>
              <Plus className="mr-1.5 h-4 w-4" /> New session
            </Button>
          </div>
        }
      />

      {mode === "generator" ? (
        <AiGenerator />
      ) : (
      <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {suggestions.map((s) => (
          <Card key={s.title} className="group cursor-pointer transition-colors hover:border-accent/40" onClick={() => setInput(s.prompt)}>
            <div className="flex items-center gap-3 p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent transition-colors group-hover:bg-accent group-hover:text-white">
                <s.icon className="h-4 w-4" />
              </span>
              <span className="text-sm font-medium text-ink">{s.title}</span>
            </div>
          </Card>
        ))}
      </div>

      <Card className="flex h-[520px] flex-col">
        <div className="flex items-center justify-between border-b border-line-2 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent-soft text-accent"><Bot className="h-3.5 w-3.5" /></span>
            <h2 className="h3 text-ink">AI copilot</h2>
          </div>
          <span className="text-xs text-ink-3">Responses are AI-generated</span>
        </div>

        <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          {messages.map((msg, i) => (
            <div key={i} className={cn("flex gap-3", msg.role === "user" && "flex-row-reverse")}>
              <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full", msg.role === "assistant" ? "bg-sunken text-ink-2" : "bg-accent text-white")}>
                {msg.role === "assistant" ? <Bot className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
              </div>
              <div className={cn("max-w-[80%] rounded-lg px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap", msg.role === "user" ? "bg-accent text-white" : "bg-sunken text-ink")}>
                {msg.role === "assistant" ? renderMarkdown(msg.content) : msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sunken text-ink-2"><Bot className="h-3.5 w-3.5" /></div>
              <div className="rounded-lg bg-sunken px-3.5 py-2.5"><Loader2 className="h-4 w-4 animate-spin text-accent" /></div>
            </div>
          )}
        </div>

        <div className="border-t border-line-2 p-4">
          <div className="flex gap-2">
            <Input
              placeholder="Ask me anything about your social media..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              className="flex-1"
              disabled={loading}
              aria-label="Message the AI copilot"
            />
            <Button onClick={handleSend} disabled={loading || !input.trim()} size="icon" className="h-9 w-9 shrink-0" aria-label="Send message">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </Card>
      </>
      )}
    </div>
  );
}