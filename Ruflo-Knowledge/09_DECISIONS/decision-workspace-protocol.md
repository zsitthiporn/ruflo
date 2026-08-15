---
title: Decision — Workspace Protocol
summary: ADR — chose the pnpm workspace:* protocol over version-pin bumps or a package rename to stop registry substitution, at the cost of publish becoming pnpm-dependent and one unresolved deeper risk.
tags: [decision, adr, workspace-protocol, pnpm, registry-substitution, publishing]
domain: decisions
service: Ruflo
status: active
last_reviewed: 2026-08-15
related: [05_SECURITY/registry-decoupling, 08_TROUBLESHOOTING/lockfile-registry-substitution, 09_DECISIONS/decision-package-rename-declined]
rag_include: true
retrieval_priority: high
audience: [agent, human]
sensitivity: public
source_of_truth: true
aliases: [workspace star decision, workspace:* ADR, why workspace protocol]
aliases_th: [การตัดสินใจใช้ workspace protocol]
task_types: [decision-record, dependency-management, security-audit]
---

# Decision — Workspace Protocol

## Summary

ADR recording the choice of pnpm's `workspace:*` protocol specifier, applied to all 34 intra-workspace dependency declarations across 12 manifests, as the fix for the registry-substitution hazard described in [[05_SECURITY/registry-decoupling]]. The decision closes the immediate hole but leaves publishing dependent on `pnpm` specifically, and surfaces a second, deeper substitution risk one layer down that remains an open owner decision.

## Key Terms

| Term | Meaning |
| --- | --- |
| `workspace:*` | pnpm-only protocol specifier forcing resolution to the local package unconditionally |
| Exact-pin bump | The rejected alternative of manually pinning exact versions and bumping them in lockstep |
| Package rename | The rejected alternative of renaming all `@claude-flow/*` packages to something registry-unreachable |
| `pnpm publish` | The command now required for `@claude-flow/cli` specifically, because it rewrites `workspace:*` at pack time — `npm publish` does not |

## Main Content

### Context

Three active registry substitutions were found in a green build (see [[05_SECURITY/registry-decoupling]] for the full finding): `pnpm install` was resolving intra-workspace `@claude-flow/*` dependencies to newer versions published on the public npm registry by upstream, rather than to the local workspace source, because those dependencies were declared with ordinary semver ranges instead of a workspace-local protocol.

### Options considered

1. **Exact-pin version bumps.** Pin every intra-workspace dependency to an exact version and bump it manually whenever the local package's version changes. Rejected: this only closes the hole as long as every bump is done correctly and immediately on every change — a single missed bump reopens exactly the substitution risk this is meant to fix, and it does nothing to prevent a *future* upstream release matching an already-pinned exact version by coincidence.
2. **`workspace:*` protocol.** Switch every intra-workspace specifier to pnpm's `workspace:*` protocol, which resolves to the local package unconditionally regardless of version string.
3. **Package rename.** Rename all `@claude-flow/*` packages to names upstream doesn't publish under, making registry substitution structurally impossible. Full cost/decision detail: [[09_DECISIONS/decision-package-rename-declined]].

### Decision

**`workspace:*` everywhere** — 34 specifiers across 12 manifests were converted.

### Consequences

- **Publishing now requires `pnpm`, not plain `npm`, for `@claude-flow/cli`.** A plain `npm publish` would ship a `package.json` containing the literal string `"workspace:*"`, which no installer can resolve — only `pnpm publish` rewrites the protocol into a real, resolvable version at pack/publish time. The repo's `CLAUDE.md` "Publishing to npm" section carries a stop-notice against running the old plain-`npm` publish flow for this reason, pending an actual `pnpm publish` execution to confirm the rewritten commands work end to end (unexecuted as of this note).
- **A deeper, unresolved risk one layer down.** `@claude-flow/cli`'s own manifest declares `workspace:*` for five of its own dependencies (`cli-core`, `mcp`, `neural`, `shared`, `memory`) that are **not** in its `bundleDependencies` list. When `pnpm publish` rewrites those to exact pinned versions, those exact versions **already exist on the public registry** — meaning `npm install @claude-flow/cli` would pull those five packages from the registry rather than from this fork's source, with no guarantee the registry copies match current local content. This is the same class of risk `workspace:*` was adopted to close, recurring one level deeper, and it is called out as an explicit **owner decision pending** rather than resolved by this ADR.

### Reopen-when

Reopen this decision if the fork ever actually publishes: the unresolved five-dependency risk above needs a concrete answer (bundle them, or bump-and-republish them each release, or something else) before a real publish should be trusted. Until publishing happens, this remains a flagged-but-live gap rather than a completed fix.

## Related Code

- All `v3/@claude-flow/*/package.json` manifests — 34 `workspace:*` specifiers
- `v3/@claude-flow/cli/package.json:99-134` — the five non-bundled `workspace:*` dependencies flagged as the deeper risk
- `D:/Project/ME/Ruflo/CLAUDE.md` — "Publishing to npm" stop-notice section

## Related Notes

- [[05_SECURITY/registry-decoupling]]
- [[08_TROUBLESHOOTING/lockfile-registry-substitution]]
- [[09_DECISIONS/decision-package-rename-declined]]
