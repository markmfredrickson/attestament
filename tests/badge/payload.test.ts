import { describe, expect, it } from "vitest";
import {
  buildPayload,
  canonicalize,
  type BadgePayload,
} from "../../src/badge/payload.js";

function samplePayload(): BadgePayload {
  return {
    repo: "owner/repo",
    branch: "main",
    asOfSha: "abc123",
    issuedAt: "2026-03-15T00:00:00Z",
    stats: { aiCommits: 42, humanReviewed: 38 },
    formatVersion: 1,
    methodology: "v1",
  };
}

describe("canonicalize", () => {
  it("produces sorted keys", () => {
    const parsed = JSON.parse(canonicalize(samplePayload()).toString());
    const keys = Object.keys(parsed);
    expect(keys).toEqual([...keys].sort());
    const statsKeys = Object.keys(parsed.stats);
    expect(statsKeys).toEqual([...statsKeys].sort());
  });

  it("produces no whitespace", () => {
    const text = canonicalize(samplePayload()).toString();
    expect(text).not.toMatch(/ /);
    expect(text).not.toMatch(/\n/);
  });

  it("is deterministic", () => {
    const a = canonicalize(samplePayload());
    const b = canonicalize(samplePayload());
    expect(a).toEqual(b);
  });

  it("round-trips all fields", () => {
    const parsed = JSON.parse(canonicalize(samplePayload()).toString());
    expect(parsed.repo).toBe("owner/repo");
    expect(parsed.branch).toBe("main");
    expect(parsed.as_of_sha).toBe("abc123");
    expect(parsed.format_version).toBe(1);
    expect(parsed.methodology).toBe("v1");
    expect(parsed.stats.ai_commits).toBe(42);
    expect(parsed.stats.human_reviewed).toBe(38);
  });

  it("matches the spec key set", () => {
    const parsed = JSON.parse(canonicalize(samplePayload()).toString());
    expect(new Set(Object.keys(parsed))).toEqual(
      new Set(["as_of_sha", "branch", "format_version", "issued_at", "methodology", "repo", "stats"]),
    );
  });
});

describe("buildPayload", () => {
  it("sets issued_at with ISO 8601 UTC", () => {
    const payload = buildPayload("owner/repo", "main", "sha123", {
      aiCommits: 1,
      humanReviewed: 1,
    });
    expect(payload.issuedAt).toMatch(/Z$/);
    expect(payload.issuedAt).toMatch(/T/);
  });
});
