import { DriverOnboardingStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { isDriverEligible } from "../services/driverEligibility";

vi.mock("../config/env", () => ({
  env: { demoMode: false, demoDriverEmail: "demo.driver@example.test" },
}));

const now = new Date("2026-04-15T12:00:00.000Z");
const verified = {
  isSimulated: false,
  user: { email: "ordinary.driver@example.test" },
  onboarding: {
    status: DriverOnboardingStatus.APPROVED,
    documents: [{ status: "APPROVED", expiryDate: new Date("2027-01-01T00:00:00.000Z") }],
  },
};

describe("driver dispatch eligibility", () => {
  it("allows verified drivers with unexpired documents", () => {
    expect(isDriverEligible(verified, { now })).toBe(true);
  });

  it("blocks missing, unapproved, or expired verification", () => {
    expect(isDriverEligible({ ...verified, onboarding: null }, { now })).toBe(false);
    expect(isDriverEligible({
      ...verified,
      onboarding: { ...verified.onboarding, status: DriverOnboardingStatus.UNDER_REVIEW },
    }, { now })).toBe(false);
    expect(isDriverEligible({
      ...verified,
      onboarding: {
        ...verified.onboarding,
        documents: [{ status: "PENDING", expiryDate: null }],
      },
    }, { now })).toBe(false);
    expect(isDriverEligible({
      ...verified,
      onboarding: {
        ...verified.onboarding,
        documents: [{ status: "APPROVED", expiryDate: new Date("2026-04-14T00:00:00.000Z") }],
      },
    }, { now })).toBe(false);
  });

  it("allows simulator drivers only for simulator allocation", () => {
    const simulated = { ...verified, isSimulated: true };
    expect(isDriverEligible(simulated, { now })).toBe(false);
    expect(isDriverEligible(simulated, { now, includeSimulated: true })).toBe(true);
  });
});
