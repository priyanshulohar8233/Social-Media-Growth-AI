import { describe, expect, it } from "vitest";
import { classifyIntent, classifySentiment } from "@/lib/intelligence/intent";

describe("classifySentiment", () => {
  it("detects positive messages", () => {
    expect(classifySentiment("I love this, amazing work!")).toBe("positive");
  });

  it("detects negative messages", () => {
    expect(classifySentiment("This is terrible, broken and useless")).toBe("negative");
  });

  it("detects questions", () => {
    expect(classifySentiment("How do I get early access?")).toBe("question");
  });

  it("returns neutral for empty or bland text", () => {
    expect(classifySentiment("")).toBe("neutral");
    expect(classifySentiment("noted")).toBe("neutral");
  });
});

describe("classifyIntent", () => {
  it("detects support requests", () => {
    expect(classifyIntent("I need help, login gives an error")).toBe("support");
  });

  it("detects sales interest", () => {
    expect(classifyIntent("What is the price? I want a demo")).toBe("sales");
  });

  it("detects spam", () => {
    expect(classifyIntent("click here to claim prize crypto winner")).toBe("spam");
  });

  it("detects feedback", () => {
    expect(classifyIntent("love your videos, I recommend them")).toBe("feedback");
  });

  it("falls back to general", () => {
    expect(classifyIntent("nice day today")).toBe("general");
  });
});
