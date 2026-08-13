# Fork Maintenance

This repository is a personal fork of `ruvnet/ruflo`, adapted to a hub-and-spoke
agent-team working style. It is **not** published to npm and is **not** intended to
track upstream's distribution model. The plan lives in GitHub issues #1–#6 on
`zsitthiporn/ruflo`.

This document covers the four things that keep the fork's customizations from
being silently reverted by upstream's own machinery.

---

## 1. Fork identity — decision record

**Problem.** Nothing in the code distinguishes this fork from a stale upstream
install. Two mechanisms make that dangerous:

- **Helper auto-refresh** (`v3/@claude-flow/cli/src/init/helper-refresh.ts`)
  re-copies `hook-handler.cjs`, `intelligence.cjs`, `auto-memory-hook.mjs`, and
  `statusline.cjs` into `.claude/helpers/` from whichever `@claude-flow/cli` is
  resolvable, whenever that package's version stamp is newer. Copies are verified
  against an Ed25519 public key hardcoded in
  `v3/@claude-flow/cli/src/init/helper-signing.ts` — which, until 2026-08-14, was
  **inherited from upstream and never rotated**, so upstream-signed helpers
  verified fine and could overwrite fork-edited ones.

  Precision worth keeping straight: this path makes **no network call**. It is a
  local `copyFileSync` out of a resolved package. The exposure is supply-chain —
  *that package* may have arrived from the registry — not a runtime registry hit.
  Conflating the two sends you looking for network traffic that was never there.
- **Startup auto-update** (`v3/@claude-flow/cli/src/update/index.ts`) is the one
  that genuinely contacts the registry, then runs
  `npm install <pkg>@latest --save-exact` in `process.cwd()`
  (`update/executor.ts:127-140`) on most CLI invocations, for any package it can
  resolve from cwd.
- **Proven-config refresh** (`src/config/proven-config-refresh.ts`, ADR-177) is a
  third member of the same family, found 2026-08-14: it adopts a signed config
  from whichever `@claude-flow/cli` resolves, and originally had no opt-out at
  all — not even a `.LOCKED` equivalent.

**Options considered.**

| Option | What it is | Verdict |
|---|---|---|
| A1 — rename the package | Rename `@claude-flow/cli` to a private scope | **Rejected.** Blast radius across the monorepo's cross-references is large and buys nothing while we consume the fork by absolute path. |
| A2 — rotate the helper signing key | Replace the hardcoded public key with our own pair, so registry-signed helpers fail verification | **Done 2026-08-14.** See below. |
| B — layered guards | `.LOCKED` markers, `CLAUDE_FLOW_AUTO_UPDATE=false`, never install the fork as a dependency | **Adopted 2026-08-13.** Still in force as defence in depth. |

**Decision: B first (2026-08-13), then A2 (2026-08-14).** B alone was judged
sufficient for how we consume the fork — by absolute path, never as an npm
dependency, with Claude Code's `mcp start` taking a piped-stdio branch that
never imports the update or helper-refresh modules. A2 was then done anyway,
because B is a set of markers and env vars: it depends on nobody forgetting.
A2 moves the guarantee into cryptography, which forgets nothing.

### The rotation, and what it changed

The fork previously shipped **upstream's** public key. Since upstream holds the
matching private half, upstream-signed helpers verified as legitimate here and
could overwrite hand-maintained ones — the provenance gate was a gate on someone
else's key.

A fork-owned Ed25519 pair now replaces it (`src/init/helper-signing.ts`). The
private half lives at `~/.ruflo/helpers-signing.key` — outside the repo, never
printed, which is the discipline the 2026-07-14 incident recorded in the root
`CLAUDE.md` exists to enforce. `scripts/sign-helpers.mjs` reads that path by
default, so signing needs no environment setup.

Verified both directions against the re-signed manifest, reading the key from
source rather than `dist/`:

- the manifest **verifies** under the fork key — signing round-trip intact
- the manifest **does not verify** under upstream's key — the isolation is real,
  not asserted

Two consequences worth remembering:

- **`dist/` must be rebuilt** for the new key to be the one used at runtime;
  `scripts/verify-helpers.mjs` deliberately imports the compiled key so it checks
  what a user would actually trust.
- **Back up `~/.ruflo/helpers-signing.key`.** Losing it means re-signing is
  impossible without another rotation. It is not in the repo and not in any
  secret manager.

---

## 2. Guards in place

**The defaults are now inverted in source (2026-08-14): these features are
opt-IN, not opt-out.** A fresh workspace is safe without anyone remembering an
environment variable — which matters, because the markers below only work if
nobody forgets them.

- **Auto-update** no-ops unless `CLAUDE_FLOW_AUTO_UPDATE` is set to a truthy
  value (`1`/`true`/`on`/`yes`). Explicitly running `ruflo update check` still
  works — deliberate: an update the user asked for is not the hazard.
- **Helper auto-refresh** no-ops unless `RUFLO_HELPERS_AUTO_REFRESH` is truthy.
  It returns silently rather than warning, because "not opted in" is the
  expected state here, not an error.
- **Proven-config refresh** is gated the same way.

The older markers remain as defence in depth, behind those gates:

- **`.claude/helpers/.LOCKED`** — predates this work; its existence
  short-circuits the project pass. Do not delete it.
- **`~/.claude/helpers/.LOCKED`** — added 2026-08-13. Auto-refresh runs a
  **second, global pass** over `~/.claude/helpers/` that the project-level
  marker does not cover. That was the open gap.
- **`RUFLO_HELPERS_LOCKED=1`** — env-level equivalent, useful for one-off shells.

Setting `CLAUDE_FLOW_AUTO_UPDATE=false` in consuming workspaces is now
redundant but harmless; leave it as a belt on the braces.

---

## 3. Consuming-workspace contract

Any workspace that wants to use **this fork** (rather than the registry package)
must satisfy all five points. There is no supported local-consumption story
upstream, so these are ours.

1. **Build the fork first.** `dist/` is gitignored; the bin entry points import
   compiled output. Both dependency trees must be installed: `npm install` at the
   repo root (npm workspaces) and `pnpm install` inside `v3/` (separate pnpm
   workspace).
1a. **Use Node 20+ for anything that builds or tests.** This machine's default is
   **v16.20.2**, below what the repo requires, and it fails in ways that look
   like broken code rather than a broken environment: `fetch is not defined` in
   scripts, and `crypto.getRandomValues is not a function` from Vite when running
   the test suite. It blocked two agents in one session, one of which concluded —
   wrongly — that no other Node was installed.

   `nvm list` shows 22.22.3, 22.13.1, and 18.19.0 available. To avoid switching
   the machine-wide version, call the binary directly:
   `/c/Users/sitth/AppData/Local/nvm/v22.22.3/node.exe`, or prepend that
   directory to `PATH` for one command. Vitest then runs normally
   (`node node_modules/vitest/vitest.mjs run <file>`).
1b. **Know the shell trap.** The documented form is `node bin/cli.js …` from the
   repo root. Confirmed on this machine: in **Git Bash** the `node` shim fails
   with `stdin is not a tty` and you must call `node.exe` explicitly.
   **PowerShell** and cmd run `node` fine. This bit an agent that assumed a
   failure here meant the build was broken — it was not.
2. **Hand-write the MCP entry. Never run `ruflo init` in the target workspace.**
   Every generated config hardcodes `npx -y ruflo@latest mcp start`
   (`v3/@claude-flow/cli/src/init/mcp-generator.ts:64-77,118-135`), which resolves
   to **upstream from the registry**, not this fork. The entry should invoke
   `node` with an absolute path to `<repo>/bin/cli.js`.
3. **Pin both state roots.** Set `CLAUDE_FLOW_CWD` **and** `CLAUDE_FLOW_MEMORY_PATH`
   to the workspace root. **Verified by execution (2026-08-13):** with both pinned,
   the task store, session files, and the memory database all land under the pinned
   root even when the CLI is invoked from a different working directory — the feared
   silent state split does not occur for those three. What *does* follow the raw
   working directory is a set of ancillary files: `.claude-flow/policy/state.json`,
   `proven-config.json`, `ruvector.db`, and a stale init-time `.claude/memory.db`
   that does not carry stored values. Note that **any** invocation writes
   `policy/state.json` into the raw cwd — even `--version` — which is the concrete
   reason workers must never run the CLI from inside a repo folder.
4. **Set `CLAUDE_FLOW_AUTO_UPDATE=false`**, and never `npm install` this fork as a
   dependency of the target workspace.
5. **Workers never invoke the ruflo CLI.** A CLI call from inside a repo
   subdirectory creates nested state directories inside that git repo and can
   trigger the two mechanisms in section 1. Board writes go through the lead's MCP
   session only.

### Known-false claims in the shipped surface

Do not trust these; they are documented here so they are not rediscovered:

- Task tool descriptions claim persistence "in the `.swarm/memory.db`". The handler
  writes `<cwd>/.claude-flow/tasks/store.json`
  (`v3/@claude-flow/cli/src/mcp-tools/task-tools.ts:37-43`). **Verified on disk.**
- `hooks session-end` reports a `statePath` it never writes
  (`mcp-tools/hooks-tools.ts:2250-2338`). The real path is the `session_save` tool.
- `hooks teammate-idle` is a stub returning hardcoded values
  (`hooks-tools.ts:5021-5045`); `hooks task-completed`'s `leadNotified` is an echo
  with no delivery mechanism (`:5125`).
- MCP `worker-dispatch` needs a live daemon; with `background:false` it returns
  `synthetic-completed` **without executing anything** (`hooks-tools.ts:4394-4469`).
  The only daemon-less one-shot is the CLI `daemon trigger -w <worker>`.
- The `embeddings chunk --file` flag is declared but never read
  (`src/commands/embeddings.ts:918-923`) — it silently chunks an empty string.
- The CLI's own board **reads** are broken: `task list` renders a blank ID column,
  `task status <id>` prints `Task: undefined`, and `task list --all` reports "No
  tasks found" against a store that demonstrably holds tasks. Persistence is fine;
  only the display path is broken. **Read the board through the MCP tools.**
- `memory init` silently spawns a background daemon (`daemon start --workspace <cwd>`)
  that nobody asked for. Check for and terminate strays after running it.

### Verified by execution, 2026-08-13

A spike ran the built fork against scratch workspaces on this machine. Results that
correct earlier assumptions:

- **Concurrent writes to the task store lose data silently.** With a large store and
  16 parallel writers, 5 writes landed; the 15 that vanished each printed
  `[OK] Task created` and exited 0. At realistic board sizes the loss could not be
  forced — CLI startup stagger serialises launches — so treat this as a real hazard
  that is merely hard to trigger, not as a safe path. **This is why only the lead
  writes the board, and why one workspace gets exactly one lead session.**
- **The sql.js lost-update concern (#2621) does not apply here.** Windows resolves
  the native `better-sqlite3` provider with WAL enabled (live `-wal`/`-shm` sidecars,
  header bytes `02 02`). The earlier suspicion was wrong.
- **`session save` / `session restore` genuinely round-trips** across a fresh process.
  `hooks session-end` still writes nothing while reporting a path — use `session save`.
- **Per-project isolation via `CLAUDE_FLOW_CWD` works**: two scratch roots produced
  entirely separate stores, each readable back from a third directory.

---

## 4. Upstream rebase checklist

Upstream is active. Every rebase or merge can re-open the drift this document
closes. Run through this after each one:

- [ ] `.claude/helpers/.LOCKED` still present, and `~/.claude/helpers/.LOCKED` too.
- [ ] `git diff` on `.claude/helpers/**` is clean — if helpers changed, decide
      deliberately rather than accepting upstream's copies.
- [ ] **`RUFLO_HELPERS_PUBKEY` in `src/init/helper-signing.ts` is still ours.** A
      merge that restores upstream's constant silently re-opens the trust this
      fork closed — and nothing will fail loudly when it does. Diff this
      constant every single time.
- [ ] Hub-and-spoke doctrine in `CLAUDE.md` and
      `v3/@claude-flow/cli/CLAUDE.md` survived the merge — upstream will keep
      reintroducing auto-swarm doctrine.
- [ ] The known-false-claims list above is still accurate; upstream may have fixed
      some, which is good news worth recording here.
- [ ] Rebuild, then smoke-test from **outside** the repo:
      `node <repo>/bin/cli.js --version`.
- [ ] Consuming workspaces still point at the local build, not `npx ruflo@latest`.
