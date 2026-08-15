---
title: Decision — Fork-Owned Signing Key
summary: ADR — layered guards were adopted first, then a fork-owned key rotation after explicit user approval; both are kept together as defence in depth rather than either alone.
tags: [decision, adr, signing-key, ed25519, defence-in-depth]
domain: decisions
service: Ruflo
status: active
last_reviewed: 2026-08-15
related: [05_SECURITY/helper-signing-key, 05_SECURITY/registry-decoupling]
rag_include: true
retrieval_priority: high
audience: [agent, human]
sensitivity: public
source_of_truth: true
aliases: [signing key ADR, key rotation decision, layered guards then rotation]
aliases_th: [การตัดสินใจหมุนเวียนกุญแจ]
task_types: [decision-record, security-audit, key-management]
---

# Decision — Fork-Owned Signing Key

## Summary

ADR recording why the helper-signing trust fix was done in two ordered layers rather than one: layered guards (structural checks around the signing mechanism) were adopted first, and the actual key rotation to a fork-owned Ed25519 pair was done second, only after explicit user approval — and both layers are kept permanently as defence in depth, not treated as redundant once the rotation landed.

## Key Terms

| Term | Meaning |
| --- | --- |
| Layered guards (option B) | Structural checks and process discipline around the signing mechanism, adopted first |
| Key rotation (option A2) | Replacing the trusted pubkey with a fork-owned key — the deeper, irreversible-feeling change |
| Defence in depth | Keeping both layers rather than retiring the guards once the rotation was done |

## Main Content

### Context

The fork's helper-signing mechanism trusted **upstream's** Ed25519 public key by default (full background in [[05_SECURITY/helper-signing-key]]), meaning upstream-signed content would verify as legitimate inside this fork. Fixing this required both a structural safeguard and, ultimately, actually replacing the trusted key.

### Options considered

- **A1 — rotation only, immediately.** Replace the trusted pubkey with a fork-owned key straight away, with no interim guard layer.
- **A2 — rotation, but gated on explicit approval.** Do the rotation, but only after the user explicitly approved it — since replacing a trust anchor is the kind of change that should not happen unilaterally, given a wrong rotation could lock out legitimately signed helpers.
- **B — layered guards first.** Add structural checks (verification against both keys during a transition window, rebase-checklist diffing of the pubkey constant, process discipline around key handling) without changing the trusted key itself.
- **B then A2 (chosen)** — adopt the guards first, then perform the rotation once the user approved it, and keep both afterward.

### Decision

**Layered guards were adopted first**, then **key rotation (A2) was performed after the user approved it**. Both layers were **kept** once the rotation was complete, rather than treating the guards as scaffolding to remove.

### Consequences

- The ordering meant the highest-risk change (swapping the trust anchor) only happened once structural safeguards were already in place to catch a bad outcome, and only with explicit human sign-off — consistent with this fork's broader rule that changes to authentication/security-sensitive code require approval (see the repo's global protected-operations policy).
- Keeping both layers after the rotation is a deliberate defence-in-depth choice: the rebase-checklist diff of the pubkey constant (part of the guard layer) is exactly what would have caught the *original* problem before it shipped, and remains the safeguard against the rotation being silently undone by a future upstream merge — see [[05_SECURITY/helper-signing-key]] for that specific mechanics.
- The same-day key loss and re-rotation incident (documented in [[05_SECURITY/helper-signing-key]]) happened *after* this ADR's rotation step, and is a separate, still-open risk (no secret-manager backup) rather than something this decision resolved.

### Reopen-when

**Never re-adopt upstream's key as the trusted constant.** The rebase checklist enforces this by requiring a diff of the pubkey constant on every merge — reopen this decision only if that enforcement mechanism itself is found to be insufficient (e.g. a rebase lands without the checklist being followed), not as a routine review.

## Related Code

- `v3/@claude-flow/cli/src/init/helper-signing.ts` — the trusted pubkey constant
- `v3/@claude-flow/cli/scripts/sign-helpers.mjs`, `v3/@claude-flow/cli/scripts/verify-helpers.mjs` — the guard-layer verification scripts

## Related Notes

- [[05_SECURITY/helper-signing-key]]
- [[05_SECURITY/registry-decoupling]]
