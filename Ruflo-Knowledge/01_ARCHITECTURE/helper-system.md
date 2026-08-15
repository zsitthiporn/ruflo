---
title: Helper System
summary: The Claude Code hook helpers, the dual root/package copies, the Ed25519 signing chain, helpers-generator.ts as the source of generated hooks, and the auto-refresh gates that are now opt-in rather than opt-out.
tags: [architecture, helpers, hooks, signing, ed25519, security]
domain: architecture
service: Ruflo
status: active
last_reviewed: 2026-08-15
related: [monorepo-layout, build-and-dist]
rag_include: true
retrieval_priority: high
audience: [agent, human]
sensitivity: public
source_of_truth: true
aliases: [helper system, hook-handler.cjs, intelligence.cjs, helpers.manifest.json, RUFLO_HELPERS_PUBKEY, helper auto-refresh, CRITICAL_HELPERS]
aliases_th: [ระบบ helper, การเซ็นรับรอง helper]
task_types: [architecture-reference, security, hooks-development]
note_role: focused
routing_intents: [understand-helper-provenance, work-on-hooks, debug-helper-refresh]
---

# Helper System

## Summary

Claude Code's own hook engine executes `.claude/helpers/*.cjs` at the repo
root — those are the files that actually run. A second, signed copy lives
inside the `@claude-flow/cli` package
(`v3/@claude-flow/cli/.claude/helpers/`), which is both the npm-published
source of truth and the copy source for auto-refresh. Four "critical"
auto-executing helpers are Ed25519-signed via a fork-owned key; a mismatch is
refused, fail-closed. Auto-refresh, auto-update, and proven-config-adoption
are now **opt-in**, not opt-out — a fresh workspace is safe by default,
independent of anyone remembering an environment variable.

## Key Terms

| Term | Meaning |
| --- | --- |
| Root copy | `D:/Project/ME/Ruflo/.claude/helpers/` — what Claude Code's hooks in `.claude/settings.json` actually execute |
| Package copy | `v3/@claude-flow/cli/.claude/helpers/` — npm-published source, carries `helpers.manifest.json` |
| `CRITICAL_HELPERS` | `helper-refresh.ts:69-76` — `auto-memory-hook.mjs`, `hook-handler.cjs`, `intelligence.cjs`, `statusline.cjs` |
| `RUFLO_HELPERS_PUBKEY` | `helper-signing.ts:48-50` — hardcoded Ed25519 public key; the rebase-checklist item that must never silently revert |
| `helpers-generator.ts` | `src/init/helpers-generator.ts` (1459 lines) — the CLI's own code generator for hook content; both `ruflo init`'s output and the unresolvable-source fallback |
| `.LOCKED` | Marker file (project `.claude/helpers/.LOCKED`, global `~/.claude/helpers/.LOCKED`) that short-circuits auto-refresh for that dir |

## Main Content

### Dual copies, and why they differ

- **Root** (`D:/Project/ME/Ruflo/.claude/helpers/`) has ~35 files (`.sh`,
  `.mjs`, `.cjs`) plus a `.LOCKED` marker (present, verified this session —
  `ls -la` shows it dated 2026-08-13). No `helpers.manifest.json` here; this
  copy is hand-maintained and is what Claude Code's hooks in
  `.claude/settings.json` (`PreToolUse`/`PostToolUse` → `hook-handler.cjs`)
  actually invoke.
- **Package copy** (`v3/@claude-flow/cli/.claude/helpers/`) has a smaller,
  overlapping set plus `helpers.manifest.json` (the signed manifest) and a
  `pre-commit`/`post-commit` pair not present in the root copy. This is the
  copy that ships in the npm tarball and the copy source `writeCriticalHelpers()`
  reads from when auto-refresh fires.

### The signing chain (ADR-174)

1. `scripts/sign-helpers.mjs` hashes the four `CRITICAL_HELPERS` (SHA-256
   each), builds a canonical-bytes manifest (`{version, files}` with file
   keys sorted), and signs it with an Ed25519 private key. Key resolution
   order: (1) GCP Secret Manager via `RUFLO_HELPERS_SIGNING_SECRET`
   (preferred for CI/publish), (2) `RUFLO_HELPERS_SIGNING_KEY=<pem-path>`,
   (3) default `~/.ruflo/helpers-signing.key`. A `--stdin-key` mode exists so
   the PEM never touches argv or shell-captured output. Output:
   `.claude/helpers/helpers.manifest.json` (package copy).
2. `src/init/helper-signing.ts` holds the hardcoded public half
   (`RUFLO_HELPERS_PUBKEY`) plus `verifyHelpersManifest()` — fails closed
   (returns `null`) on any malformed JSON, wrong algorithm, or bad signature.
3. `scripts/verify-helpers.mjs` runs in `prepublishOnly` **after**
   `sign-helpers.mjs`: re-verifies the signature against the **compiled**
   `dist/src/init/helper-signing.js` (not the `.ts` source — so it checks
   exactly what a real install would trust), confirms
   `manifest.version === package.json version`, and re-hashes every critical
   helper on disk against the manifest.

### Key history — two rotations in one day, and a near-loss

The fork previously shipped **upstream's** public key — since upstream holds
the matching private half, upstream-signed helpers verified as legitimate
here and could silently overwrite fork-edited ones. Rotated 2026-08-14 to a
fork-owned key. That first fork-owned key was generated, used to sign, and
then **lost the same day**: the private half at `~/.ruflo/helpers-signing.key`
was swept during an unrelated cleanup of "ruflo artifacts" from the user
profile — understandable, since `~/.ruflo` looks exactly like tool litter it
is not. A second rotation followed; `~/.ruflo/DO-NOT-DELETE.md` now exists on
disk specifically so a person doing that kind of cleanup sees the warning in
the one place they'd actually look. See
[[../07_RUNBOOKS/helper-signing-runbook]] for the operational discipline this
forces, and [[../05_SECURITY/helper-signing-key]] for the fuller security
record.

### `helpers-generator.ts` — the generator is the trust root, not a fallback of last resort

`src/init/helpers-generator.ts` is the CLI's own code generator for
`hook-handler.cjs`, an intelligence stub, and `auto-memory-hook.mjs`. It
serves two roles: (1) it is what `ruflo init` writes into a *fresh* project
— there is no signed source to copy from yet in that case; (2)
`writeCriticalHelpers()` in `helper-refresh.ts` falls back to it when the
installed package's helpers directory is unresolvable (broken `npx` paths).
The fallback path needs **no manifest verification** — its content comes
directly from the CLI's own compiled code, which is already the trust root,
so there's nothing external to verify against.

### Refresh gates — opt-in, layered

`autoRefreshHelpersIfStale()` (`helper-refresh.ts:314-367`) runs two passes,
project then optional global:

1. **`RUFLO_HELPERS_AUTO_REFRESH`** must be truthy (`1`/`true`/`on`/`yes`) or
   the whole function is a silent no-op — deliberately silent, because "not
   opted in" is the expected default state, not an error.
2. **`RUFLO_HELPERS_LOCKED`** env, if truthy, blocks both passes.
3. Per-directory **`.LOCKED`** marker file blocks that directory specifically
   — the escape hatch for anyone hand-editing helpers, closing the
   concurrent-session clobber scenario described in root `CLAUDE.md`
   ("Concurrent-session helper corruption").
4. **Forward-only version guard**: refresh only fires when the installed
   CLI's version is `semver.gt` the helpers' stamped version — comparing with
   inequality (`!==`) instead was a real corruption vector, confirmed live: a
   stale/older cached binary invoked against a newer project would otherwise
   silently downgrade hand-fixed helpers to its own older bundled copies.
5. **Signed-copy path is itself fail-closed**: `writeCriticalHelpers()`
   verifies the manifest signature, then every source helper's SHA-256,
   **before copying anything** — a single bad hash blocks the entire copy,
   not just that one file.
6. The global pass (`~/.claude/helpers/`) only runs when the caller passes
   `alsoRefreshGlobal: true` (production `src/index.ts` does; tests
   deliberately don't, to avoid touching a developer's real home directory).

**Observed this session, report-only**: `~/.claude/helpers/` does not exist
at all on this machine (`ls -la` → "No such file or directory") — so neither
a `.LOCKED` marker nor any helper content is present globally, which is a
gap versus `docs/fork-maintenance.md` §2's claim that the global `.LOCKED`
marker was added 2026-08-13. Severity is low: auto-refresh is opt-in
end-to-end (point 1 above), and `refreshOneHelpersDir()` no-ops for any
directory that doesn't already contain a `hook-handler.cjs`
(`helper-refresh.ts:232`) — so a missing global directory is inert, not an
open hole. Flagged here as a documentation-vs-disk discrepancy; fixing it
(creating the directory or the marker) is outside this note's ownership
(`~/.claude` is outside the two folders this pass may write to).

## Related Code

- `D:/Project/ME/Ruflo/.claude/helpers/.LOCKED` — root project marker (present, verified)
- `D:/Project/ME/Ruflo/v3/@claude-flow/cli/.claude/helpers/helpers.manifest.json` — signed manifest
- `D:/Project/ME/Ruflo/v3/@claude-flow/cli/src/init/helper-signing.ts:16-98` — pubkey constant, verify function
- `D:/Project/ME/Ruflo/v3/@claude-flow/cli/src/init/helper-refresh.ts:1-367` — refresh gates, forward-only guard, dual-pass logic
- `D:/Project/ME/Ruflo/v3/@claude-flow/cli/src/init/helpers-generator.ts` — generator (1459 lines)
- `D:/Project/ME/Ruflo/v3/@claude-flow/cli/scripts/sign-helpers.mjs` — signing script
- `D:/Project/ME/Ruflo/v3/@claude-flow/cli/scripts/verify-helpers.mjs` — publish-time verification
- `docs/fork-maintenance.md` §1, §2 — rotation decision record, guard inventory

## Related Notes

- [[monorepo-layout]]
- [[build-and-dist]]
- [[../05_SECURITY/helper-signing-key]]
- [[../07_RUNBOOKS/helper-signing-runbook]]
- [[../07_RUNBOOKS/upstream-rebase-runbook]]
