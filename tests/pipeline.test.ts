import { describe, expect, it } from "vitest";
import { auditCommit } from "../src/pipeline.js";
import type { GitHubCommit, GitHubPullRequest, GitHubReview } from "../src/github/types.js";

const defaultCommit: GitHubCommit = {
  sha: "abc123",
  commit: {
    message: "fix: a bug",
    author: { email: "alice@example.com", name: "Alice" },
    committer: { email: "alice@example.com", name: "Alice" },
  },
  author: { login: "alice", type: "User" },
  committer: { login: "alice", type: "User" },
};

describe("auditCommit", () => {
  it("human commit → Human + AllHuman", () => {
    const result = auditCommit(defaultCommit, [], []);
    expect(result.classification.classification).toEqual({ kind: "human" });
    expect(result.attestation).toEqual({ kind: "all-human" });
  });

  it("AI commit with no PR → Ai + Unattested(no-pr)", () => {
    const commit: GitHubCommit = {
      ...defaultCommit,
      commit: {
        ...defaultCommit.commit,
        message: "fix\n\nCo-Authored-By: Claude <noreply@anthropic.com>",
      },
    };
    const result = auditCommit(commit, [], []);
    expect(result.classification.classification).toEqual({ kind: "ai", agent: "claude" });
    expect(result.attestation).toEqual({ kind: "unattested", reason: "no-pr" });
  });

  it("AI commit with approved PR → Ai + Attested", () => {
    const commit: GitHubCommit = {
      ...defaultCommit,
      commit: {
        ...defaultCommit.commit,
        message: "fix\n\nCo-Authored-By: Claude <noreply@anthropic.com>",
      },
    };
    const pulls: GitHubPullRequest[] = [
      { number: 1, merge_commit_sha: "abc123", head: { sha: "abc123" } },
    ];
    const reviews: GitHubReview[] = [
      { state: "APPROVED", user: { login: "bob", type: "User" }, commit_id: "abc123" },
    ];
    const result = auditCommit(commit, pulls, reviews);
    expect(result.classification.classification).toEqual({ kind: "ai", agent: "claude" });
    expect(result.attestation).toEqual({ kind: "attested" });
  });

  it("AI commit approved on old SHA → approved-then-modified", () => {
    const commit: GitHubCommit = {
      ...defaultCommit,
      commit: {
        ...defaultCommit.commit,
        message: "fix\n\nCo-Authored-By: Claude <noreply@anthropic.com>",
      },
    };
    const pulls: GitHubPullRequest[] = [
      { number: 1, merge_commit_sha: "new222", head: { sha: "new222" } },
    ];
    const reviews: GitHubReview[] = [
      { state: "APPROVED", user: { login: "bob", type: "User" }, commit_id: "old111" },
    ];
    const result = auditCommit(commit, pulls, reviews);
    expect(result.attestation).toEqual({ kind: "unattested", reason: "approved-then-modified" });
  });

  it("Bot commit with no reviews → Ai + Unattested(no-reviews)", () => {
    const commit: GitHubCommit = {
      ...defaultCommit,
      commit: { ...defaultCommit.commit, message: "bump lodash" },
      author: { login: "dependabot[bot]", type: "Bot" },
    };
    const pulls: GitHubPullRequest[] = [
      { number: 1, merge_commit_sha: "abc123", head: { sha: "abc123" } },
    ];
    const result = auditCommit(commit, pulls, []);
    expect(result.classification.classification).toEqual({ kind: "ai", agent: "dependabot" });
    expect(result.attestation).toEqual({ kind: "unattested", reason: "no-reviews" });
  });

  it("null author fields do not throw", () => {
    const commit: GitHubCommit = {
      sha: "abc123",
      commit: { message: "fix", author: null, committer: null },
      author: null,
      committer: null,
    };
    const result = auditCommit(commit, [], []);
    expect(result.classification.classification).toEqual({ kind: "human" });
    expect(result.attestation).toEqual({ kind: "all-human" });
  });
});
