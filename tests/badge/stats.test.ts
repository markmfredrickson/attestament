import { describe, expect, it } from "vitest";
import { aggregateStats } from "../../src/badge/stats.js";
import type { AuditResult } from "../../src/pipeline.js";

function humanResult(): AuditResult {
  return {
    classification: { classification: { kind: "human" }, coAuthors: [] },
    attestation: { kind: "all-human" },
  };
}

function aiAttested(): AuditResult {
  return {
    classification: { classification: { kind: "ai", agent: "claude" }, coAuthors: [] },
    attestation: { kind: "attested" },
  };
}

function aiUnattested(): AuditResult {
  return {
    classification: { classification: { kind: "ai", agent: "claude" }, coAuthors: [] },
    attestation: { kind: "unattested", reason: "no-pr" },
  };
}

describe("aggregateStats", () => {
  it("all human repo", () => {
    const result = aggregateStats([
      { sha: "h1", audit: humanResult() },
      { sha: "h2", audit: humanResult() },
      { sha: "h3", audit: humanResult() },
    ]);
    expect(result.totalCommits).toBe(3);
    expect(result.stats.aiCommits).toBe(0);
    expect(result.stats.humanReviewed).toBe(0);
    expect(result.asOfSha).toBe("h1");
  });

  it("mixed repo", () => {
    const result = aggregateStats([
      { sha: "a1", audit: aiAttested() },
      { sha: "h1", audit: humanResult() },
      { sha: "u1", audit: aiUnattested() },
      { sha: "h2", audit: humanResult() },
    ]);
    expect(result.totalCommits).toBe(4);
    expect(result.stats.aiCommits).toBe(2);
    expect(result.stats.humanReviewed).toBe(1);
  });

  it("all AI unattested", () => {
    const result = aggregateStats([
      { sha: "u1", audit: aiUnattested() },
      { sha: "u2", audit: aiUnattested() },
    ]);
    expect(result.stats.aiCommits).toBe(2);
    expect(result.stats.humanReviewed).toBe(0);
  });

  it("empty repo", () => {
    const result = aggregateStats([]);
    expect(result.totalCommits).toBe(0);
    expect(result.stats.aiCommits).toBe(0);
    expect(result.asOfSha).toBe("");
  });
});
