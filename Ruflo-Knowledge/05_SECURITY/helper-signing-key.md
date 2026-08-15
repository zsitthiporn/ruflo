---
title: Helper Signing Key
summary: Helpers are Ed25519-signed; the fork inherited upstream's pubkey (trusting upstream-signed helpers as legitimate), rotated to a fork-owned key, then lost and re-rotated the same day — back it up.
tags: [security, signing-key, ed25519, helpers, key-rotation, incident]
domain: security
service: Ruflo
status: active
last_reviewed: 2026-08-15
related: [09_DECISIONS/decision-fork-owned-signing-key, 05_SECURITY/registry-decoupling, upstream-rebase-runbook, helper-signing-runbook, helper-system]
rag_include: true
retrieval_priority: high
audience: [agent, human]
sensitivity: public
source_of_truth: true
aliases: [helpers.manifest.json signing, Ed25519 helper key, key rotation incident, DO-NOT-DELETE key]
aliases_th: [กุญแจเซ็นรับรอง Ed25519, การหมุนเวียนกุญแจ, กุญแจหาย]
task_types: [security-audit, incident-response, key-management]
---

# Helper Signing Key

## Summary

Ruflo's helper files (`hook-handler.cjs`, `intelligence.cjs`, etc.) are Ed25519-signed against a manifest, `helpers.manifest.json`. The fork had inherited **upstream's** public key, which meant upstream-signed helpers verified as legitimate inside this fork — backwards for a fork whose point is running its own code. The key was rotated to a fork-owned pair on 2026-08-14, with the private half kept at `~/.ruflo/helpers-signing.key` and never printed (a PEM leak into a transcript happened once, upstream, on 2026-07-14). The new key was then **lost the same day** — swept during a user-profile cleanup because `~/.ruflo` looked like disposable tool litter — and had to be re-rotated again. A `DO-NOT-DELETE.md` now sits beside the key file, and it must be backed up: no secret manager currently holds it.

## Key Terms

| Term | Meaning |
| --- | --- |
| `helpers.manifest.json` | The manifest listing helper files and their signatures |
| `sign-helpers.mjs` | The script that signs the manifest with the private key |
| `verify-helpers.mjs` | The script that checks a manifest's signature against the trusted public key |
| Pubkey constant | The trusted public key hard-coded in `helper-signing.ts` — verified against on every check |
| `~/.ruflo/helpers-signing.key` | Current default location of the private half of the fork-owned key pair |

## Main Content

### The original problem

Helper files are the fork's most privileged runtime surface — they run as hooks inside every session. To prevent tampering, they are signed and the signature is checked against a hard-coded public-key constant before use. The fork inherited this whole mechanism from upstream, including upstream's own public key as the trusted constant. That meant a helper file signed by **upstream's** private key — which upstream controls, not this fork's owner — would verify as legitimate here. Any upstream-originated helper content, whether pushed through a rebase or through the auto-refresh path described in [[05_SECURITY/registry-decoupling]], would pass the fork's own integrity check.

### The rotation

On 2026-08-14 the trusted key was rotated to a **fork-owned** Ed25519 pair. The private half lives at `~/.ruflo/helpers-signing.key`, deliberately outside the repository (never committed) and never printed to any tool output or transcript — a rule adopted directly from a 2026-07-14 incident in which a PEM was accidentally captured in a session transcript upstream.

The rotation was verified in **both directions**, not just asserted: the fork's own manifest verifies successfully under the fork's new key, and the same manifest **fails** verification under upstream's old key. That two-sided check is what makes the rotation a proven fix rather than a configuration change taken on faith.

### The same-day loss

The newly rotated key was lost on the same day it was created — it was swept during a routine user-profile cleanup pass, because `~/.ruflo` looks, to a generic cleanup heuristic, like disposable tool litter rather than a directory holding an irreplaceable secret. The key had to be re-rotated a second time. Two changes followed directly from this incident:

- A `DO-NOT-DELETE.md` file now sits beside the key in `~/.ruflo/`, as a plain-text signal to any future cleanup pass (human or automated) that the directory is not disposable.
- **The key must be backed up.** No secret manager currently holds a copy — `~/.ruflo/helpers-signing.key` is the only copy in existence. This is an open risk, not a resolved one: losing it a second time with no backup would mean generating and redistributing yet another key, and updating the trusted pubkey constant everywhere it's checked.

### The rebase checklist implication

Because the trusted pubkey is a hard-coded constant, an upstream rebase that touches the same file can silently reintroduce upstream's key as the trusted constant, re-opening the exact trust hole this rotation closed — with no error, no warning, just a merged file that happens to trust the wrong signer again. The rebase checklist requires **diffing the pubkey constant specifically** on every merge for this reason; see [[upstream-rebase-runbook]].

## Related Code

- `v3/@claude-flow/cli/src/init/helper-signing.ts` — the trusted pubkey constant (`RUFLO_HELPERS_PUBKEY`) and verification entry point
- `v3/@claude-flow/cli/scripts/sign-helpers.mjs` — signs `helpers.manifest.json`; resolves the private key via GCP Secret Manager, `RUFLO_HELPERS_SIGNING_KEY` env var, or `~/.ruflo/helpers-signing.key` in that order
- `v3/@claude-flow/cli/scripts/verify-helpers.mjs` — verifies a manifest against the trusted pubkey constant
- `.claude/helpers/helpers.manifest.json` — the signed manifest
- `~/.ruflo/helpers-signing.key` — current private key location (outside the repo, never committed)

## Related Notes

- [[09_DECISIONS/decision-fork-owned-signing-key]]
- [[05_SECURITY/registry-decoupling]]
- [[upstream-rebase-runbook]]
- [[helper-signing-runbook]]
- [[helper-system]]
