---
title: Helper Signing Runbook
summary: Re-sign the critical helpers after a change, verify the manifest, the never-print-the-key discipline, and the key-backup warning after one fork-owned key was already lost.
tags: [runbook, helper-signing, ed25519, security]
domain: runbook
service: Ruflo
status: active
last_reviewed: 2026-08-15
related: [../01_ARCHITECTURE/helper-system, ../05_SECURITY/helper-signing-key]
rag_include: true
retrieval_priority: high
audience: [agent, human]
sensitivity: public
source_of_truth: true
aliases: [helper signing, sign-helpers.mjs, Ed25519, verify-helpers.mjs, re-sign helpers, key backup]
aliases_th: [เซ็น helper, ลายเซ็น helper, Ed25519, สำรองคีย์]
task_types: [runbook, security, release]
note_role: focused
routing_intents: [re-sign-helpers-after-edit, rotate-helper-signing-key, verify-helper-manifest]
---

# Helper Signing Runbook

## Summary

Whenever any of the four `CRITICAL_HELPERS` files changes
(`auto-memory-hook.mjs`, `hook-handler.cjs`, `intelligence.cjs`,
`statusline.cjs`, all under `v3/@claude-flow/cli/.claude/helpers/`),
re-sign, then verify. The private signing key never appears in shell output,
argv, or a session transcript — that discipline exists because it has
already been violated once (2026-07-14, an earlier GCP-era key leaked into
captured output) and a fork-owned successor key was separately **lost
entirely** the same day it was rotated in (2026-08-14, swept during an
unrelated home-directory cleanup). Back it up.

## Key Terms

| Term | Meaning |
| --- | --- |
| `~/.ruflo/helpers-signing.key` | Default local path for the private Ed25519 key — dev default, first-tried after GCP |
| `RUFLO_HELPERS_SIGNING_KEY` | Env var overriding the key path |
| `RUFLO_HELPERS_SIGNING_SECRET` | Env var naming a GCP Secret Manager secret — preferred for CI/publish |
| `--stdin-key` | `sign-helpers.mjs` flag: reads the PEM from piped stdin only, refuses interactive/TTY entry, never echoes it |
| `~/.ruflo/DO-NOT-DELETE.md` | Warning file added after the 2026-08-14 key loss, in the one place a cleanup pass would look |

## Main Content

### 1. Re-sign

Run from `v3/@claude-flow/cli/`:

```bash
node.exe scripts/sign-helpers.mjs
```

Key resolution is automatic, first-match-wins: (1) GCP Secret Manager if
`RUFLO_HELPERS_SIGNING_SECRET` is set, (2) `RUFLO_HELPERS_SIGNING_KEY=<pem-path>`
if set, (3) default `~/.ruflo/helpers-signing.key`. On this fork's current
setup the private key lives locally at the default path, so **no environment
variable is required at all** — just run the command.

Output: `.claude/helpers/helpers.manifest.json` is rewritten with fresh
SHA-256 hashes for all four critical helpers plus a new Ed25519 signature
over the canonical (sorted-keys) manifest bytes. The script prints only the
first 16 hex characters of each hash to stdout — never the key.

**If signing must happen from a piped secret** (GCP path, or any pipeline
that must not let the PEM land in a captured shell buffer):

```bash
gcloud secrets versions access latest --secret=<name> --project=<project> \
  | node.exe scripts/sign-helpers.mjs --stdin-key
```

`--stdin-key` refuses interactive/TTY entry outright and validates the key is
a real Ed25519 private key before using it.

### 2. Verify

```bash
node.exe scripts/verify-helpers.mjs
```

This must run **after a build** — it imports the *compiled*
`dist/src/init/helper-signing.js` for the public key (not the `.ts` source),
specifically so it checks exactly what an installed copy would trust. It
checks, in order: (a) the signature verifies under
`RUFLO_HELPERS_PUBKEY`, (b) `manifest.version` matches `package.json`'s
version, (c) every critical helper's on-disk SHA-256 matches its manifest
entry. Any failure exits non-zero with a specific reason (`die()` in the
script) — e.g. "hash drift for hook-handler.cjs... re-run sign-helpers.mjs"
if a file changed after signing but before verification.

`prepublishOnly` (`scripts/prepare-publish.mjs`) already chains
`generate-catalog-manifest.mjs` → `sign-helpers.mjs` → `verify-helpers.mjs`
automatically at publish time — this manual sign+verify pair is for
development iteration on the helpers themselves, before a publish is due.

### 3. Never-print-the-key discipline

- Never run `cat`, `echo`, or any command that lets the PEM's bytes reach
  tool output, terminal scrollback, or a captured shell buffer — this is how
  the 2026-07-14 key leaked into a session transcript in the first place.
- For the GCP path specifically: pipe `gcloud secrets versions access`
  directly into `sign-helpers.mjs --stdin-key`; never capture it into a
  variable or intermediate file first.
- For the local-file path (current default): let `sign-helpers.mjs` read
  `~/.ruflo/helpers-signing.key` itself. Do not pipe the file through `cat`
  or any intermediate command "to check it's there" — checking existence
  with `ls`/`test -f` is fine; reading its contents is not.
- `--stdin-key` itself never echoes what it received.

### 4. Key backup — this has already gone wrong once

The **first** fork-owned key (generated 2026-08-14) was signed with
successfully, then lost **the same day**: its private half at
`~/.ruflo/helpers-signing.key` was swept during a cleanup of what looked like
disposable "ruflo artifacts" in the user profile. `~/.ruflo` is not disposable
— it is the one directory there that cannot be regenerated once its key is
gone, and losing it means re-signing is impossible without a full rotation
(new key pair, new public constant, re-sign, rebuild). `~/.ruflo/DO-NOT-DELETE.md`
now exists specifically because that is the one place a person doing a
"clean up my home directory" pass would actually read before deleting.

**Before any operation that might touch `~/.ruflo/`** (disk cleanup scripts,
profile resets, dotfile-manager runs): confirm `~/.ruflo/helpers-signing.key`
still exists and is backed up somewhere outside both the repo and any
secret manager that could itself be swept — it is not in the repo and not in
any secret manager by design (see [[../05_SECURITY/helper-signing-key]]).

### 5. If a rotation is genuinely needed

Generate a new Ed25519 pair, keep the private half **only** at
`~/.ruflo/helpers-signing.key` (the primary path, not a fallback), export
only the **public** half (Node's `crypto` Ed25519 public-key export) to
update `RUFLO_HELPERS_PUBKEY` in `src/init/helper-signing.ts`, then re-sign
and rebuild. Securely delete the old private key file only after confirming
the new one signs and verifies successfully end-to-end. This is exactly the
[[../07_RUNBOOKS/upstream-rebase-runbook]]'s highest-priority checklist item
in reverse — a deliberate rotation here is the one time
`RUFLO_HELPERS_PUBKEY` is *supposed* to change.

## Verification checklist

- [ ] `sign-helpers.mjs` printed 4 hash prefixes, no PEM content anywhere in output
- [ ] `verify-helpers.mjs` printed `ok — 4 helpers match signed manifest @ <version>`
- [ ] `git diff` on `.claude/helpers/helpers.manifest.json` shows only the expected hash/signature change
- [ ] `~/.ruflo/helpers-signing.key` still exists and is backed up outside the repo

## Related Code

- `D:/Project/ME/Ruflo/v3/@claude-flow/cli/scripts/sign-helpers.mjs` — signing script, key resolution order
- `D:/Project/ME/Ruflo/v3/@claude-flow/cli/scripts/verify-helpers.mjs` — publish-time verification against compiled key
- `D:/Project/ME/Ruflo/v3/@claude-flow/cli/src/init/helper-signing.ts:24-50` — rotation history, `RUFLO_HELPERS_PUBKEY`
- `docs/fork-maintenance.md` §1 "Fork identity — decision record"

## Related Notes

- [[../01_ARCHITECTURE/helper-system]]
- [[../05_SECURITY/helper-signing-key]]
- [[../07_RUNBOOKS/upstream-rebase-runbook]]
- [[../07_RUNBOOKS/publishing-runbook]]
