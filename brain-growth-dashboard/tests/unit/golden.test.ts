import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { classifyIntent, classifySentiment } from "@/lib/intelligence/intent";
import { threatLabel } from "@/lib/competitors/warroom";
import { confidenceFor } from "@/lib/brain/learn";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function loadGolden<T>(name: string): T {
  return JSON.parse(readFileSync(path.join(ROOT, "eval", "golden", name), "utf8")) as T;
}

describe("golden: sentiment", () => {
  const cases = loadGolden<Array<{ input: string; sentiment: string }>>("sentiment.json");
  for (const c of cases) {
    it(`"${c.input.slice(0, 40)}" -> ${c.sentiment}`, () => {
      expect(classifySentiment(c.input)).toBe(c.sentiment);
    });
  }
});

describe("golden: intent", () => {
  const cases = loadGolden<Array<{ input: string; intent: string }>>("intent.json");
  for (const c of cases) {
    it(`"${c.input.slice(0, 40)}" -> ${c.intent}`, () => {
      expect(classifyIntent(c.input)).toBe(c.intent);
    });
  }
});

describe("golden: threat labels", () => {
  const cases = loadGolden<Array<{ score: number; label: string }>>("threat.json");
  for (const c of cases) {
    it(`score ${c.score} -> ${c.label}`, () => {
      expect(threatLabel(c.score)).toBe(c.label);
    });
  }
});

describe("golden: confidence ordering", () => {
  const cases = loadGolden<
    Array<{
      name: string;
      a: Parameters<typeof confidenceFor>[0];
      b: Parameters<typeof confidenceFor>[0];
      higher: "a" | "b";
    }>
  >("confidence-ordering.json");
  for (const c of cases) {
    it(c.name, () => {
      const ca = confidenceFor(c.a);
      const cb = confidenceFor(c.b);
      expect(c.higher === "b" ? cb > ca : ca > cb).toBe(true);
    });
  }
});
