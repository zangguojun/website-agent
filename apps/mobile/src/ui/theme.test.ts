import { describe, expect, it } from "vitest";

import { colors, radius, shadow, spacing, typeScale } from "./theme";

/** Task 2：Native Calm 令牌契约，防止无意篡改设计基线 */
describe("Native Calm theme tokens", () => {
  it("exports core palette keys from plan §Task 2", () => {
    expect(colors.background).toBe("#F8FAFC");
    expect(colors.primaryBlue).toBe("#2563EB");
    expect(colors.reportDark).toBe("#101827");
  });

  it("keeps rhythm scales strictly positive numbers", () => {
    expect(Object.values(spacing).every((n) => n > 0)).toBe(true);
    expect(Object.values(radius).every((n) => n > 0)).toBe(true);
    expect(Object.values(typeScale).every((n) => n > 0)).toBe(true);
  });

  it("defines card shadow consumable by StyleSheet spread", () => {
    expect(shadow.card.shadowColor).toBe("#0F172A");
    expect(shadow.card.shadowOpacity).toBeGreaterThan(0);
  });
});
