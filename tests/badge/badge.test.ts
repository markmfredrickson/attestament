import { describe, expect, it } from "vitest";
import { makeBadge } from "../../src/badge/badge.js";
import { generateKeypair, verifySignature } from "../../src/badge/signer.js";

describe("makeBadge", () => {
  it("eligible repo → signed badge with valid signature", () => {
    const { privateKey, publicKey } = generateKeypair();
    const result = makeBadge(
      "owner/repo",
      "main",
      { kind: "eligible" },
      {
        stats: { aiCommits: 5, humanReviewed: 3 },
        asOfSha: "abc123",
        totalCommits: 10,
      },
      privateKey,
    );

    expect(result.kind).toBe("signed-badge");
    if (result.kind !== "signed-badge") return;

    expect(result.payload.repo).toBe("owner/repo");
    expect(result.payload.branch).toBe("main");
    expect(result.payload.stats.aiCommits).toBe(5);
    expect(result.payload.stats.humanReviewed).toBe(3);
    expect(verifySignature(result.payloadJson, result.signature, publicKey)).toBe(true);
  });

  it("ineligible branch → badge error", () => {
    const { privateKey } = generateKeypair();
    const result = makeBadge(
      "owner/repo",
      "main",
      { kind: "ineligible", reason: "admins-exempt" },
      { stats: { aiCommits: 0, humanReviewed: 0 }, asOfSha: "", totalCommits: 0 },
      privateKey,
    );

    expect(result.kind).toBe("badge-error");
    if (result.kind !== "badge-error") return;
    expect(result.reason).toContain("admins-exempt");
  });
});
