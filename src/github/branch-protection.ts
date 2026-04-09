/**
 * Branch protection verification.
 *
 * A badge is only valid for branches where PRs are enforced. Without
 * enforcement, the audit trail cannot be trusted.
 */

import type { GitHubBranchProtection } from "./types.js";

export type Eligible = { readonly kind: "eligible" };
export type Ineligible = { readonly kind: "ineligible"; readonly reason: string };
export type BadgeEligibility = Eligible | Ineligible;

export function checkBadgeEligibility(
  protection: GitHubBranchProtection | null,
): BadgeEligibility {
  if (protection === null) {
    return { kind: "ineligible", reason: "no-branch-protection" };
  }

  const prReviews = protection.required_pull_request_reviews;
  if (!prReviews || prReviews.required_approving_review_count < 1) {
    return { kind: "ineligible", reason: "no-review-requirement" };
  }

  const enforceAdmins = protection.enforce_admins;
  if (!enforceAdmins?.enabled) {
    return { kind: "ineligible", reason: "admins-exempt" };
  }

  return { kind: "eligible" };
}
