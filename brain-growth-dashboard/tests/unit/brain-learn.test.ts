import { describe, expect, it } from "vitest";
import { confidenceFor } from "@/lib/brain/learn";

describe("confidenceFor", () => {
  it("scores a fresh FACT near the top of the range", () => {
    const c = confidenceFor({ type: "FACT", evidenceCount: 1, sampleSize: 1, ageDays: 0, lastReinforcedDays: 0 });
    expect(c).toBeGreaterThan(0.9);
    expect(c).toBeLessThanOrEqual(1);
  });

  it("caps the evidence boost so confidence never exceeds 1", () => {
    const c = confidenceFor({ type: "FACT", evidenceCount: 100, sampleSize: 1000, ageDays: 0, lastReinforcedDays: 0 });
    expect(c).toBeLessThanOrEqual(1);
  });

  it("decays with age up to the hard cap", () => {
    const fresh = confidenceFor({ type: "OBSERVATION", evidenceCount: 1, sampleSize: 1, ageDays: 0, lastReinforcedDays: 0 });
    const old = confidenceFor({ type: "OBSERVATION", evidenceCount: 1, sampleSize: 1, ageDays: 365, lastReinforcedDays: 0 });
    expect(old).toBeLessThan(fresh);
    expect(fresh - old).toBeCloseTo(0.25, 5);
  });

  it("decays without reinforcement up to the stale cap", () => {
    const fresh = confidenceFor({ type: "INFERENCE", evidenceCount: 2, sampleSize: 5, ageDays: 0, lastReinforcedDays: 0 });
    const stale = confidenceFor({ type: "INFERENCE", evidenceCount: 2, sampleSize: 5, ageDays: 0, lastReinforcedDays: 60 });
    expect(stale).toBeLessThan(fresh);
    expect(fresh - stale).toBeCloseTo(0.2, 5);
  });

  it("clamps at zero for weak, old predictions", () => {
    const c = confidenceFor({ type: "PREDICTION", evidenceCount: 0, sampleSize: 0, ageDays: 365, lastReinforcedDays: 60 });
    expect(c).toBe(0);
  });

  it("is monotonic in evidence", () => {
    const a = confidenceFor({ type: "INFERENCE", evidenceCount: 1, sampleSize: 1, ageDays: 0, lastReinforcedDays: 0 });
    const b = confidenceFor({ type: "INFERENCE", evidenceCount: 4, sampleSize: 1, ageDays: 0, lastReinforcedDays: 0 });
    expect(b).toBeGreaterThan(a);
  });
});
