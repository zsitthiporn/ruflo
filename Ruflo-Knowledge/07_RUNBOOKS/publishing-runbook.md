---
title: Publishing Runbook
summary: The honest current state of publishing under workspace:* — UNEXECUTED, pnpm-publish required for @claude-flow/cli only, the three-package release train, and the open dependency-completeness problem. No confidence claimed beyond what is verified.
tags: [runbook, publishing, npm, pnpm, workspace-protocol]
domain: runbook
service: Ruflo
status: active
last_reviewed: 2026-08-15
related: [../01_ARCHITECTURE/monorepo-layout, ../01_ARCHITECTURE/build-and-dist]
rag_include: true
retrieval_priority: high
audience: [agent, human]
sensitivity: public
source_of_truth: true
aliases: [publishing, npm publish, pnpm publish, dist-tag, workspace:* publish risk, release train]
aliases_th: [publish npm, เผยแพร่แพ็กเกจ]
task_types: [runbook, release, publishing]
note_role: focused
routing_intents: [publish-a-package, understand-publish-risk, check-release-train-status]
---

# Publishing Runbook

## Summary

**This procedure has not been executed since the `workspace:*` rewrite.**
Three things are unproven, not merely undocumented, and this note repeats
that qualification rather than upgrading it to false confidence. Only
`@claude-flow/cli` carries `workspace:*` in its own manifest, so it alone
needs `pnpm publish`; `claude-flow` (root) and `ruflo` keep plain
`npm publish`. Do not treat any success claim below as covering the
post-rewrite flow unless it explicitly says so.

## Key Terms

| Term | Meaning |
| --- | --- |
| `workspace:*` | pnpm-only dependency protocol; `npm publish` would ship it as the literal string, unresolvable by any installer |
| The three-package train | `@claude-flow/cli`, `claude-flow` (root umbrella), `ruflo` (thin wrapper) — publish in that order |
| Dependency-completeness problem | `@claude-flow/cli`'s five `workspace:*` deps (`cli-core`, `mcp`, `neural`, `shared`, `memory`) are **not** in its `bundleDependencies` — `pnpm publish` pins them to versions that already exist on the public registry, which may not match this fork's source |
| `bundleDependencies` | Only `codex`, `plugin-agent-federation`, `security` for `@claude-flow/cli` — everything else resolves externally after `pnpm publish` rewrites `workspace:*` |

## Main Content

### What is proven vs. what is not

**Proven** (verified in this session by reading the manifests directly):

- `v3/@claude-flow/cli/package.json` `dependencies` includes `workspace:*`
  for `cli-core`, `mcp`, `neural`, `shared`; `optionalDependencies` includes
  `workspace:*` for `memory` — none of these five appear in
  `bundleDependencies`, which lists only `codex`, `plugin-agent-federation`,
  `security` (`package.json:99-134,163-167`).
- The root `claude-flow` package's own `dependencies` reference these same
  five as **ordinary semver ranges**, not `workspace:*` (`package.json:67-74`)
  — confirming the root manifest is not itself exposed to the `workspace:*`
  rewrite problem, but does depend on packages whose fork-vs-registry
  identity is the open question.
- `prepublishOnly` for `@claude-flow/cli` is `node scripts/prepare-publish.mjs`
  (`package.json:90`), and that script builds narrowly (only
  `@claude-flow/swarm` + the CLI itself via direct `tsc`, not `tsc --build`),
  stages internal runtime bundles, then chains
  `generate-catalog-manifest.mjs` → `sign-helpers.mjs` → `verify-helpers.mjs`
  — confirmed by reading `prepare-publish.mjs:1-55` directly. This
  `prepublishOnly` chain runs for **both** `pnpm publish` and `pnpm pack`'s
  underlying lifecycle *only* via `publish` — `pnpm pack` does **not** run
  `prepublishOnly` (pnpm's own documented lifecycle-script order), which is
  the concrete reason this runbook uses `pnpm publish` directly rather than
  `pnpm pack` + `npm publish <tarball>`.
- The Windows-specific `prepublishOnly` shell failure (POSIX-only `mkdir -p`
  / `cp -r` under `cmd.exe`) that broke earlier releases looks fixed as of
  commit `72875da93`: the current `prepare-publish.mjs` uses only
  cross-platform `node:fs/promises` calls — but **not re-verified by an
  actual Windows publish since that fix landed**. Treat as probably-fixed,
  not confirmed-fixed.

**Unproven** — three specific gaps, none resolved by this documentation pass:

1. **`@claude-flow/cli`'s own dependency completeness.** `pnpm publish`
   rewrites each `workspace:*` entry to that sub-package's current
   `version` field, and those exact versions **already exist on the public
   npm registry** (confirmed 2026-08-14 via `npm view`) — so
   `npm install @claude-flow/cli` would pull `cli-core`/`mcp`/`neural`/`shared`/`memory`
   from the registry, not from this fork's source, with no guarantee the
   registry copies match current local content. This is the same class of
   risk `workspace:*` was adopted to close, one level deeper.
2. **The root `claude-flow` tarball embeds two raw, unrewritten
   `workspace:*` manifests** — its `files` allowlist copies
   `v3/@claude-flow/cli/package.json` and `v3/@claude-flow/guidance/package.json`
   byte-for-byte (`package.json:30,39`), and this copy mechanism never
   touches those `workspace:*` strings. Looks inert (no runtime code found
   reading `.dependencies` from an embedded `package.json`), but not proven
   safe.
3. **The granular npm token's "confirmed end-to-end" history predates the
   pnpm switch.** It has only ever been exercised against plain
   `npm publish`, never against `pnpm publish`. `NPM_CONFIG_USERCONFIG` is
   documented by pnpm to work the same way as npm, but that specific
   combination is unproven until actually run once.

### Gate before the first real publish

Two MUST-run checks before packing or publishing anything:

- `node scripts/audit-umbrella-version-lockstep.mjs` — verifies the three
  release manifests' `version` fields (and `ruflo`'s ordinary semver
  dependency range on `@claude-flow/cli`) agree. Unaffected by `workspace:*`
  — it only reads plain version fields, never a workspace-protocol specifier.
- `node scripts/smoke-cli-npx-install.mjs` — packs via `pnpm pack` and
  asserts the installed CLI runs. Note explicitly: this smoke test checks
  **installability**, not that the resolved sub-packages are this fork's own
  content — it would not by itself catch unproven-gap #1 above.

### Step 0: authenticate

`pnpm publish`/`npm publish` need a registry token. This fork's documented
mechanism is a granular npm access token (`package: write` + `bypass_2fa:
true`, scoped to `@claude-flow/cli`, `claude-flow`, `ruflo`) pulled from GCP
Secret Manager into a **throwaway** `.npmrc` via `NPM_CONFIG_USERCONFIG`, used
only for the duration of the publish, then deleted — never written into the
repo's own `.npmrc` or committed anywhere. The exact commands (secret name,
GCP project, cleanup step) are in root `CLAUDE.md`'s "Publishing to npm"
section; do not improvise a different token-handling path. **This mechanism
has only ever been exercised against plain `npm publish`, never
`pnpm publish`** — unproven-gap #3, still open as of this note.

If that token is dead or its `bypass_2fa` scope has narrowed, the fallback is
a WebAuthn-gated flow that a human must drive (an agent cannot approve a
WebAuthn browser prompt) — narrow the account's "require 2FA for write
actions" setting first, then `npm login` refreshes the session; every
`npm dist-tag add` call after that still needs a **separate** WebAuthn
approval per call, not once per session. See root `CLAUDE.md` for the full
procedure.

### The publish sequence (order matters)

1. **`@claude-flow/cli`** — the only package needing `pnpm publish`:
   ```bash
   cd v3/@claude-flow/cli
   npm version <new-version> --no-git-tag-version
   npm run build   # optional fail-fast; prepublishOnly rebuilds anyway
   pnpm publish    # NOT pnpm pack — pack skips prepublishOnly
   # if pnpm isn't on PATH: corepack pnpm@8.15.0 publish
   # if publishing from a detached/tag-equivalent worktree: pnpm publish --no-git-checks
   npm dist-tag add @claude-flow/cli@<version> alpha
   npm dist-tag add @claude-flow/cli@<version> v3alpha
   ```
2. **`claude-flow`** (root umbrella) — plain `npm publish`, no `workspace:*`
   in this manifest, but carries unproven-gap #2's embedded raw manifests:
   ```bash
   cd D:\Project\ME\Ruflo
   npm version <new-version> --no-git-tag-version
   npm publish
   npm dist-tag add claude-flow@<version> alpha
   npm dist-tag add claude-flow@<version> v3alpha
   ```
3. **`ruflo`** (thin wrapper — what most users actually run via
   `npx ruflo`) — plain `npm publish`:
   ```bash
   cd ruflo
   npm version <new-version> --no-git-tag-version
   npm publish
   npm dist-tag add ruflo@<version> alpha
   npm dist-tag add ruflo@<version> v3alpha
   ```

### Versioning policy

From 3.7.0 onward: **stable semver, no alpha pre-releases** (alpha series
ended at 3.7.0-alpha.81). PATCH = bug fix, no API/schema change. MINOR =
backward-compatible addition (new MCP tool, flag, agent type). MAJOR =
breaking CLI/MCP/file-layout/default-behavior change. Default publish tag is
`latest`; the `alpha`/`v3alpha` dist-tags exist only for historical
compatibility and must always point at the same version as `latest`.

### Verification (required before reporting publishing complete)

```bash
for pkg in @claude-flow/cli claude-flow ruflo; do
  echo "$pkg: $(npm view $pkg@latest version)"
  npm view $pkg dist-tags --json
done
# All three must show latest === alpha === v3alpha === new version
```

Do not trust a dist-tag command's own stdout alone as proof — a WebAuthn
approval pending in a browser produces no terminal output an agent can see.
Confirm with `npm view <pkg>@<version> version` before telling anyone
publishing succeeded.

## Related Code

- `D:/Project/ME/Ruflo/v3/@claude-flow/cli/package.json:99-134,163-167` — `dependencies`/`optionalDependencies`/`bundleDependencies` mismatch
- `D:/Project/ME/Ruflo/package.json:4-8,67-74,205-209` — root workspace, ordinary-dep list, `bundleDependencies`
- `D:/Project/ME/Ruflo/v3/@claude-flow/cli/scripts/prepare-publish.mjs:1-55` — build + bundle + sign + verify chain
- `D:/Project/ME/Ruflo/scripts/smoke-cli-npx-install.mjs` — pre-publish install gate
- `D:/Project/ME/Ruflo/scripts/audit-umbrella-version-lockstep.mjs` — version-lockstep check across the three manifests
- Root `CLAUDE.md` "Publishing to npm" section — the full stop notice this note summarizes

## Related Notes

- [[../01_ARCHITECTURE/monorepo-layout]]
- [[../01_ARCHITECTURE/build-and-dist]]
- [[../01_ARCHITECTURE/helper-system]]
- [[../09_DECISIONS/decision-workspace-protocol]]
- [[../07_RUNBOOKS/helper-signing-runbook]]
