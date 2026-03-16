/**
 * Attestation classification.
 * Given a commit's AI classification and its PR context, determine whether
 * a human attested to the code before merge.
 */

import type {
  AllHuman,
  Attested,
  AttestationPayload,
  AttestationStatus,
  Review,
  Unattested,
} from "./attestation-types.js";

const allHuman = (): AllHuman => ({ kind: "all-human" });
const attested = (): Attested => ({ kind: "attested" });
const unattested = (reason: string): Unattested => ({
  kind: "unattested",
  reason,
});

/** Keep only the last review per authorLogin (preserving order of last occurrence). */
function latestReviewsPerAuthor(reviews: Review[]): Review[] {
  const seen = new Map<string, Review>();
  for (const review of reviews) {
    seen.set(review.authorLogin, review);
  }
  return [...seen.values()];
}

export function classifyAttestation(
  payload: AttestationPayload,
): AttestationStatus {
  if (!payload.isAi) return allHuman();

  if (payload.pr === null) return unattested("no-pr");

  const { reviews, headShaAtMerge } = payload.pr;
  if (reviews.length === 0) return unattested("no-reviews");

  const deduped = latestReviewsPerAuthor(reviews);

  const humanReviews = deduped.filter((r) => r.authorType === "User");
  const botReviews = deduped.filter((r) => r.authorType === "Bot");

  const humanApprovals = humanReviews.filter((r) => r.state === "APPROVED");
  if (humanApprovals.length > 0) {
    const latest = humanApprovals[humanApprovals.length - 1];
    if (latest.commitId === headShaAtMerge) return attested();
    return unattested("approved-then-modified");
  }

  if (humanReviews.length > 0) return unattested("human-commented");
  if (botReviews.length > 0) return unattested("ai-reviewed-only");

  return unattested("no-reviews");
}
