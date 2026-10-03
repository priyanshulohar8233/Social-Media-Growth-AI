import { describe, expect, it } from "vitest";
import { threatLabel } from "@/lib/competitors/warroom";

describe("threatLabel", () => {
  it.each([
    [96, "Critical"],
    [75, "Critical"],
    [74, "High"],
    [55, "High"],
    [54, "Moderate"],
    [38, "Moderate"],
    [37, "Low"],
    [6, "Low"],
  ])("maps score %i to %s", (score, label) => {
    expect(threatLabel(score)).toBe(label);
  });
});
