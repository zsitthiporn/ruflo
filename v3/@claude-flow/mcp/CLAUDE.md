# Claude Code Configuration - Claude Flow V3

> CLI examples below (`node bin/cli.js …`) assume the repo root
> (`D:\Project\ME\Ruflo`) as the working directory — this fork is consumed by
> local path, never via `npx`. See `docs/fork-maintenance.md`.

## Hub-and-Spoke Orchestration

Full doctrine lives in the repo-root `CLAUDE.md`. The short version, which
governs work in this package too:

- The main chat is the **team lead**: single voice to the user, dispatches
  workers, reviews every report, owns the task board, performs merges.
- Workers are isolated subagents that report **to the lead only**. No
  worker-to-worker pipeline unless the lead sanctioned that specific hop.
- There is no auto-initialized swarm, no complexity heuristic that spawns a
  team by reflex, and no consensus round. The lead decides, item by item,
  whether delegating is worth the cost — and often it is not.
- **The MCP server and CLI coordinate; Claude Code's Task tool executes.** An
  MCP call records or advises. It never performs the implementation.

### Workers must not invoke the ruflo CLI

A subagent running `node bin/cli.js …` inside the repo creates nested
state directories and can trigger helper auto-refresh / auto-update, which has
silently corrupted hand-maintained helper files mid-session before (see
"Concurrent-session helper corruption" in the root `CLAUDE.md`). Every CLI
invocation below is **lead-only**.

### Honest status of this server's coordination tools

This package serves the tools below, so the corrections belong here rather than
only by reference. Verified against `@claude-flow/cli` source on this branch:

| Tool / hook | Advertised | Actual |
|-------------|------------|--------|
| `task_create` / `task_status` / `task_list` | persistence in `.swarm/memory.db` | writes `<cwd>/.claude-flow/tasks/store.json`, plain JSON, **no write locking** — so only the lead writes the board, one lead session per workspace |
| `hooks_teammate-idle` | auto-assigns work to an idle teammate | stub returning hardcoded `action: 'waiting'`, `pendingTasks: 0` (#1916 follow-up) |
| `hooks_task-completed` | notifies the lead | `leadNotified` echoes the input flag; no message is delivered. `trainPatterns: true` learning is real |
| `hooks_session-end` | persists session state, returns `statePath` | writes no session state file. The real path is the `session_save` tool |
| `worker-dispatch` | dispatches a background worker | needs a running daemon; with `background: false` it returns `synthetic-completed` **without executing anything**. The daemon-less one-shot is the CLI `daemon trigger -w <worker>` |

Treat these as reporting surfaces, not coordination you can rely on. The lead's
own review is the coordination mechanism.

### 3-Tier Model Routing (ADR-026, ADR-143)

Pick the tier per work item before dispatching. Most delegated items are Tier 2;
reserve Tier 3 for genuine reasoning, architecture, and security judgement.

| Tier | Handler | Latency | Cost | Use Cases |
|------|---------|---------|------|-----------|
| **1** | Deterministic codemod | ~1ms | $0 | Structural transforms with **no LLM**: `var-to-const`, `remove-console`, `add-logging` |
| **2** | Haiku | ~500ms | $0.0002 | Simple tasks, low complexity (<30%) |
| **3** | Sonnet/Opus | 2-5s | $0.003-$0.015 | Complex reasoning, architecture, security (>30%) |

**Routing recommendation (lead-only):**
```bash
node bin/cli.js hooks pre-task --description "[task description]"
```

**When you see these recommendations:**

1. `[CODEMOD_AVAILABLE]` → call the `hooks_codemod` MCP tool (intent + file). It applies the transform deterministically via the TypeScript compiler at $0, no LLM.
   - Deterministic intents (Tier 1): `var-to-const`, `remove-console`, `add-logging`
   - `add-types`, `add-error-handling`, `async-await` need judgement → they route to a model (Tier 2/3), **not** a $0 codemod (see ADR-143)
   - Agent Booster (`agent-booster`) is a fast-apply merge engine for arbitrary LLM-produced edit snippets, not an intent-transform engine — it is **not** the Tier-1 path

2. `[TASK_MODEL_RECOMMENDATION] Use model="X"` → Use that model in Task tool:
```javascript
Task({
  prompt: "...",
  subagent_type: "coder",
  model: "haiku"  // ← USE THE RECOMMENDED MODEL (haiku/sonnet/opus)
})
```

**Benefits:** Tier-1 codemods are $0 and ~1ms (no model call); routing keeps simple edits off Sonnet/Opus.

---

### `swarm init` — capability reference, not a step

`swarm_init` / `swarm init` exists and accepts these topologies. It is **not**
part of the normal workflow here: hub-and-spoke needs no topology record, and
initializing one does not cause any work to happen. Use it only when the user
explicitly asks for swarm state.

**Valid Topologies:**
- `hierarchical` - Queen controls workers directly
- `hierarchical-mesh` - V3 queen + peer communication
- `mesh` - Fully connected peer network
- `ring` - Circular communication pattern
- `star` - Central coordinator with spokes
- `hybrid` - Dynamic topology switching

**Team sizing (applies regardless):** 6-8 concurrent workers is the ceiling,
one clear non-overlapping role each, short gated cycles — dispatch, report,
lead verifies, next.

---

### Dispatching a worker

Decide first whether to delegate at all. A single file, a small edit, a
question, or an exploration whose next step depends on what you just read: do
it inline. Delegate when the work is genuinely separable and the brief costs
less than the task.

When you do delegate, each worker's brief must stand alone — the worker cannot
see this conversation:

```javascript
Task({
  prompt: `<role>.

GROUND TRUTH: <facts the lead already verified>
YOUR TASK: <one bounded objective>
OWNERSHIP: you own <explicit file list>. Nothing else — anything outside it is
a finding to report, not an edit to make.
CAPABILITY BOUNDARY: <read-only? may run tests? never runs the ruflo CLI.>
REPORTING: report to the lead only; never to the user or another worker.
WHAT COUNTS AS PROOF: <file:line, command output, test names>
STOP CONDITIONS: <when to stop and report instead of pressing on>`,
  subagent_type: "coder",
  name: "parser",
  run_in_background: true
})
```

Dispatch items with non-overlapping ownership together so they run concurrently.

### After dispatching

- Keep working on what the lead owns. Do not poll, do not re-check status, do
  not ask whether to check.
- When a report arrives, treat it as a **claim**. Verify anything load-bearing
  against the code before acting on it or repeating it to the user.
- The lead records progress on the board, performs the merge, and is the only
  voice that answers the user.

## 🧠 Learning and Memory Hooks (lead-invoked)

These are **optional, lead-only** commands — never something a worker runs, and
not a mandatory step around every task. Reach for them when prior context would
actually change the approach, or when a hard-won result is worth persisting.

### Useful before starting a task
```bash
# 1. Search memory for relevant patterns from past successes
Bash("node bin/cli.js memory search --query '[task keywords]' --namespace patterns")

# 2. Check if similar task was done before
Bash("node bin/cli.js memory search --query '[task type]' --namespace tasks")

# 3. Load learned optimizations
Bash("node bin/cli.js hooks route --task '[task description]'")
```

### Useful after landing a verified change
```bash
# 1. Store successful pattern for future reference
Bash("node bin/cli.js memory store --namespace patterns --key '[pattern-name]' --value '[what worked]'")

# 2. Train neural patterns on the successful approach
Bash("node bin/cli.js hooks post-edit --file '[main-file]' --train-neural true")

# 3. Record task completion with metrics
Bash("node bin/cli.js hooks post-task --task-id '[id]' --success true --store-results true")

# 4. Trigger optimization worker if performance-related
Bash("node bin/cli.js hooks worker dispatch --trigger optimize")
```

### Continuous Improvement Triggers

| Trigger | Worker | When to Use |
|---------|--------|-------------|
| After major refactor | `optimize` | Performance optimization |
| After adding features | `testgaps` | Find missing test coverage |
| After security changes | `audit` | Security analysis |
| After API changes | `document` | Update documentation |
| Every 5+ file changes | `map` | Update codebase map |
| Complex debugging | `deepdive` | Deep code analysis |

### Worth a memory lookup

Search memory when prior context would change the approach — a feature
resembling one already built, a bug with a plausible past solution, a
refactor with an established pattern. Skip it when it would not.

Store to memory when the result was hard-won and would be expensive to
rediscover: a non-obvious bug's root cause, a performance fix and why it
worked, a vulnerability pattern. Not for routine changes.

### 📋 Worker Selection

Role shapes to reach for **once the lead has decided to delegate**. Not a
mandatory roster — dispatch only what the item needs, often just one worker.

| Work | Typical workers |
|------|-----------------|
| Bug fix | researcher, coder, tester |
| Feature | architect, coder, tester, reviewer |
| Refactor | architect, coder, reviewer |
| Performance | perf-engineer, coder |
| Security | security-architect, auditor |
| Docs | researcher, api-docs |

The lead is the coordinator. Never dispatch a "coordinator" worker.

## 🚨 CRITICAL: BATCHING & FILE MANAGEMENT

**ABSOLUTE RULES**:
1. **NEVER save working files, text/mds and tests to the root folder**
2. ALWAYS organize files in appropriate subdirectories
3. Batch genuinely independent operations into one message so they run
   concurrently — but only when they are independent
4. **USE CLAUDE CODE'S TASK TOOL** for execution; MCP/CLI only coordinates

### ⚡ Batch independent work, sequence dependent work

Put independent calls in one message: parallel reads, non-overlapping searches,
workers with disjoint ownership. Do **not** batch calls where a later one
depends on an earlier one's result — that is how unverified assumptions get
baked in. When in doubt about a dependency, sequence it.

### 📁 File Organization Rules

**NEVER save to root folder. Use these directories:**
- `/src` - Source code files
- `/tests` - Test files
- `/docs` - Documentation and markdown files
- `/config` - Configuration files
- `/scripts` - Utility scripts
- `/examples` - Example code

## Project Config

- **Orchestration**: hub-and-spoke, one lead session per workspace
- **Concurrent workers**: 6-8 ceiling
- **Memory**: hybrid
- **HNSW**: Enabled
- **Neural**: Enabled

## 🚀 V3 CLI Commands (26 Commands, 140+ Subcommands)

### Core Commands

| Command | Subcommands | Description |
|---------|-------------|-------------|
| `init` | 4 | Project initialization with wizard, presets, skills, hooks |
| `agent` | 8 | Agent lifecycle (spawn, list, status, stop, metrics, pool, health, logs) |
| `swarm` | 6 | Multi-agent swarm coordination and orchestration |
| `memory` | 11 | AgentDB memory with HNSW vector search (measured ~1.9x–4.7x vs brute force above crossover) |
| `mcp` | 9 | MCP server management and tool execution |
| `task` | 6 | Task creation, assignment, and lifecycle |
| `session` | 7 | Session state management and persistence |
| `config` | 7 | Configuration management and provider setup |
| `status` | 3 | System status monitoring with watch mode |
| `workflow` | 6 | Workflow execution and template management |
| `hooks` | 17 | Self-learning hooks + 12 background workers |
| `hive-mind` | 6 | Queen-led Byzantine fault-tolerant consensus |

### Advanced Commands

| Command | Subcommands | Description |
|---------|-------------|-------------|
| `daemon` | 5 | Background worker daemon (start, stop, status, trigger, enable) |
| `neural` | 5 | Neural pattern training (train, status, patterns, predict, optimize) |
| `security` | 6 | Security scanning (scan, audit, cve, threats, validate, report) |
| `performance` | 5 | Performance profiling (benchmark, profile, metrics, optimize, report) |
| `providers` | 5 | AI providers (list, add, remove, test, configure) |
| `plugins` | 5 | Plugin management (list, install, uninstall, enable, disable) |
| `deployment` | 5 | Deployment management (deploy, rollback, status, environments, release) |
| `embeddings` | 4 | Vector embeddings (embed, batch, search, init) — agentic-flow ONNX backend (speedup unverified, no benchmark) |
| `claims` | 4 | Claims-based authorization (check, grant, revoke, list) |
| `migrate` | 5 | V2 to V3 migration with rollback support |
| `doctor` | 1 | System diagnostics with health checks |
| `completions` | 4 | Shell completions (bash, zsh, fish, powershell) |

### Quick CLI Examples

```bash
# Initialize project
node bin/cli.js init --wizard

# Start daemon with background workers
node bin/cli.js daemon start

# Spawn an agent
node bin/cli.js agent spawn -t coder --name my-coder

# Initialize swarm
node bin/cli.js swarm init --v3-mode

# Search memory (HNSW-indexed)
node bin/cli.js memory search --query "authentication patterns"

# System diagnostics
node bin/cli.js doctor --fix

# Security scan
node bin/cli.js security scan --depth full

# Performance benchmark
node bin/cli.js performance benchmark --suite all
```

## 🚀 Available Agents (60+ Types)

### Core Development
`coder`, `reviewer`, `tester`, `planner`, `researcher`

### V3 Specialized Agents
`security-architect`, `security-auditor`, `memory-specialist`, `performance-engineer`

### 🔐 @claude-flow/security
CVE remediation, input validation, path security:
- `InputValidator` - Zod validation
- `PathValidator` - Traversal prevention
- `SafeExecutor` - Injection protection

### Swarm Coordination
`hierarchical-coordinator`, `mesh-coordinator`, `adaptive-coordinator`, `collective-intelligence-coordinator`, `swarm-memory-manager`

### Consensus & Distributed
`byzantine-coordinator`, `raft-manager`, `gossip-coordinator`, `consensus-builder`, `crdt-synchronizer`, `quorum-manager`, `security-manager`

### Performance & Optimization
`perf-analyzer`, `performance-benchmarker`, `task-orchestrator`, `memory-coordinator`, `smart-agent`

### GitHub & Repository
`github-modes`, `pr-manager`, `code-review-swarm`, `issue-tracker`, `release-manager`, `workflow-automation`, `project-board-sync`, `repo-architect`, `multi-repo-swarm`

### SPARC Methodology
`sparc-coord`, `sparc-coder`, `specification`, `pseudocode`, `architecture`, `refinement`

### Specialized Development
`backend-dev`, `mobile-dev`, `ml-developer`, `cicd-engineer`, `api-docs`, `system-architect`, `code-analyzer`, `base-template-generator`

### Testing & Validation
`tdd-london-swarm`, `production-validator`

## 🪝 V3 Hooks System (27 Hooks + 12 Workers)

### All Available Hooks

| Hook | Description | Key Options |
|------|-------------|-------------|
| `pre-edit` | Get context before editing files | `--file`, `--operation` |
| `post-edit` | Record editing outcome for learning | `--file`, `--success`, `--train-neural` |
| `pre-command` | Assess risk before commands | `--command`, `--validate-safety` |
| `post-command` | Record command execution outcome | `--command`, `--track-metrics` |
| `pre-task` | Record task start, get agent suggestions | `--description`, `--coordinate-swarm` |
| `post-task` | Record task completion for learning | `--task-id`, `--success`, `--store-results` |
| `session-start` | Start/restore session (v2 compat) | `--session-id`, `--auto-configure` |
| `session-end` | End session, stop daemon, print a summary — **does not write a session state file** despite the name; use the `session_save` tool for that | `--generate-summary`, `--export-metrics` |
| `session-restore` | Restore a previous session | `--session-id`, `--latest` |
| `route` | Route task to optimal agent | `--task`, `--context`, `--top-k` |
| `route-task` | (v2 compat) Alias for route | `--task`, `--auto-swarm` |
| `explain` | Explain routing decision | `--topic`, `--detailed` |
| `pretrain` | Bootstrap intelligence from repo | `--model-type`, `--epochs` |
| `build-agents` | Generate optimized agent configs | `--agent-types`, `--focus` |
| `metrics` | View learning metrics dashboard | `--v3-dashboard`, `--format` |
| `transfer` | Transfer patterns via IPFS registry | `store`, `from-project` |
| `list` | List all registered hooks | `--format` |
| `intelligence` | RuVector intelligence system | `trajectory-*`, `pattern-*`, `stats` |
| `worker` | Background worker management | `list`, `dispatch`, `status`, `detect` |
| `progress` | Check V3 implementation progress | `--detailed`, `--format` |
| `statusline` | Generate dynamic statusline | `--json`, `--compact`, `--no-color` |
| `coverage-route` | Route based on test coverage gaps | `--task`, `--path` |
| `coverage-suggest` | Suggest coverage improvements | `--path` |
| `coverage-gaps` | List coverage gaps with priorities | `--format`, `--limit` |
| `pre-bash` | (v2 compat) Alias for pre-command | Same as pre-command |
| `post-bash` | (v2 compat) Alias for post-command | Same as post-command |

### 12 Background Workers

| Worker | Priority | Description |
|--------|----------|-------------|
| `ultralearn` | normal | Deep knowledge acquisition |
| `optimize` | high | Performance optimization |
| `consolidate` | low | Memory consolidation |
| `predict` | normal | Predictive preloading |
| `audit` | critical | Security analysis |
| `map` | normal | Codebase mapping |
| `preload` | low | Resource preloading |
| `deepdive` | normal | Deep code analysis |
| `document` | normal | Auto-documentation |
| `refactor` | normal | Refactoring suggestions |
| `benchmark` | normal | Performance benchmarking |
| `testgaps` | normal | Test coverage analysis |

### Essential Hook Commands

```bash
# Core hooks
node bin/cli.js hooks pre-task --description "[task]"
node bin/cli.js hooks post-task --task-id "[id]" --success true
node bin/cli.js hooks post-edit --file "[file]" --train-neural true

# Session management
node bin/cli.js hooks session-start --session-id "[id]"
node bin/cli.js hooks session-end --export-metrics true
node bin/cli.js hooks session-restore --session-id "[id]"

# Intelligence routing
node bin/cli.js hooks route --task "[task]"
node bin/cli.js hooks explain --topic "[topic]"

# Neural learning
node bin/cli.js hooks pretrain --model-type moe --epochs 10
node bin/cli.js hooks build-agents --agent-types coder,tester

# Background workers
node bin/cli.js hooks worker list
node bin/cli.js hooks worker dispatch --trigger audit
node bin/cli.js hooks worker status

# Coverage-aware routing
node bin/cli.js hooks coverage-gaps --format table
node bin/cli.js hooks coverage-route --task "[task]"

# Statusline (for Claude Code integration)
node bin/cli.js hooks statusline
node bin/cli.js hooks statusline --json
```

## 🔄 Migration (V2 to V3)

```bash
# Check migration status
node bin/cli.js migrate status

# Run migration with backup
node bin/cli.js migrate run --backup

# Rollback if needed
node bin/cli.js migrate rollback

# Validate migration
node bin/cli.js migrate validate
```

## 🧠 Intelligence System (RuVector)

V3 includes the RuVector Intelligence System (measured numbers: see [audit](../../../docs/reviews/intelligence-system-audit-2026-05-29.md) + [`scripts/benchmark-intelligence.mjs`](../../../scripts/benchmark-intelligence.mjs)):
- **SONA**: Self-Optimizing Neural Architecture (measured 0.0043ms/adapt, target <0.05ms met)
- **MoE**: Mixture of Experts for specialized routing (gate converges — confidence 0.13→0.88 after rewards)
- **HNSW**: measured ~1.9x at N=20k, ~3.2x–4.7x at N=5k vs brute force (recall@10 ~0.99); ANN wins above the crossover, ruvector NAPI backend
- **EWC++**: Elastic Weight Consolidation (prevents forgetting)
- **Flash Attention**: integration available; speedup dropped from docs pending an in-tree benchmark (was: 2.49x–7.47x, inherited unverified from upstream — removed to avoid a credibility claim we can't reproduce)

The 4-step intelligence pipeline:
1. **RETRIEVE** - Fetch relevant patterns via HNSW
2. **JUDGE** - Evaluate with verdicts (success/failure)
3. **DISTILL** - Extract key learnings via LoRA
4. **CONSOLIDATE** - Prevent catastrophic forgetting via EWC++

## 📦 Embeddings Package (v3.0.0-alpha.12)

Features:
- **sql.js**: Cross-platform SQLite persistent cache (WASM, no native compilation)
- **Document chunking**: Configurable overlap and size
- **Normalization**: L2, L1, min-max, z-score
- **Hyperbolic embeddings**: Poincaré ball model for hierarchical data
- **agentic-flow ONNX integration**: speedup unverified (no benchmark; backend reported `onnx`, model all-MiniLM-L6-v2, 384-dim)
- **Neural substrate**: Integration with RuVector

## 🐝 Hive-Mind Consensus

Capability reference for the `hive-mind` tools and command. **Not a default
here** — hub-and-spoke has one lead and needs no consensus round. Use only on
explicit user request.

### Topologies
- `hierarchical` - Queen controls workers directly
- `mesh` - Fully connected peer network
- `hierarchical-mesh` - Hybrid (recommended)
- `adaptive` - Dynamic based on load

### Consensus Strategies
- `byzantine` - BFT (tolerates f < n/3 faulty)
- `raft` - Leader-based (tolerates f < n/2)
- `gossip` - Epidemic for eventual consistency
- `crdt` - Conflict-free replicated data types
- `quorum` - Configurable quorum-based

## V3 Performance Targets

> Source of truth: [`docs/reviews/intelligence-system-audit-2026-05-29.md`](../../../docs/reviews/intelligence-system-audit-2026-05-29.md) + [`scripts/benchmark-intelligence.mjs`](../../../scripts/benchmark-intelligence.mjs). Numbers below are measured unless marked "target/unverified".

| Metric | Measured / Target | Status |
|--------|-------------------|--------|
| HNSW Search | ~1.9x at N=20k, ~3.2x–4.7x at N=5k vs brute force (recall@10 ~0.99) | **Measured** (ruvector NAPI; 150x-12,500x NOT reproduced) |
| Int8 Quantization | 3.84x compression, reconstruction cosine 0.99999 | **Measured** |
| RaBitQ Quantization | 32x compression, 0.60ms/query | **Measured** |
| SONA Adaptation | 0.0043ms/adapt (target <0.05ms met) | **Measured** |
| Flash Attention | integration available; measured speedup pending benchmark | **Not measured** — prior "2.49x–7.47x" figure was inherited from upstream marketing, never reproduced in-tree |
| MCP Response | <100ms | target |
| CLI Startup | <500ms | target |

## 📊 Performance Optimization Protocol

### Performance Tracking (lead-invoked)
```bash
# Track metrics for an operation worth measuring — not a reflex after every call
Bash("node bin/cli.js hooks post-command --command '[operation]' --track-metrics true")

# Periodically run benchmarks (every major feature)
Bash("node bin/cli.js performance benchmark --suite all")

# Analyze bottlenecks when performance degrades
Bash("node bin/cli.js performance profile --target '[component]'")
```

### Session Persistence (Cross-Conversation Learning)
```bash
# At session start - restore previous context
Bash("node bin/cli.js session restore --latest")

# At session end - summary + metrics. NOTE: session-end does NOT write a
# session state file despite its flags. To actually persist session state,
# use the `session_save` MCP tool.
Bash("node bin/cli.js hooks session-end --generate-summary true --export-metrics true")
```

### Neural Pattern Training
```bash
# Train on successful code patterns
Bash("node bin/cli.js neural train --pattern-type coordination --epochs 10")

# Predict optimal approach for new tasks
Bash("node bin/cli.js neural predict --input '[task description]'")

# View learned patterns
Bash("node bin/cli.js neural patterns --list")
```

## 🔧 Environment Variables

```bash
# Configuration
CLAUDE_FLOW_CONFIG=./claude-flow.config.json
CLAUDE_FLOW_LOG_LEVEL=info

# Provider API Keys
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=...

# MCP Server
CLAUDE_FLOW_MCP_PORT=3000
CLAUDE_FLOW_MCP_HOST=localhost
CLAUDE_FLOW_MCP_TRANSPORT=stdio

# Memory
CLAUDE_FLOW_MEMORY_BACKEND=hybrid
CLAUDE_FLOW_MEMORY_PATH=./data/memory
```

## 🔍 Doctor Health Checks

Run `node bin/cli.js doctor` to check:
- Node.js version (20+)
- npm version (9+)
- Git installation
- Config file validity
- Daemon status
- Memory database
- API keys
- MCP servers
- Disk space
- TypeScript installation

## 🚀 Quick Setup

```bash
# Add MCP servers (auto-detects MCP mode when stdin is piped)
# This fork — absolute path, per docs/fork-maintenance.md §3.2. `ruflo init`
# must never be run against this fork's MCP entry; it writes the registry
# `npx -y ruflo@latest` form instead.
claude mcp add claude-flow -- node D:/Project/ME/Ruflo/bin/cli.js mcp start
claude mcp add ruv-swarm -- npx -y ruv-swarm mcp start  # Optional, third-party package
claude mcp add flow-nexus -- npx -y flow-nexus@latest mcp start  # Optional, third-party package

# Start daemon
node bin/cli.js daemon start

# Run doctor
node bin/cli.js doctor --fix
```

## 🎯 Claude Code vs CLI Tools

### Claude Code Handles ALL EXECUTION:
- **Task tool**: Spawn and run agents concurrently
- File operations (Read, Write, Edit, MultiEdit, Glob, Grep)
- Code generation and programming
- Bash commands and system operations
- TodoWrite and task management
- Git operations

### CLI Tools Handle Coordination (via Bash):
- **Swarm init**: `node bin/cli.js swarm init --topology <type>`
- **Swarm status**: `node bin/cli.js swarm status`
- **Agent spawn**: `node bin/cli.js agent spawn -t <type> --name <name>`
- **Memory store**: `node bin/cli.js memory store --key "mykey" --value "myvalue" --namespace patterns`
- **Memory search**: `node bin/cli.js memory search --query "search terms"`
- **Memory list**: `node bin/cli.js memory list --namespace patterns`
- **Memory retrieve**: `node bin/cli.js memory retrieve --key "mykey" --namespace patterns`
- **Hooks**: `node bin/cli.js hooks <hook-name> [options]`

**This split is the load-bearing principle of this fork.** An MCP or CLI call
records or advises; it never edits a file, runs a test, or lands a change. If a
tool result claims work was performed, that is a bookkeeping entry, not
evidence — verify against the code. All the commands above are **lead-only**;
workers must not invoke the ruflo CLI.

## 📝 Memory Commands Reference (IMPORTANT)

### Store Data (ALL options shown)
```bash
# REQUIRED: --key and --value
# OPTIONAL: --namespace (default: "default"), --ttl, --tags
node bin/cli.js memory store --key "pattern-auth" --value "JWT with refresh tokens" --namespace patterns
node bin/cli.js memory store --key "bug-fix-123" --value "Fixed null check" --namespace solutions --tags "bugfix,auth"
```

### Search Data (semantic vector search)
```bash
# REQUIRED: --query (full flag, not -q)
# OPTIONAL: --namespace, --limit, --threshold
node bin/cli.js memory search --query "authentication patterns"
node bin/cli.js memory search --query "error handling" --namespace patterns --limit 5
```

### List Entries
```bash
# OPTIONAL: --namespace, --limit
node bin/cli.js memory list
node bin/cli.js memory list --namespace patterns --limit 10
```

### Retrieve Specific Entry
```bash
# REQUIRED: --key
# OPTIONAL: --namespace (default: "default")
node bin/cli.js memory retrieve --key "pattern-auth"
node bin/cli.js memory retrieve --key "pattern-auth" --namespace patterns
```

### Initialize Memory Database
```bash
node bin/cli.js memory init --force --verbose
```

**KEY**: CLI coordinates the strategy via Bash, Claude Code's Task tool executes with real agents.

## Support

- Documentation: https://github.com/ruvnet/claude-flow
- Issues: https://github.com/ruvnet/claude-flow/issues

---

Remember: **Claude Flow CLI coordinates, Claude Code Task tool creates!**

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.
Never save working files, text/mds and tests to the root folder.

## Orchestration Rules

See "Hub-and-Spoke Orchestration" at the top of this file, and the full
doctrine in the repo-root `CLAUDE.md`. Deliberately not repeated here — three
copies drift, which is how this file ended up contradicting the rest of the
repo in the first place.
