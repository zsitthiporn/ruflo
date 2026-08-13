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

- **Helper auto-refresh** (`v3/@claude-flow/cli/src/init/helper-refresh.ts:222-256`)
  re-copies `hook-handler.cjs`, `intelligence.cjs`, `auto-memory-hook.mjs`, and
  `statusline.cjs` into `.claude/helpers/` from whichever `@claude-flow/cli` is
  resolvable, whenever that package's version stamp is newer. Copies are verified
  against an Ed25519 public key hardcoded at
  `v3/@claude-flow/cli/src/init/helper-signing.ts:18-30` — **inherited from
  upstream and never rotated**, so registry-signed helpers verify fine and
  overwrite fork-edited ones.
- **Startup auto-update** (`v3/@claude-flow/cli/src/update/index.ts:56-114`) runs
  `npm install <pkg>@latest --save-exact` in `process.cwd()`
  (`update/executor.ts:127-140`) on most CLI invocations, for any package it can
  resolve from cwd.

**Options considered.**

| Option | What it is | Verdict |
|---|---|---|
| A1 — rename the package | Rename `@claude-flow/cli` to a private scope | **Rejected.** Blast radius across the monorepo's cross-references is large and buys nothing while we consume the fork by absolute path. |
| A2 — rotate the helper signing key | Replace the hardcoded public key with our own pair, so registry-signed helpers fail verification | **Deferred — needs the owner's decision.** It is a clean, one-constant defense, but it edits security-sensitive code and would break the publish-time signing flow if this fork ever publishes. |
| B — layered guards | `.LOCKED` markers, `CLAUDE_FLOW_AUTO_UPDATE=false`, never install the fork as a dependency | **Adopted now.** Covers the realistic threat model given how we actually consume the fork. |

**Decision (2026-08-13): adopt B now; A2 remains open for the owner.**
Rationale: we invoke the fork by absolute path (`node <repo>/bin/cli.js`), never as
an npm dependency, and Claude Code launches `mcp start` with piped stdio — a branch
in `v3/@claude-flow/cli/bin/cli.js` that never imports the update or helper-refresh
modules at all. The remaining exposure is a human running a CLI subcommand in a
workspace where the registry package happens to be resolvable, which the guards
below close.

---

## 2. Guards in place

- **`.claude/helpers/.LOCKED`** — already present in this repo (predates this work).
  Its mere existence short-circuits helper auto-refresh
  (`helper-refresh.ts:238-240`). Do not delete it.
- **`~/.claude/helpers/.LOCKED`** — added 2026-08-13. Auto-refresh runs a **second,
  global pass** over `~/.claude/helpers/` (`helper-refresh.ts:258-276`), which the
  project-level marker does not cover. This is the gap that was open.
- **`RUFLO_HELPERS_LOCKED=1`** — env-level equivalent (`helper-refresh.ts:326-328`),
  useful for one-off shells.
- **`CLAUDE_FLOW_AUTO_UPDATE=false`** — disables the startup auto-updater
  (`update/rate-limiter.ts:63-79`). Set it in every consuming workspace.

---

## 3. Consuming-workspace contract

Any workspace that wants to use **this fork** (rather than the registry package)
must satisfy all five points. There is no supported local-consumption story
upstream, so these are ours.

1. **Build the fork first.** `dist/` is gitignored; the bin entry points import
   compiled output. Both dependency trees must be installed: `npm install` at the
   repo root (npm workspaces) and `pnpm install` inside `v3/` (separate pnpm
   workspace).
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
- [ ] The signing-key decision (section 1, A2) still holds, or is revisited.
- [ ] Hub-and-spoke doctrine in `CLAUDE.md` and
      `v3/@claude-flow/cli/CLAUDE.md` survived the merge — upstream will keep
      reintroducing auto-swarm doctrine.
- [ ] The known-false-claims list above is still accurate; upstream may have fixed
      some, which is good news worth recording here.
- [ ] Rebuild, then smoke-test from **outside** the repo:
      `node <repo>/bin/cli.js --version`.
- [ ] Consuming workspaces still point at the local build, not `npx ruflo@latest`.
