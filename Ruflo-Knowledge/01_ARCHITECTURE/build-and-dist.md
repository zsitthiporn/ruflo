---
title: Build And Dist Pipeline
summary: The two dependency trees and build order, why dist/ (gitignored) is what actually runs, the Node 20+ requirement and this machine's workaround, and the out-of-tree smoke test.
tags: [architecture, build, dist, tsc, pnpm, node-version]
domain: architecture
service: Ruflo
status: active
last_reviewed: 2026-08-15
related: [monorepo-layout, cli-and-mcp-surface]
rag_include: true
retrieval_priority: high
audience: [agent, human]
sensitivity: public
source_of_truth: true
aliases: [build and dist, tsc, prepublishOnly, bundling, stage-internal-runtime-bundles, dist is gitignored, node version requirement]
aliases_th: [build, dist, เวอร์ชัน Node]
task_types: [architecture-reference, build, environment-setup]
note_role: focused
routing_intents: [build-the-fork, fix-broken-build, verify-node-version]
---

# Build And Dist Pipeline

## Summary

`dist/` is gitignored and is exactly what `bin/cli.js` imports — a checkout
that hasn't been built has no working CLI. Building requires **two separate
installs** (root npm workspace, `v3/` pnpm workspace) and Node 20+. This
machine's documented default node binary is older than that requirement; the
fix is calling a pinned newer binary directly rather than switching the
machine-wide version. The canonical proof the build worked is a smoke test
run from **outside** the repo.

## Key Terms

| Term | Meaning |
| --- | --- |
| `dist/` | Compiled output of each `v3/@claude-flow/*` package; gitignored (`.gitignore:103-104`); `bin/cli.js` imports from it directly |
| Two dependency trees | `npm install` at repo root (npm workspace) **and** `pnpm install` in `v3/` (separate pnpm workspace) — see [[monorepo-layout]] |
| `engines.node` | `>=20.0.0` (`package.json:157-159`) |
| Node version trap | This machine's default `node` binary is older than the requirement — see [[../08_TROUBLESHOOTING/node-version-traps]] |
| Out-of-tree smoke test | `node D:/Project/ME/Ruflo/bin/cli.js --version` run from a directory outside the repo |

## Main Content

### Two installs, then a build

1. `npm install` at the repo root — the npm workspace only wires in three
   packages directly (`v3/@claude-flow/{codex,plugin-agent-federation,security}`);
   everything else the root depends on resolves as an ordinary dependency.
2. `pnpm install` inside `v3/` — the separate pnpm workspace covering all
   `v3/@claude-flow/*` packages (`v3/pnpm-workspace.yaml`: `packages:
   ["@claude-flow/*"]`).
3. Build: `v3/package.json`'s `build` script is `pnpm -r build`, which
   builds every workspace member **in dependency order** via pnpm's
   topological resolution. `@claude-flow/cli`'s own `build` script is a
   plain `tsc` (`v3/@claude-flow/cli/package.json:84`).

Skipping either install step produces failures that read as broken code
(`spawn ENOENT` on `tsc`, missing modules) rather than a missed dependency
install — this has blocked agents before.

### `dist/` is what actually runs — not `src/`

`.gitignore:103-104` excludes both `dist-cjs/` and `dist/`. The real entry
point, `v3/@claude-flow/cli/bin/cli.js`, imports `../dist/src/index.js`
(normal CLI mode) or `../dist/src/mcp-client.js` (MCP mode) — never anything
under `src/`. Editing `.ts` source and expecting the running CLI to reflect
it **without rebuilding** is a live foot-gun; see
[[../07_RUNBOOKS/build-and-test-runbook]] for the rebuild-after-edit step.

The package's own `prepublishOnly` chain
(`v3/@claude-flow/cli/scripts/prepare-publish.mjs`) builds deliberately
narrowly: it invokes `tsc` directly (not `tsc --build`) against exactly two
directories — `@claude-flow/swarm` (the only project-reference dependency
the CLI needs) and the CLI package itself — specifically to avoid
recursively rebuilding unrelated optional workspace packages whose
development-only dependencies aren't required just to package the CLI. After
compiling, it calls `stageInternalRuntimeBundles()`
(`scripts/stage-internal-runtime-bundles.mjs`) to bundle internal runtime
deps, then chains `generate-catalog-manifest.mjs` → `sign-helpers.mjs` →
`verify-helpers.mjs` — see [[helper-system]] and
[[../07_RUNBOOKS/helper-signing-runbook]] for that last pair.

### Node version requirement and this machine's workaround

`package.json` declares `"engines": { "node": ">=20.0.0" }`. Per
`docs/fork-maintenance.md` §3(1a), this machine's *documented* default node
binary is v16.20.2 — below the requirement — and failing on it produces
misleading errors (`fetch is not defined` in scripts, `crypto.getRandomValues
is not a function` from Vite under vitest) that look like broken code rather
than a Node-version problem. The documented fix: call a newer pinned binary
directly rather than switching the machine-wide default —
`/c/Users/sitth/AppData/Local/nvm/v22.22.3/node.exe`, or prepend that
directory to `PATH` for one command.

**Observed this session** (2026-08-15): the machine's currently-active
default `node.exe` resolves to v24.19.0 via `nvm4w` at `/c/nvm4w/nodejs/node`
— already ≥20, satisfying the requirement outright. This is environment
drift since the documentation was written, not a code contradiction; the
documented `v22.22.3` pinned-binary fallback remains valid if the default
ever regresses below 20 again. Either way, **verify with `node.exe
--version`** rather than trusting either number blindly.

Separately, and independent of which version is active: **in Git Bash, the
bare `node` shim fails with `stdin is not a tty`** — reproduced live this
session (`node -e "..."` → error). `node.exe` (explicit `.exe` suffix) works
correctly in Git Bash; plain `node` works fine in PowerShell and cmd. This
bit an agent before who wrongly concluded the build itself was broken.

### The out-of-tree smoke test

```bash
cd /some/directory/outside/the/repo
node.exe D:/Project/ME/Ruflo/bin/cli.js --version
# → ruflo v3.35.0
```

Run **from outside the repo** deliberately: any CLI invocation, even
`--version`, writes `.claude-flow/policy/state.json` into the raw current
working directory (see [[state-layer]]) — running the smoke test from inside
a repo checkout pollutes it. **Verified this session**: ran exactly this
command from a scratch directory and got `ruflo v3.35.0`, matching the
`package.json` version.

The `--version` fast path (`bin/cli.js:120-141`) is itself a build-adjacent
detail worth knowing: it reads the version straight from `package.json` and
exits before importing anything from `dist/` at all — so a passing
`--version` smoke test does **not** by itself prove the rest of `dist/`
built cleanly. For that, run an actual command (`doctor`, `status`) or the
test suite — see [[../07_RUNBOOKS/build-and-test-runbook]].

## Related Code

- `D:/Project/ME/Ruflo/.gitignore:103-104` — `dist-cjs/`, `dist/` excluded
- `D:/Project/ME/Ruflo/package.json:157-159` — `engines.node >=20.0.0`
- `D:/Project/ME/Ruflo/v3/package.json` — `"build": "pnpm -r build"`
- `D:/Project/ME/Ruflo/v3/@claude-flow/cli/package.json:84` — `"build": "tsc"`
- `D:/Project/ME/Ruflo/v3/@claude-flow/cli/scripts/prepare-publish.mjs:1-55` — narrow `tsc` build + bundling + signing chain
- `D:/Project/ME/Ruflo/v3/@claude-flow/cli/bin/cli.js:120-141` — `--version` fast path
- `docs/fork-maintenance.md` §3(1),(1a),(1b) — install/build/Node/shell notes

## Related Notes

- [[monorepo-layout]]
- [[cli-and-mcp-surface]]
- [[state-layer]]
- [[helper-system]]
- [[../08_TROUBLESHOOTING/node-version-traps]]
- [[../07_RUNBOOKS/build-and-test-runbook]]
