/**
 * Badge orchestration — eligibility check, stats, payload, signing.
 */

import type { KeyObject } from "node:crypto";
import type { BadgePayload } from "./payload.js";
import { buildPayload, canonicalize } from "./payload.js";
import { signPayload } from "./signer.js";
import type { StatsResult } from "./stats.js";
import type { BadgeEligibility } from "../github/branch-protection.js";

export type SignedBadge = {
  readonly kind: "signed-badge";
  readonly payload: BadgePayload;
  readonly payloadJson: Buffer;
  readonly signature: string;
};

export type BadgeError = {
  readonly kind: "badge-error";
  readonly reason: string;
};

export type BadgeResult = SignedBadge | BadgeError;

export function makeBadge(
  repo: string,
  branch: string,
  eligibility: BadgeEligibility,
  statsResult: StatsResult,
  privateKey: KeyObject,
): BadgeResult {
  if (eligibility.kind === "ineligible") {
    return { kind: "badge-error", reason: `ineligible: ${eligibility.reason}` };
  }

  const payload = buildPayload(repo, branch, statsResult.asOfSha, statsResult.stats);
  const payloadJson = canonicalize(payload);
  const signature = signPayload(payloadJson, privateKey);

  return { kind: "signed-badge", payload, payloadJson, signature };
}
