/** Commit authored by a human. */
export type Human = { readonly kind: "human" };

/** Commit authored by an AI agent. */
export type Ai = { readonly kind: "ai"; readonly agent: string | null };

/** Discriminated union: who authored this commit? */
export type Classification = Human | Ai;

/** Raw commit fields used for classification. */
export type CommitPayload = {
  readonly message: string;
  readonly authorLogin: string | null;
  readonly authorType: string | null;
  readonly authorEmail: string | null;
  readonly authorName: string | null;
  readonly committerEmail: string | null;
  readonly committerName: string | null;
};

/** Classification result with optional co-author metadata. */
export type ClassificationResult = {
  readonly classification: Classification;
  readonly coAuthors: string[];
};
