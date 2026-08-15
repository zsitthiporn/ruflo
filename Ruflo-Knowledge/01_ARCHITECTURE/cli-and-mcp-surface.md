---
title: CLI And MCP Surface
summary: How v3/@claude-flow/cli's bin/cli.js dispatches between normal CLI mode and MCP stdio mode, how the command registry (commandLoaders) actually loads, and how the MCP tool registry is assembled and authorized.
tags: [architecture, cli, mcp, command-registry, tool-registry]
domain: architecture
service: Ruflo
status: active
last_reviewed: 2026-08-15
related: [monorepo-layout, state-layer, helper-system]
rag_include: true
retrieval_priority: high
audience: [agent, human]
sensitivity: public
source_of_truth: true
aliases: [CLI surface, MCP surface, bin/cli.js, mcp start, commandLoaders, tool registry, mcp-client.ts]
aliases_th: [CLI, MCP server]
task_types: [architecture-reference, cli-development, mcp-development]
note_role: focused
routing_intents: [work-on-cli-commands, work-on-mcp-tools, debug-mcp-start]
---

# CLI And MCP Surface

## Summary

`v3/@claude-flow/cli/bin/cli.js` (the real entry point behind the root proxy
— see [[monorepo-layout]]) branches on stdin/argv into either normal CLI mode
(`dist/src/index.js`, a `CLI` class) or MCP stdio mode
(`dist/src/mcp-client.js`, a hand-rolled JSON-RPC loop). CLI commands are
looked up through a `commandLoaders` map in `src/commands/index.ts`, but that
map's async-import laziness does **not** currently reduce CLI startup time —
its own header comment says so. The MCP tool registry is assembled by
`mcp-client.ts` importing every `mcp-tools/*.ts` module directly; there is no
plugin-discovery step.

## Key Terms

| Term | Meaning |
| --- | --- |
| `isMCPMode` | `bin/cli.js:160-162` — true when stdin is piped, no explicit non-stdio transport, and argv is empty or `mcp [start]` |
| `commandLoaders` | `src/commands/index.ts:24-125` — `Record<string, () => Promise<Command>>` map keyed by command name |
| `mcp-client.ts` | Package module that owns `listMCPTools()`, `callMCPTool()`, `hasTool()` — imported only in MCP mode |
| `policy-runtime.ts` | `authorizeMcpTool` / `classifyMcpTool` — the authorization layer every MCP tool call passes through |
| `--tools` filter | `CLAUDE_FLOW_MCP_TOOLS` env or `--tools`/`--tools=` flag — narrows the advertised `tools/list` result (#2726) |

## Main Content

### Dispatch: `bin/cli.js`'s three fast paths, then one branch

Before any heavy work, `v3/@claude-flow/cli/bin/cli.js` installs a
`console.log`/`console.warn` filter (lines 34-118) that suppresses one
cosmetic AgentDB warning and redirects noisy embedder progress lines to
stderr — necessary because MCP JSON-RPC framing reads **stdout only**, so any
library that `console.log`s progress would corrupt the protocol stream.

Then, in order:

1. **`--version`/`-V` fast path** (lines 120-141): resolves the version
   directly from `package.json` and exits *before* any heavy import. This
   exists because `agentic-flow`/`ruvector` ONNX imports can eagerly download
   a 23 MB model on cold cache, which blocks 60+ seconds and trips MCP's 30 s
   stdio startup timeout (#2256). `--help`/`-h` deliberately do **not** get
   this short-circuit because `<command> --help` needs lazy command loading.
2. **MCP mode detection** (lines 151-162): `isMCPMode` is true when
   `!process.stdin.isTTY`, no explicit non-stdio `--transport`/`-t` flag was
   passed, and either no args were given (auto-detect piped stdin) or the
   args are exactly `mcp` / `mcp start`.
3. **MCP branch** (lines 164-322): imports `../dist/src/mcp-client.js` and
   runs a hand-rolled newline-delimited JSON-RPC loop over stdin/stdout —
   `initialize`, `tools/list`, `tools/call`, `notifications/initialized`,
   `ping`. A 10 MB unbuffered-newline cap protects against a malicious client
   flooding stdin (`audit_1776483149979`). **Verified this session**: a grep
   of `mcp-client.ts`'s imports found no reference to `helper-refresh` or the
   `update/` modules — the piped-stdio branch genuinely never imports the
   auto-update or helper-auto-refresh machinery described in
   [[helper-system]], matching `docs/fork-maintenance.md`'s claim.
4. **Normal CLI branch** (lines 323-338): imports `../dist/src/index.js`,
   instantiates `CLI`, calls `.run()`, and `process.exit(0)`s on success —
   deliberate, because long-running commands (`daemon` foreground, `mcp`,
   `status --watch`) never resolve their promise.

### The command registry — `commandLoaders` is not what it claims

`src/commands/index.ts` defines a `commandLoaders: Record<string,
CommandLoader>` map (lines 24-125) with one dynamic `import()` per command —
`init`, `agent`, `swarm`, `memory`, `mcp`, `task`, `session`, `hooks`,
`neural`, `security`, `metaharness`, `eject`, `auth`, `proxy`, `transport`,
and ~30 more. **The file's own header comment (lines 5-9) contradicts the
inline comment on the map** (line 21 says "commands are only imported when
needed... reduces initial bundle parse time by ~200ms"): the header states
all commands are *also* synchronously imported elsewhere for the `commands`
array and `commandsByCategory` exports, so the async `loadCommand()` path is
only a fallback for `getCommandAsync()` lookups and does **not** actually cut
startup time. Trust the header, not the inline claim, when describing this
to anyone.

Three commands are deliberately **unregistered** in this fork despite their
source files still existing on disk (dead code, left for the lead to delete):
`funnel` (remote promo feed, removed), `advisor` (fed a statusline insight
ticker that no longer exists), `announcements` (wrote to Claude Code's own
global `settings.json`, which this fork never does). `spinner.ts` was deleted
outright rather than merely unregistered, for the same settings.json reason.

### The MCP tool registry — direct imports, no discovery

`mcp-client.ts` builds its tool set by importing every `mcp-tools/*.ts`
module directly and re-exporting an aggregate — `agentTools`, `swarmTools`,
`memoryTools`, `taskTools`, `sessionTools`, `hooksTools`, `hiveMindTools`,
`workflowTools`, `securityTools`, `embeddingsTools`, `claimsTools`,
`policyTools`, `neuralTools`, `performanceTools`, `githubTools`,
`browserTools`, `metaharnessTools`, `testgenTools`, `agenticowTools`,
`agentbbsTools`, `businessPodTools`, `httpFetchTools`, and more — roughly 40
tool-definition files under `src/mcp-tools/`. Every call passes through
`authorizeMcpTool`/`classifyMcpTool` from `services/policy-runtime.ts` before
executing.

`tools/list` responses are filtered through `_filterAdvertisedMcpTools()`
(`bin/cli.js:41-60`, #2726): if `CLAUDE_FLOW_MCP_TOOLS` (or `--tools`) is set
to anything other than `all`, only tools whose name, `category`, or
`name`-prefix matches a configured selector are advertised — added because
some MCP clients place every advertised tool schema into every model
request.

## Related Code

- `D:/Project/ME/Ruflo/v3/@claude-flow/cli/bin/cli.js:34-118` — stdout/stderr filter
- `D:/Project/ME/Ruflo/v3/@claude-flow/cli/bin/cli.js:120-162` — version fast path + MCP mode detection
- `D:/Project/ME/Ruflo/v3/@claude-flow/cli/bin/cli.js:164-338` — MCP branch and CLI branch
- `D:/Project/ME/Ruflo/v3/@claude-flow/cli/src/commands/index.ts:1-125` — `commandLoaders`, header note vs inline claim
- `D:/Project/ME/Ruflo/v3/@claude-flow/cli/src/mcp-client.ts:11-47` — direct `mcp-tools/*.ts` imports
- `D:/Project/ME/Ruflo/v3/@claude-flow/cli/src/mcp-tools/index.ts` — package-level tool re-exports
- `D:/Project/ME/Ruflo/v3/@claude-flow/cli/src/mcp-tools/types.ts:8` — `getProjectCwd()` shim, see [[monorepo-layout]]

## Related Notes

- [[monorepo-layout]]
- [[state-layer]]
- [[helper-system]]
- [[../07_RUNBOOKS/wire-a-consuming-workspace]]
