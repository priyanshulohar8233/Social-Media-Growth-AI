"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { BookOpen, MessageCircle, Video, FileText, ExternalLink, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const resources = [
  { icon: BookOpen, title: "Getting started guide", description: "Learn the basics of BrainGrow and set up your dashboard.", tone: "bg-accent-soft text-accent" },
  { icon: Video, title: "Video tutorials", description: "Step-by-step video walkthroughs for every feature.", tone: "bg-info-500/10 text-info-600 dark:text-info-400" },
  { icon: FileText, title: "API documentation", description: "Integrate BrainGrow with your own tools and workflows.", tone: "bg-warning-500/10 text-warning-600 dark:text-warning-400" },
  { icon: MessageCircle, title: "Community forum", description: "Ask questions, share tips, and connect with other users.", tone: "bg-success-500/10 text-success-600 dark:text-success-400" },
];

const faqs = [
  { q: "How do I connect my social media accounts?", a: "Go to Settings > Connected Accounts and click 'Connect' next to the platform you want to link. Follow the authorization prompts." },
  { q: "Can I schedule posts in advance?", a: "Yes! Go to Content, click 'Create Post', and use the scheduling option to set a future date and time." },
  { q: "How does the AI assistant work?", a: "The AI assistant uses advanced language models to create content, analyze performance, and optimize your strategy based on your account data." },
  { q: "What analytics are available?", a: "We provide views, engagement, follower growth, audience demographics, best posting times, and content performance across all connected platforms." },
];

export default function HelpPage() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="space-y-6">
      <PageHeader title="Help & resources" description="Everything you need to get the most out of BrainGrow." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {resources.map((r) => (
          <Card key={r.title} className="group cursor-pointer transition-colors hover:border-accent/40">
            <div className="p-5">
              <span className={cn("mb-3 flex h-9 w-9 items-center justify-center rounded-md", r.tone)}>
                <r.icon className="h-4 w-4" />
              </span>
              <h3 className="mb-1 text-sm font-semibold text-ink">{r.title}</h3>
              <p className="mb-3 text-sm text-ink-3">{r.description}</p>
              <span className="flex items-center gap-1 text-xs font-medium text-accent">
                Learn more <ExternalLink className="h-3 w-3" />
              </span>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <div className="border-b border-line-2 p-5">
          <h2 className="h3 text-ink">Frequently asked questions</h2>
        </div>
        <div className="divide-y divide-line-2">
          {faqs.map((faq, i) => {
            const isOpen = open === i;
            return (
              <div key={i}>
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-sunken"
                >
                  <span className="text-sm font-medium text-ink">{faq.q}</span>
                  <ChevronDown className={cn("h-4 w-4 shrink-0 text-ink-3 transition-transform duration-200", isOpen && "rotate-180")} />
                </button>
                {isOpen && (
                  <div className="px-5 pb-4">
                    <p className="text-sm leading-relaxed text-ink-2">{faq.a}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <div className="p-5">
          <h2 className="h3 mb-2 text-ink">Contact support</h2>
          <p className="mb-4 text-sm text-ink-3">Can&apos;t find what you&apos;re looking for? Our support team is here to help.</p>
          <div className="flex gap-2">
            <Button>Email support</Button>
            <Button variant="outline">Live chat</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}