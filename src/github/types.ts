/**
 * Minimal interfaces for the subset of GitHub API responses we use.
 * Keeps the adapter layer thin — only the fields that matter.
 */

export type GitHubUser = {
  readonly login: string;
  readonly type: string; // "User" | "Bot"
};

export type GitHubReview = {
  readonly state: string;
  readonly user: GitHubUser | null;
  readonly commit_id: string;
};

export type GitHubPullRequest = {
  readonly number: number;
  readonly merge_commit_sha: string | null;
  readonly head: { readonly sha: string };
};

export type GitHubCommitAuthor = {
  readonly email: string;
  readonly name: string;
};

export type GitHubCommitDetail = {
  readonly message: string;
  readonly author: GitHubCommitAuthor | null;
  readonly committer: GitHubCommitAuthor | null;
};

export type GitHubCommit = {
  readonly sha: string;
  readonly commit: GitHubCommitDetail;
  readonly author: GitHubUser | null;
  readonly committer: GitHubUser | null;
};

export type GitHubBranchProtection = {
  readonly required_pull_request_reviews?: {
    readonly required_approving_review_count: number;
  } | null;
  readonly enforce_admins?: {
    readonly enabled: boolean;
  } | null;
};
