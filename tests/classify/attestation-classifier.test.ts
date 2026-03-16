import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { classifyAttestation } from "../../src/classify/attestation-classifier.js";
import type {
  AttestationPayload,
  AttestationStatus,
  Review,
} from "../../src/classify/attestation-types.js";

// ── Fixture loading ─────────────────────────────────────────────────────────

type FixtureReview = {
  state: string;
  author_type: string;
  author_login: string;
  commit_id: string;
};

type FixturePR = {
  head_sha_at_merge: string;
  reviews: FixtureReview[];
};

type FixtureCase = {
  description: string;
  signals: { is_ai: boolean; pr: FixturePR | null };
  expected_attestation: { kind: string; reason?: string };
};

const FIXTURES: FixtureCase[] = JSON.parse(
  readFileSync(
    resolve(__dirname, "../fixtures/attestation-cases.json"),
    "utf-8",
  ),
);

function buildPayload(signals: FixtureCase["signals"]): AttestationPayload {
  if (signals.pr === null) return { isAi: signals.is_ai, pr: null };
  return {
    isAi: signals.is_ai,
    pr: {
      headShaAtMerge: signals.pr.head_sha_at_merge,
      reviews: signals.pr.reviews.map(
        (r): Review => ({
          state: r.state,
          authorType: r.author_type,
          authorLogin: r.author_login,
          commitId: r.commit_id,
        }),
      ),
    },
  };
}

function parseExpected(d: {
  kind: string;
  reason?: string;
}): AttestationStatus {
  if (d.kind === "all-human") return { kind: "all-human" };
  if (d.kind === "attested") return { kind: "attested" };
  return { kind: "unattested", reason: d.reason! };
}

// ── Data-driven tests ───────────────────────────────────────────────────────

describe("classifyAttestation (fixtures)", () => {
  for (const fixture of FIXTURES) {
    it(fixture.description, () => {
      const payload = buildPayload(fixture.signals);
      const expected = parseExpected(fixture.expected_attestation);
      expect(classifyAttestation(payload)).toEqual(expected);
    });
  }
});

// ── Edge cases ──────────────────────────────────────────────────────────────

describe("classifyAttestation (edge cases)", () => {
  it("CHANGES_REQUESTED then APPROVED by same reviewer → attested", () => {
    const payload: AttestationPayload = {
      isAi: true,
      pr: {
        headShaAtMerge: "abc123",
        reviews: [
          { state: "CHANGES_REQUESTED", authorType: "User", authorLogin: "alice", commitId: "abc123" },
          { state: "APPROVED", authorType: "User", authorLogin: "alice", commitId: "abc123" },
        ],
      },
    };
    expect(classifyAttestation(payload)).toEqual({ kind: "attested" });
  });

  it("empty reviews after dedup → no-reviews", () => {
    const payload: AttestationPayload = {
      isAi: true,
      pr: { headShaAtMerge: "abc123", reviews: [] },
    };
    expect(classifyAttestation(payload)).toEqual({
      kind: "unattested",
      reason: "no-reviews",
    });
  });
});
