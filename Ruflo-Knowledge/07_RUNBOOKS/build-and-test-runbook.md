---
title: Build And Test Runbook
summary: Clean build from scratch, running vitest under Node 22 from the cli package, and the rebuild-after-edit step — each with a verification command.
tags: [runbook, build, test, vitest, node]
domain: runbook
service: Ruflo
status: active
last_reviewed: 2026-08-15
related: [../01_ARCHITECTURE/build-and-dist, ../01_ARCHITECTURE/monorepo-layout]
rag_include: true
retrieval_priority: high
audience: [agent, human]
sensitivity: public
source_of_truth: true
aliases: [build and test runbook, npm run build, npm test, vitest run, clean build]
aliases_th: [build และ test, รัน test]
task_types: [runbook, build, testing]
note_role: focused
routing_intents: [build-and-test-locally, run-vitest, rebuild-after-code-change]
---

# Build And Test Runbook

## Summary

Three procedures: a clean build from a fresh checkout, running the CLI
package's vitest suite under a Node version that actually satisfies the
`crypto.getRandomValues` requirement Vite needs, and the minimal
rebuild-after-edit loop. Every step below has been reasoned from
`docs/fork-maintenance.md` and the package's own `package.json`; the
out-of-tree `--version` smoke test was additionally run live this session.
Run every command from PowerShell, or from Git Bash with the `node.exe`
(not `node`) binary — see [[../01_ARCHITECTURE/build-and-dist]] for why.

## Key Terms

| Term | Meaning |
| --- | --- |
| Clean build | `npm install` (root) + `pnpm install` (`v3/`) + `pnpm -r build` |
| `node.exe` | Explicit `.exe` suffix required in Git Bash — bare `node` fails `stdin is not a tty` |
| Pinned Node 22 | `C:\Users\sitth\AppData\Local\nvm\v22.22.3\node.exe` — documented fallback if the machine's default node regresses below 20 |
| vitest direct invoke | `node.exe node_modules/vitest/vitest.mjs run <file>` from `v3/@claude-flow/cli/` — bypasses the shell shim entirely |

## Main Content

### 1. Clean build from scratch

```powershell
# From D:\Project\ME\Ruflo
npm install

cd v3
pnpm install
pnpm -r build
cd ..
```

If `pnpm` isn't on `PATH`, use `corepack pnpm@8.15.0 install` /
`corepack pnpm@8.15.0 -r build` (repo precedent:
`scripts/prepare-root-publish.mjs:9-27` does the same for publishing).

**Verification** — run from a directory **outside** the repo (any CLI
invocation, even `--version`, writes `.claude-flow/policy/state.json` into
the raw cwd — see [[../01_ARCHITECTURE/state-layer]]):

```bash
cd /tmp    # or any scratch dir outside D:\Project\ME\Ruflo
node.exe D:/Project/ME/Ruflo/bin/cli.js --version
# expected: ruflo v3.35.0
```

Confirmed working this session: this exact command, run from a scratch
directory, printed `ruflo v3.35.0` matching the root `package.json` version.
Note this only proves the version fast-path resolved — it exits before
importing anything from `dist/` (`bin/cli.js:120-141`). For a build-content
check, also run `node.exe D:/Project/ME/Ruflo/bin/cli.js doctor` from the
same scratch directory and confirm it reports rather than crashing.

### 2. Running vitest under Node 22

The CLI package's `test` script is `vitest run`
(`v3/@claude-flow/cli/package.json:86`), and `vitest` (`^4.1.0` devDependency)
is present at `v3/@claude-flow/cli/node_modules/vitest/vitest.mjs`. Under
this machine's documented default node (older than 20 per
`docs/fork-maintenance.md`), Vite throws `crypto.getRandomValues is not a
function` — a Node-version symptom, not a broken test. Invoke the binary
directly, bypassing both the package-manager script wrapper and the Git Bash
`node` shim:

```bash
cd "D:/Project/ME/Ruflo/v3/@claude-flow/cli"
node.exe node_modules/vitest/vitest.mjs run src/some/target.test.ts
```

Or, with the explicitly pinned Node 22 binary (needed only if the machine's
active default has regressed below 20 — check with `node.exe --version`
first):

```bash
/c/Users/sitth/AppData/Local/nvm/v22.22.3/node.exe \
  "D:/Project/ME/Ruflo/v3/@claude-flow/cli/node_modules/vitest/vitest.mjs" \
  run src/some/target.test.ts
```

To run the whole package suite instead of one file, drop the trailing path
argument. Root-level `vitest` (via `npm test` at repo root) exercises the
root `v3/__tests__/security/` suite specifically for `npm run test:security`.

**Verification**: vitest's own summary line (`Test Files N passed`, `Tests M
passed`) — a `crypto.getRandomValues is not a function` failure at import
time, before any test body runs, means the active Node version is the
problem, not the test; re-run with the pinned v22.22.3 binary and compare.

### 3. Rebuild after an edit

`dist/` is gitignored and is what actually runs (see
[[../01_ARCHITECTURE/build-and-dist]]) — editing `.ts` under `src/` changes
nothing observable until rebuilt.

```bash
cd "D:/Project/ME/Ruflo/v3/@claude-flow/cli"
node.exe node_modules/typescript/bin/tsc
```

(equivalent to `npm run build` inside that package, invoked directly to
avoid the Git Bash `node` shim issue). If the edit touched a package other
than `@claude-flow/cli` — e.g. `@claude-flow/shared` or `@claude-flow/swarm`
— rebuild that package first, since `@claude-flow/cli` consumes it via
`workspace:*` and TypeScript project references, not a live source link.

**Verification**: re-run the out-of-tree smoke test from step 1
(`node.exe D:/Project/ME/Ruflo/bin/cli.js doctor` from a scratch directory)
and confirm the behavior actually changed — a `--version`-only check will
not catch a broken rebuild, since that path never touches `dist/` beyond
`package.json`.

## Related Code

- `D:/Project/ME/Ruflo/v3/@claude-flow/cli/package.json:84,86` — `build`/`test` scripts
- `D:/Project/ME/Ruflo/v3/@claude-flow/cli/node_modules/vitest/vitest.mjs` — direct vitest entry
- `D:/Project/ME/Ruflo/v3/package.json` — `pnpm -r build`
- `docs/fork-maintenance.md` §3(1),(1a),(1b)

## Related Notes

- [[../01_ARCHITECTURE/build-and-dist]]
- [[../01_ARCHITECTURE/monorepo-layout]]
- [[../01_ARCHITECTURE/state-layer]]
- [[../08_TROUBLESHOOTING/node-version-traps]]
