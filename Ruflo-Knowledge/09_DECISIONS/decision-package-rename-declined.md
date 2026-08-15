---
title: Decision — Package Rename Declined
summary: ADR — renaming @claude-flow/* (402 files, 956 sites, 23 manifests, plus every future rebase becoming a mass conflict) was declined in favor of workspace:* plus opt-in gates plus a fork-owned key, which close the same holes at 12 manifests.
tags: [decision, adr, package-rename, workspace-protocol, blast-radius]
domain: decisions
service: Ruflo
status: active
last_reviewed: 2026-08-15
related: [09_DECISIONS/decision-workspace-protocol, 05_SECURITY/registry-decoupling]
rag_include: true
retrieval_priority: normal
audience: [agent, human]
sensitivity: public
source_of_truth: true
aliases: [package rename ADR, why not rename claude-flow packages, rebase conflict cost]
aliases_th: [การตัดสินใจไม่เปลี่ยนชื่อแพ็กเกจ]
task_types: [decision-record, dependency-management, security-audit]
---

# Decision — Package Rename Declined

## Summary

ADR recording the decision **not** to rename the `@claude-flow/*` package family to something registry-unreachable, even though a rename would make npm/pnpm registry substitution structurally impossible by construction. The measured cost — 402 files, 956 sites, 23 manifests, and every future upstream rebase becoming a mass merge conflict — was judged not worth paying, since `workspace:*` plus opt-in gates plus a fork-owned signing key already close the same set of holes at a fraction of the footprint (12 manifests).

## Key Terms

| Term | Meaning |
| --- | --- |
| Package rename | Renaming every `@claude-flow/*` package to a name upstream does not also publish under |
| Blast radius | The number of files/sites/manifests a change touches, and therefore the size of every future merge conflict against it |
| Registry-unreachable name | A package name with no correspondingly named upstream publish, making substitution impossible rather than merely guarded against |

## Main Content

### Context

The registry-substitution hazard covered in [[05_SECURITY/registry-decoupling]] exists specifically because this fork's packages share their names with packages upstream also publishes to the public npm registry. A rename would eliminate that shared-name precondition entirely, rather than guarding against its consequences.

### Options considered

1. **Rename `@claude-flow/*` to a fork-exclusive scope.** Structurally impossible for the registry to substitute a package it has never published under that name.
2. **`workspace:*` protocol switch (chosen — see [[09_DECISIONS/decision-workspace-protocol]]).** Force local resolution regardless of shared package names.
3. **Do nothing beyond exact-pin bumps.** Rejected as insufficiently durable — covered in the workspace-protocol ADR's own options list.

### Decision

**Declined.** The fork keeps the `@claude-flow/*` package names and relies on `workspace:*` (see [[09_DECISIONS/decision-workspace-protocol]]), the opt-in gates on auto-update/refresh/adoption, and the fork-owned signing key (see [[05_SECURITY/helper-signing-key]]) to close the practical holes instead.

### Consequences

- **Cost avoided.** A full rename was measured at **402 files**, **956 sites**, and **23 manifests** — an order of magnitude larger than the 12 manifests `workspace:*` actually touched to close the same substitution risk.
- **Ongoing cost avoided.** Beyond the one-time rename cost, every future upstream rebase would become a **mass conflict**: any file upstream touches that also references the old package names would need manual reconciliation on every merge, indefinitely, for as long as this fork continues tracking upstream. `workspace:*` does not carry this ongoing tax — a rebase only needs the pubkey-constant diff described in [[05_SECURITY/helper-signing-key]], not a package-name reconciliation across nearly a thousand sites.
- **What is accepted instead.** The fork does not get the structural guarantee a rename would provide (registry substitution becomes literally impossible, not just guarded against). It accepts the residual, narrower risk that `workspace:*` plus the opt-in gates plus the signing-key rotation leave in place — primarily the one open sub-dependency risk flagged in [[09_DECISIONS/decision-workspace-protocol]]'s Reopen-when clause.

### Reopen-when

Reopen this decision **if the fork ever publishes under its own name** — a genuine rename decouples the published artifact from upstream's namespace entirely, which only becomes worth the one-time cost and the ongoing rebase tax once there is a real, distinct public identity to protect. Publishing as `@claude-flow/*` today (per the current, unexecuted publish plan in the repo's `CLAUDE.md`) does not by itself meet that bar, since it still shares upstream's names.

## Related Code

- All `v3/@claude-flow/*/package.json` manifests — the 12 manifests actually touched by the chosen `workspace:*` fix, versus the 23-manifest, 402-file, 956-site footprint a rename would have required

## Related Notes

- [[09_DECISIONS/decision-workspace-protocol]]
- [[05_SECURITY/registry-decoupling]]
- [[05_SECURITY/helper-signing-key]]
