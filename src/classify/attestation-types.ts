/** Commit was human-authored; no attestation needed. */
export type AllHuman = { readonly kind: "all-human" };

/** AI-authored, and a human approved the PR at the merge SHA. */
export type Attested = { readonly kind: "attested" };

/** AI-authored, but no valid human sign-off. */
export type Unattested = { readonly kind: "unattested"; readonly reason: string };

/** Discriminated union: was AI code human-attested? */
export type AttestationStatus = AllHuman | Attested | Unattested;

/** A single GitHub PR review. */
export type Review = {
  readonly state: string; // "APPROVED", "COMMENTED", "CHANGES_REQUESTED", "DISMISSED"
  readonly authorType: string; // "User", "Bot"
  readonly authorLogin: string;
  readonly commitId: string; // SHA review was submitted against
};

/** PR context needed for attestation classification. */
export type PullRequestContext = {
  readonly reviews: Review[];
  readonly headShaAtMerge: string;
};

/** Input to the attestation classifier. */
export type AttestationPayload = {
  readonly isAi: boolean;
  readonly pr: PullRequestContext | null;
};
