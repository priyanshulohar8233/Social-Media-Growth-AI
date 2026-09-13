/*
 * Lightweight, deterministic message intelligence.
 * Sentiment + intent classification via lexicons (no provider key required).
 * Purpose-built for the social inbox: fast, private, auditable.
 */

const POSITIVE = ["love", "great", "amazing", "awesome", "thanks", "thank you", "best", "excellent", "wow", "helpful", "nice", "cool", "perfect", "beautiful"];
const NEGATIVE = ["hate", "bad", "worst", "terrible", "awful", "scam", "useless", "annoying", "broken", "not working", "refund", "disappointed", "waste", "poor", "fail"];
const QUESTION = ["?", "how", "what", "when", "where", "why", "which", "can you", "is it", "are you", "please help"];

const INTENT_SUPPORT = ["help", "issue", "problem", "broken", "not working", "error", "refund", "cancel", "unable", "can't", "cant", "fix", "support", "doesn't"];
const INTENT_SALES = ["price", "cost", "buy", "purchase", "quote", "book", "order", "demo", "pricing", "how much", "interested", "sell", "subscription"];
const INTENT_SPAM = ["free vip", "lottery", "winner", "click here", "bit.ly", "t.me/", "invest", "claim prize", "crypto", "earn money fast"];
const INTENT_FEEDBACK = ["love", "hate", "best", "worst", "amazing", "terrible", "recommend", "creator", "content", "videos", "posts", "love it"];

export interface MessageTone {
  sentiment: "positive" | "negative" | "neutral" | "question";
  intent: "support" | "sales" | "feedback" | "spam" | "general";
  replyTemplate: string | null;
}

export function injectMessageSentiment(content: string, provided?: string | null, channelType?: string | null): MessageTone {
  if (provided && ["positive", "negative", "neutral", "question"].includes(provided)) {
    return { sentiment: provided as MessageTone["sentiment"], intent: classifyIntent(content), replyTemplate: null };
  }
  const sentiment = classifySentiment(content);
  return {
    sentiment,
    intent: classifyIntent(content),
    replyTemplate: null,
  };
}

export function classifySentiment(content: string): MessageTone["sentiment"] {
  const text = content.toLowerCase().trim();
  if (!text) return "neutral";
  const hasQuestion = QUESTION.some((q) => text.includes(q));
  const posHits = POSITIVE.filter((w) => text.includes(w));
  const negHits = NEGATIVE.filter((w) => text.includes(w));
  if (posHits.length > negHits.length) return "positive";
  if (negHits.length > posHits.length) return "negative";
  return hasQuestion ? "question" : "neutral";
}

export function classifyIntent(content: string): MessageTone["intent"] {
  const text = content.toLowerCase();
  if (INTENT_SPAM.some((w) => text.includes(w))) return "spam";
  const support = countHits(text, INTENT_SUPPORT);
  const sales = countHits(text, INTENT_SALES);
  const feedback = countHits(text, INTENT_FEEDBACK);
  if (support > 0 && support >= sales && support >= feedback) return "support";
  if (sales > 0 && sales >= feedback) return "sales";
  if (feedback > 0) return "feedback";
  return "general";
}

function countHits(text: string, list: string[]): number {
  return list.reduce((n, w) => (text.includes(w) ? n + 1 : n), 0);
}

/** Templated suggested reply (grounded in intent/sentiment; NOT generative). */
export function suggestReply(input: { sentiment: MessageTone["sentiment"]; intent: MessageTone["intent"]; platform: string; channelType: string }): { text: string; tone: string } | null {
  if (input.intent === "spam") return null;
  const handle = input.platform === "instagram" ? "@username" : input.platform === "youtube" ? "@channel" : input.platform === "tiktok" ? "@user" : "there";
  switch (input.intent) {
    case "support":
      return { text: `Hi ${handle}, thanks for reaching out — we'd love to help. Could you share a few more details so we can sort this quickly?`, tone: "helpful" };
    case "sales":
      return { text: `Hi ${handle}, great question! Our team can share details and a tailored walkthrough — want me to connect you?`, tone: "conversational" };
    case "feedback":
      return input.sentiment === "negative"
        ? { text: `Hi ${handle}, we appreciate the honest feedback and apologize for the miss. Want to tell us more so we can make it right?`, tone: "empathetic" }
        : { text: `Hi ${handle}, that genuinely means a lot — thank you!`, tone: "warm" };
    default:
      return input.sentiment === "question"
        ? { text: `Hi ${handle}, happy to help with that — let me get an answer for you!`, tone: "helpful" }
        : { text: `Thanks for the message, ${handle}! Appreciate you taking the time to reach out.`, tone: "friendly" };
  }
}