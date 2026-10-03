import { describe, expect, it, vi, beforeEach } from "vitest";
import { rateLimit } from "@/lib/rate-limit";

describe("rateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("allows up to the limit then rejects", () => {
    const key = `test-${Date.now()}-a`;
    for (let i = 0; i < 5; i++) {
      expect(rateLimit(key, { limit: 5 }).ok).toBe(true);
    }
    const denied = rateLimit(key, { limit: 5 });
    expect(denied.ok).toBe(false);
    expect(denied.remaining).toBe(0);
  });

  it("resets after the window passes", () => {
    const key = `test-${Date.now()}-b`;
    for (let i = 0; i < 3; i++) rateLimit(key, { limit: 3, windowMs: 1000 });
    expect(rateLimit(key, { limit: 3, windowMs: 1000 }).ok).toBe(false);
    vi.advanceTimersByTime(1001);
    expect(rateLimit(key, { limit: 3, windowMs: 1000 }).ok).toBe(true);
  });

  it("tracks keys independently", () => {
    const a = `test-${Date.now()}-c1`;
    const b = `test-${Date.now()}-c2`;
    rateLimit(a, { limit: 1 });
    expect(rateLimit(a, { limit: 1 }).ok).toBe(false);
    expect(rateLimit(b, { limit: 1 }).ok).toBe(true);
  });

  it("fails open instead of throwing", () => {
    expect(() => rateLimit(null as unknown as string)).not.toThrow();
  });
});
