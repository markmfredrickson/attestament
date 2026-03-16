/**
 * Stats aggregation — tally AI/attested counts from audit results.
 */

import type { AuditResult } from "../pipeline.js";
import type { BadgeStats } from "./payload.js";

export type StatsResult = {
  readonly stats: BadgeStats;
  readonly asOfSha: string;
  readonly totalCommits: number;
};

export function aggregateStats(results: { sha: string; audit: AuditResult }[]): StatsResult {
  let ai = 0;
  let reviewed = 0;

  for (const { audit } of results) {
    if (audit.classification.classification.kind === "ai") {
      ai++;
      if (audit.attestation.kind === "attested") reviewed++;
    }
  }

  return {
    stats: { aiCommits: ai, humanReviewed: reviewed },
    asOfSha: results.length > 0 ? results[0].sha : "",
    totalCommits: results.length,
  };
}
