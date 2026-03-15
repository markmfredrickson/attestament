# CLAUDE.md

## Commands

```bash
npm install
npm test            # run all tests (vitest)
npm run check       # type-check without emitting
npm run build       # compile to dist/
```

## Architecture

**attestament** classifies git commits by AI authorship and verifies human attestation before shipping. TypeScript port of the show-your-work Python prototype.

### Core concepts

- **Classification** — `Human | Ai(agent)` discriminated union. Agent is a free string (`"claude"`, `"cursor"`, etc.) or `null`.
- **Attestation** — `AllHuman | Attested | Unattested(reason)`. Whether a human signed off on AI code via PR approval at the merge SHA.
- **Badge eligibility** — only branches with `enforce_admins: true` and `required_approving_review_count >= 1` qualify.
- **Badge signing** — Ed25519 signed canonical JSON payload, verifiable offline.

### Module dependency order (leaves first)

1. `src/classify/types.ts` — shared types
2. `src/classify/commit-classifier.ts` — 6-level priority detection
3. `src/classify/attestation-classifier.ts` — attestation status from PR context
4. `src/badge/payload.ts` — canonical JSON construction
5. `src/badge/signer.ts` — Ed25519 sign/verify
6. `src/github/pulls.ts` — Octokit adapter → AttestationPayload
7. `src/github/branch-protection.ts` — badge eligibility check
8. `src/pipeline.ts` — audit_commit wires classifiers end-to-end
9. `src/badge/stats.ts` — aggregate results across a branch
10. `src/badge/badge.ts` — orchestrates eligibility → sign

### Test fixtures

Tests are data-driven. JSON fixtures in `tests/fixtures/` are portable from the Python prototype. Add cases to the JSON file first, then implement logic to pass them.
