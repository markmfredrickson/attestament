/**
 * GitHub Action entrypoint for attestament.
 *
 * Runs the audit pipeline, sets outputs, writes a shields.io endpoint,
 * and posts a summary to the workflow run.
 */

import * as core from "@actions/core";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Octokit } from "@octokit/rest";
import { classifyCommit } from "./classify/commit-classifier.js";
import { classifyAttestation } from "./classify/attestation-classifier.js";
import { buildAttestationPayload } from "./github/pulls.js";
import { checkBadgeEligibility } from "./github/branch-protection.js";
import { aggregateStats } from "./badge/stats.js";
import { makeBadge } from "./badge/badge.js";
import { loadPrivateKey } from "./badge/signer.js";
import { canonicalize } from "./badge/payload.js";

type ShieldStatus = {
  label: string;
  message: string;
  color: string;
  status: "attested" | "partial" | "all-human" | "unattested";
};

function resolveShieldStatus(aiCommits: number, humanReviewed: number): ShieldStatus {
  if (aiCommits === 0) {
    return { label: "attestament", message: "all human", color: "brightgreen", status: "all-human" };
  }
  if (aiCommits === humanReviewed) {
    return { label: "attestament", message: `${humanReviewed}/${aiCommits} AI attested`, color: "brightgreen", status: "attested" };
  }
  if (humanReviewed > 0) {
    return { label: "attestament", message: `${humanReviewed}/${aiCommits} AI attested`, color: "yellow", status: "partial" };
  }
  return { label: "attestament", message: `${aiCommits} AI unattested`, color: "red", status: "unattested" };
}

async function run(): Promise<void> {
  // Read inputs
  const repo = core.getInput("repo") || process.env.GITHUB_REPOSITORY || "";
  const branch = core.getInput("branch") || process.env.GITHUB_REF_NAME || "";
  const signingKeyPem = core.getInput("signing-key", { required: true });
  const since = core.getInput("since") || undefined;
  const failOnUnattested = core.getInput("fail-on-unattested") !== "false";
  const badgePath = core.getInput("badge-path") || ".attestament";
  const token = process.env.GITHUB_TOKEN || "";

  if (!repo || !repo.includes("/")) {
    throw new Error("Could not determine repository. Set the 'repo' input or ensure GITHUB_REPOSITORY is set.");
  }
  if (!token) {
    throw new Error("GITHUB_TOKEN is required. Add `env: GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}` to your workflow step.");
  }

  // Write signing key to temp file for loadPrivateKey
  const keyFile = join(tmpdir(), `attestament-action-${Date.now()}.key`);
  writeFileSync(keyFile, signingKeyPem, { mode: 0o600 });

  const [owner, repoName] = repo.split("/");
  const octokit = new Octokit({ auth: token });

  // Resolve branch
  const targetBranch = branch || (await octokit.repos.get({ owner, repo: repoName })).data.default_branch;

  core.info(`Auditing ${repo}@${targetBranch}`);

  // Check eligibility
  let protection;
  try {
    const resp = await octokit.repos.getBranchProtection({ owner, repo: repoName, branch: targetBranch });
    protection = resp.data;
  } catch {
    protection = null;
  }

  const eligibility = checkBadgeEligibility(protection as Parameters<typeof checkBadgeEligibility>[0]);
  if (eligibility.kind === "ineligible") {
    core.warning(`Badge not issued: ineligible (${eligibility.reason}). Audit will still run.`);
  }

  // Walk commits
  const commits = await octokit.paginate(octokit.repos.listCommits, {
    owner, repo: repoName, sha: targetBranch, per_page: 100,
  });

  core.info(`Found ${commits.length} commits to audit`);

  type AuditEntry = {
    sha: string;
    audit: { classification: ReturnType<typeof classifyCommit>; attestation: ReturnType<typeof classifyAttestation> };
  };
  const results: AuditEntry[] = [];

  for (const ghCommit of commits) {
    if (since && ghCommit.sha === since) break;

    const clsResult = classifyCommit({
      message: ghCommit.commit.message,
      authorLogin: ghCommit.author?.login ?? null,
      authorType: ghCommit.author?.type ?? null,
      authorEmail: ghCommit.commit.author?.email ?? null,
      authorName: ghCommit.commit.author?.name ?? null,
      committerEmail: ghCommit.commit.committer?.email ?? null,
      committerName: ghCommit.commit.committer?.name ?? null,
    });

    const isAi = clsResult.classification.kind === "ai";
    let pulls: Awaited<ReturnType<typeof octokit.repos.listPullRequestsAssociatedWithCommit>>["data"] = [];
    let reviews: Awaited<ReturnType<typeof octokit.pulls.listReviews>>["data"] = [];

    if (isAi) {
      const pullsResp = await octokit.repos.listPullRequestsAssociatedWithCommit({ owner, repo: repoName, commit_sha: ghCommit.sha });
      pulls = pullsResp.data;

      if (pulls.length > 0) {
        const prNumber = pulls.reduce((min, pr) => pr.number < min.number ? pr : min).number;
        const reviewsResp = await octokit.pulls.listReviews({ owner, repo: repoName, pull_number: prNumber });
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
  const { aiCommits, humanReviewed } = statsResult.stats;
  const shield = resolveShieldStatus(aiCommits, humanReviewed);

  // Set outputs
  core.setOutput("status", shield.status);
  core.setOutput("ai-commits", aiCommits.toString());
  core.setOutput("human-reviewed", humanReviewed.toString());
  core.setOutput("total-commits", results.length.toString());

  // Write badge files
  mkdirSync(badgePath, { recursive: true });

  if (eligibility.kind === "eligible") {
    const privateKey = loadPrivateKey(keyFile);
    const badge = makeBadge(repo, targetBranch, eligibility, statsResult, privateKey);

    if (badge.kind === "signed-badge") {
      writeFileSync(resolve(badgePath, "badge.json"), badge.payloadJson);
      writeFileSync(resolve(badgePath, "badge.sig"), badge.signature);
      core.setOutput("badge-json", resolve(badgePath, "badge.json"));
    }
  }

  // Write shields.io endpoint JSON
  const shieldEndpoint = {
    schemaVersion: 1,
    label: shield.label,
    message: shield.message,
    color: shield.color,
  };
  writeFileSync(resolve(badgePath, "shield.json"), JSON.stringify(shieldEndpoint, null, 2));

  const badgeUrl = `https://img.shields.io/badge/${encodeURIComponent(shield.label)}-${encodeURIComponent(shield.message)}-${shield.color}`;
  core.setOutput("badge-url", badgeUrl);

  // Job summary
  core.summary
    .addHeading("Attestament Results", 3)
    .addTable([
      [{ data: "Metric", header: true }, { data: "Value", header: true }],
      ["Status", `**${shield.status}**`],
      ["AI commits", aiCommits.toString()],
      ["Human reviewed", humanReviewed.toString()],
      ["Total commits", results.length.toString()],
      ["Badge", `![${shield.status}](${badgeUrl})`],
    ]);
  await core.summary.write();

  core.info(`Audit complete: ${shield.status} (${aiCommits} AI, ${humanReviewed} reviewed, ${results.length} total)`);

  // Fail if configured
  if (failOnUnattested && shield.status === "unattested") {
    core.setFailed(`${aiCommits} AI-authored commits found without human attestation`);
  }

  // Clean up key
  writeFileSync(keyFile, "");
}

run().catch((err) => {
  core.setFailed(err instanceof Error ? err.message : String(err));
});
