import { describe, expect, it } from "vitest";
import { checkBadgeEligibility } from "../../src/github/branch-protection.js";

describe("checkBadgeEligibility", () => {
  it("eligible with reviews required + enforce_admins", () => {
    expect(
      checkBadgeEligibility({
        required_pull_request_reviews: { required_approving_review_count: 1 },
        enforce_admins: { enabled: true },
      }),
    ).toEqual({ kind: "eligible" });
  });

  it("no protection → ineligible", () => {
    expect(checkBadgeEligibility(null)).toEqual({
      kind: "ineligible",
      reason: "no-branch-protection",
    });
  });

  it("no review requirement", () => {
    expect(
      checkBadgeEligibility({
        required_pull_request_reviews: null,
        enforce_admins: { enabled: true },
      }),
    ).toEqual({ kind: "ineligible", reason: "no-review-requirement" });
  });

  it("zero approvals required", () => {
    expect(
      checkBadgeEligibility({
        required_pull_request_reviews: { required_approving_review_count: 0 },
        enforce_admins: { enabled: true },
      }),
    ).toEqual({ kind: "ineligible", reason: "no-review-requirement" });
  });

  it("admins exempt", () => {
    expect(
      checkBadgeEligibility({
        required_pull_request_reviews: { required_approving_review_count: 1 },
        enforce_admins: { enabled: false },
      }),
    ).toEqual({ kind: "ineligible", reason: "admins-exempt" });
  });

  it("two approvals required → still eligible", () => {
    expect(
      checkBadgeEligibility({
        required_pull_request_reviews: { required_approving_review_count: 2 },
        enforce_admins: { enabled: true },
      }),
    ).toEqual({ kind: "eligible" });
  });
});
