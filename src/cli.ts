/**
 * CLI entry point for attestament.
 *
 * Usage:
 *   attestament keygen --out badge.key --pubkey badge.pub
 *   attestament generate --repo owner/repo --branch main --key badge.key
 *   attestament verify --payload badge.json --sig badge.sig --pubkey badge.pub
 */

import { parseArgs } from "node:util";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  generateKeypair,
  loadPrivateKey,
  loadPublicKey,
  savePrivateKey,
  savePublicKey,
  signPayload,
  verifySignature,
} from "./badge/signer.js";

function keygen(args: string[]): number {
  const { values } = parseArgs({
    args,
    options: {
      out: { type: "string" },
      pubkey: { type: "string" },
    },
  });

  if (!values.out || !values.pubkey) {
    console.error("Usage: attestament keygen --out <key> --pubkey <pub>");
    return 1;
  }

  const { privateKey, publicKey } = generateKeypair();
  savePrivateKey(privateKey, values.out);
  savePublicKey(publicKey, values.pubkey);
  console.log(`Private key: ${values.out}`);
  console.log(`Public key:  ${values.pubkey}`);
  return 0;
}

async function generate(args: string[]): Promise<number> {
  const { values } = parseArgs({
    args,
    options: {
      repo: { type: "string" },
      branch: { type: "string" },
      key: { type: "string" },
      since: { type: "string" },
      "out-dir": { type: "string", default: "." },
    },
  });

  if (!values.repo || !values.key) {
    console.error("Usage: attestament generate --repo owner/repo --key <key> [--branch main] [--since <sha>] [--out-dir .]");
    return 1;
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error("Error: GITHUB_TOKEN environment variable required");
    return 1;
  }

  // Dynamic import to avoid loading Octokit for keygen/verify
  const { Octokit } = await import("@octokit/rest");
  const { checkBadgeEligibility } = await import("./github/branch-protection.js");
  const { buildAttestationPayload } = await import("./github/pulls.js");
  const { classifyCommit } = await import("./classify/commit-classifier.js");
  const { classifyAttestation } = await import("./classify/attestation-classifier.js");
  const { aggregateStats } = await import("./badge/stats.js");
  const { makeBadge } = await import("./badge/badge.js");

  const parts = values.repo.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    console.error("Error: --repo must be in owner/repo format (e.g. markmfredrickson/attestament)");
    return 1;
  }
  const [owner, repo] = parts;

  const octokit = new Octokit({ auth: token });

  let branch: string;
  try {
    branch = values.branch ?? (await octokit.repos.get({ owner, repo })).data.default_branch;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Error: could not access ${values.repo} — ${msg}`);
    return 1;
  }

  // Check eligibility
  let protection;
  try {
    const resp = await octokit.repos.getBranchProtection({ owner, repo, branch });
    protection = resp.data;
  } catch {
    protection = null;
  }

  const eligibility = checkBadgeEligibility(protection as Parameters<typeof checkBadgeEligibility>[0]);
  if (eligibility.kind === "ineligible") {
    console.error(`Badge not issued: ineligible (${eligibility.reason})`);
    return 1;
  }

  // Walk commits and audit
  const commits = await octokit.paginate(octokit.repos.listCommits, {
    owner, repo, sha: branch, per_page: 100,
  });

  const results: { sha: string; audit: Awaited<ReturnType<typeof import("./pipeline.js")["auditCommit"]>> }[] = [];

  for (const ghCommit of commits) {
    if (values.since && ghCommit.sha === values.since) break;

    const commit = {
      sha: ghCommit.sha,
      commit: {
        message: ghCommit.commit.message,
        author: ghCommit.commit.author ? { email: ghCommit.commit.author.email ?? "", name: ghCommit.commit.author.name ?? "" } : null,
        committer: ghCommit.commit.committer ? { email: ghCommit.commit.committer.email ?? "", name: ghCommit.commit.committer.name ?? "" } : null,
      },
      author: ghCommit.author ? { login: ghCommit.author.login, type: ghCommit.author.type ?? "User" } : null,
      committer: ghCommit.committer ? { login: ghCommit.committer.login, type: ghCommit.committer.type ?? "User" } : null,
    };

    const clsResult = classifyCommit({
      message: commit.commit.message,
      authorLogin: commit.author?.login ?? null,
      authorType: commit.author?.type ?? null,
      authorEmail: commit.commit.author?.email ?? null,
      authorName: commit.commit.author?.name ?? null,
      committerEmail: commit.commit.committer?.email ?? null,
      committerName: commit.commit.committer?.name ?? null,
    });

    const isAi = clsResult.classification.kind === "ai";
    let pulls: Awaited<ReturnType<typeof octokit.repos.listPullRequestsAssociatedWithCommit>>["data"] = [];
    let reviews: Awaited<ReturnType<typeof octokit.pulls.listReviews>>["data"] = [];

    if (isAi) {
      const pullsResp = await octokit.repos.listPullRequestsAssociatedWithCommit({ owner, repo, commit_sha: ghCommit.sha });
      pulls = pullsResp.data;

      if (pulls.length > 0) {
        const prNumber = pulls.reduce((min, pr) => pr.number < min.number ? pr : min).number;
        const reviewsResp = await octokit.pulls.listReviews({ owner, repo, pull_number: prNumber });
        reviews = reviewsResp.data;
      }
    }

    const attPayload = buildAttestationPayload(
      isAi,
      pulls.map(p => ({ number: p.number, merge_commit_sha: p.merge_commit_sha ?? null, head: { sha: p.head.sha } })),
      reviews.map(r => ({ state: r.state, user: r.user ? { login: r.user.login, type: r.user.type ?? "User" } : null, commit_id: r.commit_id ?? "" })),
    );
    const attestation = classifyAttestation(attPayload);

    results.push({ sha: ghCommit.sha, audit: { classification: clsResult, attestation } });
  }

  const statsResult = aggregateStats(results);
  const privateKey = loadPrivateKey(values.key);
  const badge = makeBadge(values.repo, branch, eligibility, statsResult, privateKey);

  if (badge.kind === "badge-error") {
    console.error(`Badge not issued: ${badge.reason}`);
    return 1;
  }

  const outDir = values["out-dir"]!;
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, "badge.json"), badge.payloadJson);
  writeFileSync(resolve(outDir, "badge.sig"), badge.signature);

  console.log(`Payload: ${resolve(outDir, "badge.json")}`);
  console.log(`Signature: ${resolve(outDir, "badge.sig")}`);
  console.log(JSON.stringify(JSON.parse(badge.payloadJson.toString()), null, 2));
  return 0;
}

function verify(args: string[]): number {
  const { values } = parseArgs({
    args,
    options: {
      payload: { type: "string" },
      sig: { type: "string" },
      pubkey: { type: "string" },
    },
  });

  if (!values.payload || !values.sig || !values.pubkey) {
    console.error("Usage: attestament verify --payload <json> --sig <sig> --pubkey <pub>");
    return 1;
  }

  const payloadBytes = readFileSync(values.payload);
  const signature = readFileSync(values.sig, "utf-8").trim();
  const publicKey = loadPublicKey(values.pubkey);

  if (verifySignature(Buffer.from(payloadBytes), signature, publicKey)) {
    console.log("Valid signature.");
    return 0;
  } else {
    console.error("INVALID signature.");
    return 1;
  }
}

export async function main(argv?: string[]): Promise<number> {
  const args = argv ?? process.argv.slice(2);
  const command = args[0];
  const rest = args.slice(1);

  switch (command) {
    case "keygen":
      return keygen(rest);
    case "generate":
      return generate(rest);
    case "verify":
      return verify(rest);
    default:
      console.error("Usage: attestament <keygen|generate|verify> [options]");
      return 1;
  }
}
