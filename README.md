# attestament

Verify that AI-authored code was human-attested before it shipped.

Part of **Last Will and Attestament** — `attestament` is the CLI that classifies commits, checks attestation status, and signs badges. Its companion, [lastwill](https://github.com/markmfredrickson/lastwill), is an MCP server that helps AI agents write attestable code.

## What it does

attestament walks a branch's commit history, classifies each commit as human- or AI-authored, checks whether AI-authored commits received a human PR approval at the merge SHA, and produces a signed badge summarizing the results. The badge is an Ed25519-signed canonical JSON payload, verifiable offline by anyone with the public key.

## How it works

1. **Classify** — each commit is tagged `Human` or `Ai(agent)` using a 6-level priority chain: GitHub author type, email domain, author login, `Co-Authored-By` trailers, commit message markers, and author name suffixes.
2. **Attest** — for each AI-authored commit, the tool fetches associated PRs and reviews from the GitHub API. If a human approved the PR at the merge SHA, the commit is `Attested`. Otherwise it is `Unattested(reason)`. Human-authored commits are `AllHuman` (no attestation needed).
3. **Sign** — if the branch has adequate protection (`enforce_admins: true`, `required_approving_review_count >= 1`), a badge payload is built and Ed25519-signed.

## Type design

**Classification** (who wrote it):

```
Human                        — human-authored commit
Ai { agent: string | null }  — AI-authored, optionally naming the agent
```

**Attestation** (was AI code signed off):

```
AllHuman                      — no AI code, no attestation needed
Attested                      — AI code, human-approved at merge SHA
Unattested { reason: string } — AI code, no valid human sign-off
```

## Installation

```bash
npm install attestament
```

Requires Node.js >= 18.

## CLI usage

### Generate a signing keypair

```bash
attestament keygen --out badge.key --pubkey badge.pub
```

### Generate a badge

Walks the branch, classifies commits, checks attestation, and signs the result. Requires `GITHUB_TOKEN` in the environment.

```bash
export GITHUB_TOKEN=ghp_...
attestament generate --repo owner/repo --branch main --key badge.key
```

Optional flags:

- `--since <sha>` — stop walking at this commit
- `--out-dir <dir>` — output directory for `badge.json` and `badge.sig` (default: `.`)

### Verify a badge

```bash
attestament verify --payload badge.json --sig badge.sig --pubkey badge.pub
```

Prints `Valid signature.` and exits 0 on success, or `INVALID signature.` and exits 1 on failure.

## Development

```bash
npm install
npm test            # run all tests (vitest)
npm run check       # type-check without emitting
npm run build       # compile to dist/
```

## Companion project

[lastwill](https://github.com/markmfredrickson/lastwill) is the MCP server counterpart. It helps AI coding agents (Claude Code, Cursor, Copilot) write code that will pass attestament verification — pre-flight checks, trailer validation, and PR submission via a GitHub App bot identity.

## License

MIT
