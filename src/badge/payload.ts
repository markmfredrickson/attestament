/**
 * Badge payload construction and canonical JSON serialization.
 *
 * Canonical JSON follows RFC 8785 / JCS: sorted keys, no extra whitespace.
 * For this payload (strings, integers, no floats, no Unicode edge cases),
 * manually constructing the object with sorted keys + JSON.stringify with
 * compact separators is sufficient.
 */

export type BadgeStats = {
  readonly aiCommits: number;
  readonly humanReviewed: number;
};

export type BadgePayload = {
  readonly repo: string;
  readonly branch: string;
  readonly asOfSha: string;
  readonly issuedAt: string;
  readonly stats: BadgeStats;
  readonly formatVersion: number;
  readonly methodology: string;
};

export function buildPayload(
  repo: string,
  branch: string,
  asOfSha: string,
  stats: BadgeStats,
): BadgePayload {
  return {
    repo,
    branch,
    asOfSha,
    issuedAt: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    stats,
    formatVersion: 1,
    methodology: "v1",
  };
}

export function canonicalize(payload: BadgePayload): Buffer {
  const obj = {
    as_of_sha: payload.asOfSha,
    branch: payload.branch,
    format_version: payload.formatVersion,
    issued_at: payload.issuedAt,
    methodology: payload.methodology,
    repo: payload.repo,
    stats: {
      ai_commits: payload.stats.aiCommits,
      human_reviewed: payload.stats.humanReviewed,
    },
  };
  // Keys are already sorted by construction. JSON.stringify preserves insertion order.
  return Buffer.from(JSON.stringify(obj), "utf-8");
}
