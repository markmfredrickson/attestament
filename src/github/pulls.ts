/**
 * Fetch PR context for a commit and produce an AttestationPayload.
 *
 * Accepts pre-fetched data (no Octokit dependency in the function signature)
 * so tests can pass plain objects.
 */

import type {
  AttestationPayload,
  Review,
} from "../classify/attestation-types.js";
import type { GitHubPullRequest, GitHubReview } from "./types.js";

function buildReview(r: GitHubReview): Review {
  return {
    state: r.state,
    authorType: r.user?.type ?? "User",
    authorLogin: r.user?.login ?? "",
    commitId: r.commit_id ?? "",
  };
}

/** Pick the original PR — lowest number. */
function pickPr(
  pulls: GitHubPullRequest[],
): GitHubPullRequest | null {
  if (pulls.length === 0) return null;
  return pulls.reduce((min, pr) => (pr.number < min.number ? pr : min));
}

export function buildAttestationPayload(
  isAi: boolean,
  pulls: GitHubPullRequest[],
  reviews: GitHubReview[],
): AttestationPayload {
  if (!isAi) return { isAi: false, pr: null };

  const pr = pickPr(pulls);
  if (pr === null) return { isAi: true, pr: null };

  const headSha = pr.merge_commit_sha ?? pr.head.sha;

  return {
    isAi: true,
    pr: {
      reviews: reviews.map(buildReview),
      headShaAtMerge: headSha,
    },
  };
}
