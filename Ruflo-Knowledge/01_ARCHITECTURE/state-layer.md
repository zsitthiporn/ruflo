---
title: State Layer
summary: The verified on-disk state paths (tasks, sessions, memory), per-project isolation via CLAUDE_FLOW_CWD/CLAUDE_FLOW_MEMORY_PATH, and the no-write-locking fact that forces lead-only board writes.
tags: [architecture, state, persistence, task-store, memory, concurrency]
domain: architecture
service: Ruflo
status: active
last_reviewed: 2026-08-16
related: [monorepo-layout, cli-and-mcp-surface]
rag_include: true
retrieval_priority: high
audience: [agent, human]
sensitivity: public
source_of_truth: true
aliases: [state layer, memory backend, AgentDB, task store persistence, CLAUDE_FLOW_CWD, CLAUDE_FLOW_MEMORY_PATH, .swarm, .claude-flow, cross-project pattern bleed, neural store scope]
aliases_th: [state layer, ที่เก็บ task, memory path]
task_types: [architecture-reference, debugging, concurrency]
note_role: focused
routing_intents: [find-state-path, debug-lost-writes, understand-per-project-isolation]
---

# State Layer

## Summary

State is **plain JSON on disk**, not a database, and it is **not
write-locked**. Tasks, sessions, and agent records live under
`<projectCwd>/.claude-flow/`; the memory backend defaults to
`<cwd>/.swarm/memory.db` unless pinned. `projectCwd` resolves from
`CLAUDE_FLOW_CWD` (falling back to `process.cwd()`); `CLAUDE_FLOW_MEMORY_PATH`
separately pins the memory root. A handful of ancillary files ignore both
pins and always follow the raw working directory. Concurrent writers lose
data silently — confirmed by execution, not inferred — which is why this
fork's doctrine restricts board writes to a single lead session.

## Key Terms

| Term | Meaning |
| --- | --- |
| `getProjectCwd()` | `cli-core/src/mcp-tools/types.ts:28-34` — `CLAUDE_FLOW_CWD` env (if set, and not `/` or `$HOME`) else `process.cwd()` |
| `<projectCwd>/.claude-flow/tasks/store.json` | Task board persistence — plain JSON, **not** `.swarm/memory.db` |
| `<projectCwd>/.claude-flow/sessions/*.json` | Session records, one file per session id |
| `<projectCwd>/.claude-flow/agents/store.json` | Agent registry records |
| `getMemoryRoot()` | `memory-initializer.ts:89-113` — precedence: `CLAUDE_FLOW_MEMORY_PATH` env → `memory.persistPath`/`memory.path` config → default `cwd/.swarm` |
| Ancillary files | Files that follow **raw cwd** regardless of either pin: `.claude-flow/policy/state.json`, `proven-config.json`, `ruvector.db`, a stale init-time `.claude/memory.db` |

## Main Content

### Where state actually lives — verified against the handlers, not the tool descriptions

Every MCP tool's `.description` string used to claim persistence "in the
`.swarm/memory.db`". That claim is false and, as of this session, the
description text itself has already been corrected in code — e.g.
`task-tools.ts`'s tool descriptions now read *"persisted to
`<cwd>/.claude-flow/tasks/store.json` (a plain JSON file, not the
`.swarm/memory.db`)"* verbatim (`task-tools.ts:85,151,209,271,336,391,489`).

The actual write paths, read directly from source:

- **Tasks**: `task-tools.ts:13-15` — `STORAGE_DIR = '.claude-flow'`,
  `TASK_FILE = 'store.json'`, joined via `getProjectCwd()`.
- **Sessions**: `session-tools.ts:18-19,40,46` — `STORAGE_DIR =
  '.claude-flow'`, `SESSION_DIR = 'sessions'`, one `<id>.json` file per
  session; `session-tools.ts` also reads/writes `memory/store.json`,
  `tasks/store.json`, and `agents/store.json` directly as part of
  `session_save`/`session_restore` (lines 112,121,130,254-288) — session
  round-trips snapshot all three stores into (and back out of) the session
  file.
- **Memory** (default backend): `memory-initializer.ts:89-113`. Precedence,
  highest to lowest: (1) `CLAUDE_FLOW_MEMORY_PATH` env var, (2)
  `memory.persistPath`/`memory.path` in `claude-flow.config.json`, (3)
  default `cwd/.swarm`. **`.swarm/memory.db` is real** — it is the default
  memory database file, distinct from and unrelated to the false claim about
  where the *task* store lives. Do not over-correct to "nothing uses
  `.swarm`"; the task/session/agent stores use `.claude-flow/`, the memory
  backend (when unpinned) uses `.swarm/`.

### `getProjectCwd()` — the pin that makes per-project isolation work

```ts
// v3/@claude-flow/cli-core/src/mcp-tools/types.ts:28-34
export function getProjectCwd(): string {
  const envCwd = process.env.CLAUDE_FLOW_CWD;
  if (envCwd && envCwd !== '/' && envCwd !== process.env.HOME) {
    return envCwd;
  }
  return process.cwd();
}
```

`@claude-flow/cli`'s own `mcp-tools/types.ts` re-exports this verbatim from
`@claude-flow/cli-core` (see [[monorepo-layout]]) — every tool file that
touches state imports the same function.

**Verified by execution, 2026-08-13** (`docs/fork-maintenance.md`): with both
`CLAUDE_FLOW_CWD` and `CLAUDE_FLOW_MEMORY_PATH` pinned to a workspace root,
the task store, session files, and memory database all land under that
pinned root even when the CLI is invoked from a different working directory
— two scratch roots produced entirely separate stores, each readable back
from a third directory. The feared silent state split does **not** occur for
these three.

What *does* follow the raw working directory regardless of either pin: a set
of ancillary files — `.claude-flow/policy/state.json`, `proven-config.json`,
`ruvector.db`, and a stale init-time `.claude/memory.db` that carries no
stored values. **Any** CLI invocation writes `.claude-flow/policy/state.json`
into the raw cwd — even `--version` — which is why workers must never invoke
the CLI from inside a repo folder (see [[../07_RUNBOOKS/wire-a-consuming-workspace]]
and [[../07_RUNBOOKS/build-and-test-runbook]] for the scratch-dir smoke-test
discipline this forces).

### The failure mode raw-cwd resolution actually produces (#19, fixed 2026-08-16)

Ignoring the pin does not usually surface as a missing file. It surfaces as
state landing **somewhere plausible but shared**, which is far harder to
notice. The neural pattern store is the worked example.

`memory/intelligence.ts:getDataDir()` read raw `process.cwd()`, and when that
directory had no `.claude-flow` it fell back to a single unnamespaced
`~/.claude-flow/neural` — **one blob for every project on the machine**. Under
MCP that fallback was not an edge case but the normal path: the server's cwd
is not the workspace, so the probe failed on every call. Confirmed on disk
before the fix: `<repo>/.claude-flow/neural` had never been created, while
`~/.claude-flow/neural/patterns.json` kept growing across sessions in
unrelated repositories. Patterns distilled from this fork's TypeScript were
being retrieved as routing signal inside other projects, and the reverse.

Three things make this class of bug worth recognising on sight:

1. **It is invisible from the surface.** The SessionStart banner reports
   `[INTELLIGENCE] Loaded N patterns` identically whether that store is
   correctly scoped or globally shared. A rising N reads like healthy
   learning.
2. **An `existsSync` probe is not a substitute for the pin.** A freshly wired
   workspace has no `.claude-flow` yet on its first run — precisely when the
   probe is most wrong. An explicit `CLAUDE_FLOW_CWD` is an instruction, not a
   hint; it should win before the directory exists.
3. **A shared fallback is worse than no fallback.** The fix keeps a home-scoped
   fallback for genuinely project-less invocations but namespaces it per
   workspace (`neural/workspaces/<name>-<8 hex of sha256(root)>`).

Not every `homedir()` root is a bug. `ai-job-dedup`, `global-ai-budget`,
`repo-supervisor`, and `workspace-lease` are deliberately cross-repo (a global
AI budget is the point) and all four honour `RUFLO_AI_BUDGET_DIR`. The test is
whether the data is *workspace knowledge* or *machine-wide policy*.

Still latent, not live: `helpers-generator.ts:1238` and
`.claude/helpers/session.cjs` carry the same shape for session state. They land
project-side in practice only because Claude Code runs hooks with the
workspace as cwd.

### No write locking — the concrete cost of a second writer

**Verified by execution, 2026-08-13**: with a large task store and 16
parallel writers, only 5 writes landed; the 15 that vanished each printed
`[OK] Task created` and exited 0. Realistic board sizes couldn't force this
in testing (CLI startup stagger serializes launches), so treat it as a real
hazard that is merely hard to trigger, not a safe path. This is the concrete
reason the fork's doctrine restricts task-board writes to the lead's session
only — see [[../02_ORCHESTRATION/internal-board-mechanics]] and
[[../02_ORCHESTRATION/hub-and-spoke-doctrine]].

Two adjacent, previously-suspected hazards were checked and ruled out or
narrowed:

- **sql.js lost-update concern (#2621) does not apply here.** Windows
  resolves the native `better-sqlite3` provider with WAL enabled (live
  `-wal`/`-shm` sidecars, header bytes `02 02`) — the earlier suspicion was
  wrong.
- **`session save`/`session restore` genuinely round-trips** across a fresh
  process. `hooks session-end` still writes nothing while reporting a
  `statePath` — use the `session_save` MCP tool for real persistence.

### The daemon used to make this worse — now opt-in

Until fixed 2026-08-14, nearly every command called
`ensureDaemonRunning(process.cwd())`, **ignoring `CLAUDE_FLOW_CWD`** — so a
command run with the pin set still rooted a background daemon at whatever
directory the process happened to be in. This was hit live: `task create` in
a pinned scratch workspace spawned a daemon against the main repo. The
daemon's `consolidate` worker writes memory, so an unrequested daemon was a
second, silent writer against a lock-free store.

Now: daemon autostart is **opt-in**
(`RUFLO_DAEMON_AUTOSTART=1|true|on|yes`, or `daemon.autostart: true` in
`claude-flow.config.json`, config wins over env); `--help`/`-h` start
nothing; the spawn plan stamps one resolved root into argv, `cwd`, and the
child's `CLAUDE_FLOW_CWD` so all three agree by construction.

## Related Code

- `D:/Project/ME/Ruflo/v3/@claude-flow/cli-core/src/mcp-tools/types.ts:24-34` — `getProjectCwd()`
- `D:/Project/ME/Ruflo/v3/@claude-flow/cli/src/mcp-tools/task-tools.ts:13-15,85` — task store path + corrected description
- `D:/Project/ME/Ruflo/v3/@claude-flow/cli/src/mcp-tools/session-tools.ts:18-19,40,46,112-130,254-288` — session store paths, snapshot behavior
- `D:/Project/ME/Ruflo/v3/@claude-flow/cli/src/memory/memory-initializer.ts:89-152` — `getMemoryRoot()` precedence, `resolveDbPath()`
- `docs/fork-maintenance.md` §3 "Consuming-workspace contract" and "Verified by execution, 2026-08-13"

## Related Notes

- [[monorepo-layout]]
- [[cli-and-mcp-surface]]
- [[../02_ORCHESTRATION/internal-board-mechanics]]
- [[../02_ORCHESTRATION/hub-and-spoke-doctrine]]
- [[../07_RUNBOOKS/wire-a-consuming-workspace]]
