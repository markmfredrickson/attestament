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

## GitHub Action

Add attestament to your CI pipeline. It audits every push, generates a signed trust badge, and optionally fails the build if AI code wasn't reviewed.

### Quick start

1. Generate a signing keypair locally:

```bash
npx attestament keygen --out badge.key --pubkey badge.pub
```

2. Add the private key as a repository secret (`ATTESTAMENT_SIGNING_KEY`).

3. Add to your workflow:

```yaml
name: Attestament
on: [push, pull_request]

jobs:
  attest:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: read
    steps:
      - uses: actions/checkout@v4
      - uses: markmfredrickson/attestament@v0
        with:
          signing-key: ${{ secrets.ATTESTAMENT_SIGNING_KEY }}
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `signing-key` | Yes | — | Ed25519 private key (PEM). Store as a secret. |
| `repo` | No | Current repo | Repository in `owner/repo` format |
| `branch` | No | Current branch | Branch to audit |
| `since` | No | — | Stop walking at this commit SHA |
| `fail-on-unattested` | No | `true` | Fail the workflow if AI commits lack attestation |
| `badge-path` | No | `.attestament` | Output directory for badge files |

### Outputs

| Output | Description |
|--------|-------------|
| `status` | `attested`, `partial`, `all-human`, or `unattested` |
| `ai-commits` | Number of AI-authored commits |
| `human-reviewed` | Number with human attestation |
| `total-commits` | Total commits audited |
| `badge-url` | Shields.io badge URL |

### Badge

Add to your README:

```markdown
![Attestament](https://img.shields.io/badge/attestament-attested-brightgreen)
```

The action also writes `shield.json` (shields.io endpoint format) to the badge path, and posts a summary table to the workflow run.

---

## CLI

Install as a standalone tool:

```bash
npm install -g attestament
```

Requires Node.js >= 18.

### Usage

#### Generate a signing keypair

```bash
attestament keygen --out badge.key --pubkey badge.pub
```

#### Generate a badge

Walks the branch, classifies commits, checks attestation, and signs the result. Requires `GITHUB_TOKEN` in the environment.

```bash
export GITHUB_TOKEN=ghp_...
attestament generate --repo owner/repo --branch main --key badge.key
```

Optional flags:

- `--since <sha>` — stop walking at this commit
- `--out-dir <dir>` — output directory for `badge.json` and `badge.sig` (default: `.`)

#### Verify a badge

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
