import { describe, expect, it } from "vitest";
import { classifyAttestation } from "../../src/classify/attestation-classifier.js";
import { buildAttestationPayload } from "../../src/github/pulls.js";
import type { GitHubPullRequest, GitHubReview } from "../../src/github/types.js";

describe("buildAttestationPayload", () => {
  it("human commit skips PR context", () => {
    const payload = buildAttestationPayload(false, [], []);
    expect(payload).toEqual({ isAi: false, pr: null });
  });

  it("no associated PR", () => {
    const payload = buildAttestationPayload(true, [], []);
    expect(payload).toEqual({ isAi: true, pr: null });
    expect(classifyAttestation(payload)).toEqual({ kind: "unattested", reason: "no-pr" });
  });

  it("picks lowest PR number", () => {
    const pulls: GitHubPullRequest[] = [
      { number: 10, merge_commit_sha: "sha10", head: { sha: "h10" } },
      { number: 3, merge_commit_sha: "sha3", head: { sha: "h3" } },
      { number: 7, merge_commit_sha: "sha7", head: { sha: "h7" } },
    ];
    const payload = buildAttestationPayload(true, pulls, []);
    expect(payload.pr?.headShaAtMerge).toBe("sha3");
  });

  it("approved PR → attested", () => {
    const pulls: GitHubPullRequest[] = [
      { number: 1, merge_commit_sha: "abc123", head: { sha: "abc123" } },
    ];
    const reviews: GitHubReview[] = [
      { state: "APPROVED", user: { login: "bob", type: "User" }, commit_id: "abc123" },
    ];
    const payload = buildAttestationPayload(true, pulls, reviews);
    expect(classifyAttestation(payload)).toEqual({ kind: "attested" });
  });

  it("approval on old SHA → approved-then-modified", () => {
    const pulls: GitHubPullRequest[] = [
      { number: 1, merge_commit_sha: "new222", head: { sha: "new222" } },
    ];
    const reviews: GitHubReview[] = [
      { state: "APPROVED", user: { login: "bob", type: "User" }, commit_id: "old111" },
    ];
    const payload = buildAttestationPayload(true, pulls, reviews);
    expect(classifyAttestation(payload)).toEqual({ kind: "unattested", reason: "approved-then-modified" });
  });

  it("bot review only → ai-reviewed-only", () => {
    const pulls: GitHubPullRequest[] = [
      { number: 1, merge_commit_sha: "abc123", head: { sha: "abc123" } },
    ];
    const reviews: GitHubReview[] = [
      { state: "APPROVED", user: { login: "codecov[bot]", type: "Bot" }, commit_id: "abc123" },
    ];
    const payload = buildAttestationPayload(true, pulls, reviews);
    expect(classifyAttestation(payload)).toEqual({ kind: "unattested", reason: "ai-reviewed-only" });
  });

  it("null user on review → treated as human", () => {
    const pulls: GitHubPullRequest[] = [
      { number: 1, merge_commit_sha: "abc123", head: { sha: "abc123" } },
    ];
    const reviews: GitHubReview[] = [
      { state: "COMMENTED", user: null, commit_id: "abc123" },
    ];
    const payload = buildAttestationPayload(true, pulls, reviews);
    expect(payload.pr!.reviews[0].authorType).toBe("User");
    expect(payload.pr!.reviews[0].authorLogin).toBe("");
  });

  it("null merge_commit_sha falls back to head SHA", () => {
    const pulls: GitHubPullRequest[] = [
      { number: 1, merge_commit_sha: null, head: { sha: "head999" } },
    ];
    const reviews: GitHubReview[] = [
      { state: "APPROVED", user: { login: "alice", type: "User" }, commit_id: "head999" },
    ];
    const payload = buildAttestationPayload(true, pulls, reviews);
    expect(payload.pr!.headShaAtMerge).toBe("head999");
    expect(classifyAttestation(payload)).toEqual({ kind: "attested" });
  });

  it("multiple reviews all mapped", () => {
    const pulls: GitHubPullRequest[] = [
      { number: 1, merge_commit_sha: "abc123", head: { sha: "abc123" } },
    ];
    const reviews: GitHubReview[] = [
      { state: "COMMENTED", user: { login: "alice", type: "User" }, commit_id: "abc123" },
      { state: "APPROVED", user: { login: "bob", type: "User" }, commit_id: "abc123" },
      { state: "COMMENTED", user: { login: "codecov[bot]", type: "Bot" }, commit_id: "abc123" },
    ];
    const payload = buildAttestationPayload(true, pulls, reviews);
    expect(payload.pr!.reviews).toHaveLength(3);
    expect(classifyAttestation(payload)).toEqual({ kind: "attested" });
  });
});
