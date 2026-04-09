/**
 * End-to-end classification pipeline.
 *
 * GitHub commit data in → (classification, attestation) out.
 */

import type { AttestationStatus } from "./classify/attestation-types.js";
import { classifyAttestation } from "./classify/attestation-classifier.js";
import type {
  ClassificationResult,
  CommitPayload,
} from "./classify/types.js";
import { classifyCommit } from "./classify/commit-classifier.js";
import { buildAttestationPayload } from "./github/pulls.js";
import type {
  GitHubCommit,
  GitHubPullRequest,
  GitHubReview,
} from "./github/types.js";

export type AuditResult = {
  readonly classification: ClassificationResult;
  readonly attestation: AttestationStatus;
};

function payloadFromGitHubCommit(commit: GitHubCommit): CommitPayload {
  return {
    message: commit.commit.message,
    authorLogin: commit.author?.login ?? null,
    authorType: commit.author?.type ?? null,
    authorEmail: commit.commit.author?.email ?? null,
    authorName: commit.commit.author?.name ?? null,
    committerEmail: commit.commit.committer?.email ?? null,
    committerName: commit.commit.committer?.name ?? null,
  };
}

export function auditCommit(
  commit: GitHubCommit,
  pulls: GitHubPullRequest[],
  reviews: GitHubReview[],
): AuditResult {
  const payload = payloadFromGitHubCommit(commit);
  const clsResult = classifyCommit(payload);
  const isAi = clsResult.classification.kind === "ai";

  const attPayload = buildAttestationPayload(isAi, pulls, reviews);
  const attestation = classifyAttestation(attPayload);

  return { classification: clsResult, attestation };
}
