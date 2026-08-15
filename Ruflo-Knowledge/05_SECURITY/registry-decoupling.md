---
title: Registry Decoupling
summary: Four distinct paths that let upstream registry code silently run inside the fork, all cut on 2026-08-14 — version pins, helper auto-refresh, silent auto-update/adoption, and stale npx doc examples.
tags: [security, registry, workspace-protocol, supply-chain, upstream-substitution]
domain: security
service: Ruflo
status: active
last_reviewed: 2026-08-15
related: [09_DECISIONS/decision-workspace-protocol, 08_TROUBLESHOOTING/lockfile-registry-substitution, 05_SECURITY/helper-signing-key, 09_DECISIONS/decision-opt-in-registry-callbacks, 09_DECISIONS/decision-package-rename-declined]
rag_include: true
retrieval_priority: high
audience: [agent, human]
sensitivity: public
source_of_truth: true
aliases: [upstream substitution, registry decoupling, workspace protocol fix, npx re-infection]
aliases_th: [การตัดขาดจากรีจิสทรีต้นทาง, ปัญหาซอฟต์แวร์ต้นทางแทนที่โค้ดฟอร์ก]
task_types: [security-audit, incident-response, dependency-management]
---

# Registry Decoupling

## Summary

Four independent paths let unmodified upstream code run inside this fork instead of this fork's own source — all four were cut in commits `2f9a7aee6` and `d61f10e7d` on 2026-08-14. The most serious was intra-workspace version pins letting `pnpm` silently substitute newer registry builds for local packages: 3 **active** substitutions were found in a green build (upstream CLI `3.38.8` replacing local `3.35.0`, one of them reachable via a caret range). All were fixed by moving to `workspace:*` protocol specifiers everywhere.

## Key Terms

| Term | Meaning |
| --- | --- |
| Registry substitution | pnpm/npm resolving an intra-workspace dependency to a newer published version instead of the local source |
| `workspace:*` | pnpm protocol specifier that forces resolution to the local package, never the registry, regardless of version |
| Re-infection vector | A code path that could reintroduce a cut hazard automatically (e.g. hooks that spawn `npx`) |
| Opt-in gate | A behavior disabled by default, requiring an explicit environment variable to enable |

## Main Content

### Path 1 — intra-workspace version pins (the core fix)

Before the fix, packages under `@claude-flow/*` referenced each other by ordinary semver ranges rather than a workspace-local protocol. Because those same package names are also published to the public npm registry by upstream, `pnpm install` was free to resolve a dependency to whichever version satisfied the range — local or registry — and it did not always pick local. Verification found **3 active substitutions in a green build**: the local `@claude-flow/cli` at `3.35.0` was being replaced at install time by upstream's published `3.38.8`, and at least one of the three was reachable via a **caret range** (`^3.x`) rather than an exact pin, meaning even a patch-level upstream release could trigger it.

The fix: **all 34 intra-workspace specifiers** across the monorepo were converted to the `workspace:*` protocol. This is a pnpm-specific instruction that always resolves to the local package regardless of what version string it declares, and the lockfile now has **zero registry entries** for the fork's own package names. Full decision rationale: [[09_DECISIONS/decision-workspace-protocol]]. Detection method and the lockfile mechanics of how this happened: [[08_TROUBLESHOOTING/lockfile-registry-substitution]].

### Path 2 — helper auto-refresh trusted upstream's signing key

The helper auto-refresh mechanism verified refreshed helper files against **upstream's** Ed25519 public key — meaning helpers signed by upstream were accepted as legitimate inside this fork, which is exactly backwards for a fork whose whole point is running its own code. The key was rotated to a fork-owned pair. Full detail: [[05_SECURITY/helper-signing-key]].

### Path 3 — silent auto-update and auto-adoption

Three separate behaviors ran automatically without the user opting in:

- **Auto-update** ran `npm install` from the current working directory with no confirmation.
- **Helper refresh** could overwrite local helper files automatically.
- **Proven-config adoption** could adopt configuration from a remote source automatically — and this third path, found mid-task rather than in the initial sweep, had **no opt-out at all** until this fix.

All three are now opt-in via explicit environment variables (`CLAUDE_FLOW_AUTO_UPDATE`, `RUFLO_HELPERS_AUTO_REFRESH`, `RUFLO_PROVEN_CONFIG_AUTO_ADOPT`). Decision rationale for choosing opt-in over a safer-default-with-override: [[09_DECISIONS/decision-opt-in-registry-callbacks]].

### Path 4 — stale documentation examples

Roughly **207 doc examples** across the repository read `npx …@latest`, which fetches the upstream registry build rather than this fork's source — exactly the anti-pattern the rest of this fix eliminates at the dependency level, just written into prose instead of code. These were rewritten to `node bin/cli.js …`, matching the fork's actual invocation convention.

### The re-infection vector

Independently of the four paths above, the helpers-generator was found to emit `npx` spawn calls **into the hooks it generates** — meaning even after the four paths above were closed, a freshly generated hook could reintroduce an `npx …@latest` call as generated code. This was closed by deleting the `spawn` import from the generator entirely: any future reintroduction of this pattern now throws `ReferenceError` at generation time rather than silently producing a vulnerable hook.

### Package rename — considered and declined

Renaming all `@claude-flow/*` packages (a 402-file, 956-site, 23-manifest change) was considered as an alternative fix — a different package name can never collide with upstream's registry entries by construction. It was declined because `workspace:*` closes the identical hole using changes to only 12 manifests, with far less blast radius and no mass-conflict cost on every future upstream rebase. Full ADR: [[09_DECISIONS/decision-package-rename-declined]].

## Related Code

- All `v3/@claude-flow/*/package.json` manifests — now carry `workspace:*` for intra-workspace dependencies (e.g. `v3/@claude-flow/cli/package.json:100-106,125`)
- `v3/@claude-flow/cli/src/init/helper-refresh.ts` — helper auto-refresh logic, opt-in gate
- `v3/@claude-flow/cli/src/config/proven-config-refresh.ts` — proven-config auto-adoption, opt-in gate
- `v3/@claude-flow/cli/src/update/index.ts`, `v3/@claude-flow/cli/src/update/rate-limiter.ts`, `v3/@claude-flow/cli/src/commands/update.ts` — auto-update path, opt-in gate

## Related Notes

- [[09_DECISIONS/decision-workspace-protocol]]
- [[08_TROUBLESHOOTING/lockfile-registry-substitution]]
- [[05_SECURITY/helper-signing-key]]
- [[09_DECISIONS/decision-opt-in-registry-callbacks]]
- [[09_DECISIONS/decision-package-rename-declined]]
- [[05_SECURITY/upstream-telemetry-removal]]
