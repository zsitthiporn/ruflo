---
title: Lockfile Registry Substitution
summary: pnpm install rewrote 8 lockfile link: entries into registry downloads because the deps were version pins, silently pulling upstream code into a green build. Detection and prevention commands, now fixed by workspace:*.
tags: [troubleshooting, pnpm, lockfile, registry, supply-chain, detection]
domain: troubleshooting
service: Ruflo
status: active
last_reviewed: 2026-08-15
related: [09_DECISIONS/decision-workspace-protocol, 05_SECURITY/registry-decoupling]
rag_include: true
retrieval_priority: high
audience: [agent, human]
sensitivity: public
source_of_truth: true
aliases: [pnpm lockfile substitution, link: entries turned into versions, detect registry substitution]
aliases_th: [ล็อกไฟล์ pnpm ถูกแทนที่, ตรวจจับแพ็กเกจต้นทางแอบแทนที่]
task_types: [troubleshooting, dependency-management, security-audit]
---

# Lockfile Registry Substitution

## Summary

`pnpm install` rewrote 8 lockfile `link:` entries into ordinary registry downloads — `@claude-flow/cli` resolved to upstream's `3.38.8`, `@claude-flow/memory` resolved to `alpha.22` — because those dependencies were declared as version pins rather than the `workspace:*` protocol. The result was a **green build that silently contained upstream code** instead of this fork's own source. Detection is a lockfile grep plus a `realpathSync` check; the permanent fix is the `workspace:*` protocol switch described in [[09_DECISIONS/decision-workspace-protocol]]. Never commit a lockfile whose `link:` entries have turned into version entries.

## Key Terms

| Term | Meaning |
| --- | --- |
| `link:` entry | A pnpm lockfile entry meaning "resolved to the local workspace package," the safe state |
| Registry entry | A pnpm lockfile entry pointing at a downloaded, published version — the unsafe state for an intra-workspace dependency |
| `realpathSync` check | Resolving a package's real filesystem path to confirm it points inside the workspace, not `node_modules`'s registry cache |

## Main Content

### What happened

Before the `workspace:*` fix, several intra-workspace `@claude-flow/*` dependencies were declared with ordinary semver version ranges. Because those same package names exist on the public npm registry (published by upstream), `pnpm install` treated the range as satisfiable by either the local workspace package or a matching published version — and in practice it substituted the **registry** version for at least 8 lockfile entries. Concretely: `@claude-flow/cli` resolved to upstream's `3.38.8` instead of the local `3.35.0`, and `@claude-flow/memory` resolved to `alpha.22`.

The dangerous part is not the substitution alone — it's that the resulting build was **green**. Tests passed, the CLI ran, nothing looked broken, because upstream's published code is functional. It simply wasn't this fork's code, and nothing in the normal build/test loop would have surfaced that difference.

### Detection

Two checks together confirm whether a workspace is affected:

1. **Grep the lockfile for registry entries under `@claude-flow/`.** The desired count is **zero** — every intra-workspace dependency should show as a `link:` entry, never a version-resolved registry entry.
2. **`realpathSync` on the installed package.** Resolving `node_modules/@claude-flow/<pkg>` to its real filesystem path must land **inside the workspace** (i.e. it's a symlink back to the local package source), not inside a registry-populated `node_modules` cache directory.

Either check alone can miss an edge case; running both together is the reliable detection method used when this was first found.

### The fix

`workspace:*` as the protocol specifier for every intra-workspace dependency forces pnpm to resolve to the local package unconditionally — there is no version string for the registry to satisfy instead, because the protocol itself, not a version range, is what pnpm matches on. See [[09_DECISIONS/decision-workspace-protocol]] for the full decision record, including the remaining open risk one layer deeper (publish-time resolution of the CLI's own non-bundled sub-dependencies).

### The rule going forward

**Never commit a lockfile whose `link:` entries have turned into version entries.** If a `pnpm install` run changes an intra-workspace dependency from a `link:` entry to a resolved-version entry, that is a regression signal, not routine lockfile churn — it means either a `workspace:*` specifier was reverted somewhere, or a new dependency was added without the protocol. Treat it as a stop-and-investigate condition before committing.

## Related Code

- `pnpm-lock.yaml` (and `v3/pnpm-lock.yaml` for the v3 workspace) — where `link:` vs. registry entries are visible
- All `v3/@claude-flow/*/package.json` manifests — now declare `workspace:*` for intra-workspace dependencies

## Related Notes

- [[09_DECISIONS/decision-workspace-protocol]]
- [[05_SECURITY/registry-decoupling]]
