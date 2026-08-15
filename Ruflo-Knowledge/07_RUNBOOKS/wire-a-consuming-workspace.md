---
title: Wire A Consuming Workspace
summary: Hand-wire another workspace to consume this fork by absolute local path — .mcp.json entry, env pins, enabledMcpjsonServers, git-exclude guards, and why ruflo init must never be run against it.
tags: [runbook, mcp, consuming-workspace, mcp.json]
domain: runbook
service: Ruflo
status: active
last_reviewed: 2026-08-15
related: [../01_ARCHITECTURE/cli-and-mcp-surface, ../01_ARCHITECTURE/state-layer]
rag_include: true
retrieval_priority: high
audience: [agent, human]
sensitivity: public
source_of_truth: true
aliases: [wire a consuming workspace, npm link, install this fork elsewhere, .mcp.json, enabledMcpjsonServers, never run ruflo init]
aliases_th: [เชื่อม workspace อื่นเข้ากับ fork นี้]
task_types: [runbook, mcp-setup, onboarding]
note_role: focused
routing_intents: [connect-another-repo-to-this-fork, write-mcp-json-entry]
---

# Wire A Consuming Workspace

## Summary

Any workspace other than this repo that wants to use **this fork** — not the
published `ruflo`/`claude-flow` packages, which resolve to upstream — must
satisfy five points from `docs/fork-maintenance.md` §3. The core mistake this
guards against: every generated MCP config in this codebase hardcodes `npx -y
ruflo@latest mcp start`, which is upstream from the registry. The entry must
instead invoke `node` with an absolute path to this fork's `bin/cli.js`.

## Key Terms

| Term | Meaning |
| --- | --- |
| `.mcp.json` | Project-scoped Claude Code MCP server registrations (JSON, not this fork's runtime state) |
| `enabledMcpjsonServers` | `.claude/settings.json` field whitelisting which `.mcp.json` server names are trusted without an approval prompt |
| `CLAUDE_FLOW_CWD` | Env var pinning `getProjectCwd()` — see [[../01_ARCHITECTURE/state-layer]] |
| `CLAUDE_FLOW_MEMORY_PATH` | Env var pinning the memory backend root, independent of `CLAUDE_FLOW_CWD` |
| `ruflo init` | **Never run this in the target workspace** — its generators hardcode `npx -y ruflo@latest` |

## Main Content

### 1. Build the fork first

Both dependency trees must be installed and built — see
[[../01_ARCHITECTURE/build-and-dist]] and
[[../07_RUNBOOKS/build-and-test-runbook]]. There is no supported "install
this fork as a dependency" story; it is consumed by absolute local path
only.

### 2. Hand-write the `.mcp.json` entry — never `ruflo init`

Every generator in this codebase
(`v3/@claude-flow/cli/src/init/mcp-generator.ts:64-77,118-135`) hardcodes
`npx -y ruflo@latest mcp start`, which resolves to the published upstream
package, not this tree — confirmed directly in source this session. Write
the entry by hand in the target workspace's `.mcp.json`:

```json
{
  "mcpServers": {
    "claude-flow": {
      "command": "node",
      "args": ["D:/Project/ME/Ruflo/bin/cli.js", "mcp", "start"],
      "env": {
        "CLAUDE_FLOW_CWD": "<absolute path to the target workspace root>",
        "CLAUDE_FLOW_MEMORY_PATH": "<absolute path to the target workspace root>",
        "CLAUDE_FLOW_AUTO_UPDATE": "false",
        "RUFLO_HELPERS_LOCKED": "1"
      }
    }
  }
}
```

The registration key is `claude-flow` (not `ruflo`) deliberately — this
fork's ~166 plugin tool references all use the `mcp__claude-flow__*`
namespace regardless of which binary answers the call
(`mcp-generator.ts:55-63`).

### 3. Enable the server in Claude Code settings

Claude Code will not auto-trust a project `.mcp.json` server without an
explicit allowlist entry. In the target workspace's `.claude/settings.json`:

```json
{
  "enabledMcpjsonServers": ["claude-flow"]
}
```

### 4. Pin both state roots

Set **both** `CLAUDE_FLOW_CWD` and `CLAUDE_FLOW_MEMORY_PATH` to the target
workspace root (shown in the `env` block above) — verified by execution to
correctly isolate the task store, session files, and memory database even
when the CLI is invoked from elsewhere. See
[[../01_ARCHITECTURE/state-layer]] for what this does and does not cover —
several ancillary files (`policy/state.json`, `proven-config.json`,
`ruvector.db`) follow the raw cwd regardless of these pins.

### 5. Set `CLAUDE_FLOW_AUTO_UPDATE=false`, never `npm install` this fork as a dependency

Redundant with the fork's inverted defaults (auto-update is opt-in as of
2026-08-14 — see [[../01_ARCHITECTURE/helper-system]]) but kept as
belt-and-braces. Never add this fork as an npm dependency of the target
workspace; consumption is by absolute path only.

### 6. Add `.git/info/exclude` guards in the target workspace

State directories this fork writes into the target workspace's raw cwd
should never be committed there:

```
# target-workspace/.git/info/exclude
.claude-flow/
.swarm/
ruvector.db
```

(This repo's own `.gitignore` carries the equivalent patterns at
`.gitignore:58,80-81,138,163-164` — mirror them per-workspace via
`.git/info/exclude` rather than a tracked `.gitignore` change, since the
target workspace's `.gitignore` is not this repo's to edit.)

### 7. Workers never invoke the ruflo CLI

A CLI call from inside a repo subdirectory creates nested state directories
inside that git repo and can trigger auto-refresh/auto-update if those env
gates were ever left on. Board writes and CLI coordination go through the
**lead's** MCP session only — see
[[../02_ORCHESTRATION/hub-and-spoke-doctrine]].

### 8. One lead session per workspace

The task store has no write locking (see [[../01_ARCHITECTURE/state-layer]]);
two lead sessions against one workspace is a data-loss configuration, not a
convenience.

## Smoke test

From a scratch directory **outside both** repos:

```bash
node.exe D:/Project/ME/Ruflo/bin/cli.js --version
# expected: ruflo v3.35.0
```

Then, from Claude Code in the target workspace, confirm the `claude-flow`
MCP server connects and a state-writing tool call (e.g. `task_create`) lands
a file under `<target-workspace>/.claude-flow/tasks/store.json` — not under
this repo's own `.claude-flow/`.

## Related Code

- `D:/Project/ME/Ruflo/v3/@claude-flow/cli/src/init/mcp-generator.ts:55-77,118-140` — hardcoded `npx -y ruflo@latest`, registration key rationale
- `D:/Project/ME/Ruflo/.claude/settings.json:281-283` — `enabledMcpjsonServers` example, this repo's own
- `D:/Project/ME/Ruflo/.gitignore:58,80-81,138,163-164` — state-directory exclude patterns
- `docs/fork-maintenance.md` §3 "Consuming-workspace contract"

## Related Notes

- [[../01_ARCHITECTURE/cli-and-mcp-surface]]
- [[../01_ARCHITECTURE/state-layer]]
- [[../01_ARCHITECTURE/helper-system]]
- [[../01_ARCHITECTURE/monorepo-layout]]
- [[../02_ORCHESTRATION/hub-and-spoke-doctrine]]
