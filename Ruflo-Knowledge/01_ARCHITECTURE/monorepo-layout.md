---
title: Monorepo Layout
summary: How the Ruflo fork's source tree is organized — root npm workspace vs the v3/ pnpm workspace, the 23 @claude-flow/* packages, the ruflo/ wrapper, and the bin/ entry chain.
tags: [architecture, monorepo, pnpm, npm-workspaces, packages]
domain: architecture
service: Ruflo
status: active
last_reviewed: 2026-08-15
related: [cli-and-mcp-surface, build-and-dist, state-layer]
rag_include: true
retrieval_priority: high
audience: [agent, human]
sensitivity: public
source_of_truth: true
aliases: [monorepo layout, package map, v3/@claude-flow packages, workspace protocol, bin entry chain]
aliases_th: [โครงสร้าง monorepo, แพ็กเกจ v3]
task_types: [architecture-reference, onboarding]
note_role: focused
routing_intents: [understand-workspace-structure, find-a-package]
---

# Monorepo Layout

## Summary

The repo has **two separate dependency trees**, not one. The root is an npm
workspace with only three `v3/@claude-flow/*` packages wired in directly; the
rest of the 23 packages under `v3/@claude-flow/` live in their own **pnpm**
workspace rooted at `v3/`. A thin `ruflo/` package is the third published
artifact (the one most users actually invoke via `npx ruflo`). The CLI entry
point is a two-hop proxy: repo-root `bin/cli.js` → `v3/@claude-flow/cli/bin/cli.js`
→ that package's compiled `dist/`.

## Key Terms

| Term | Meaning |
| --- | --- |
| npm workspace (root) | `package.json:4-8` — only lists `v3/@claude-flow/{codex,plugin-agent-federation,security}` |
| pnpm workspace (`v3/`) | `v3/pnpm-workspace.yaml` — `packages: ["@claude-flow/*"]`, covers all packages under `v3/@claude-flow/` |
| `@claude-flow/cli` | The umbrella CLI package (v3.35.0) — 26 commands, the MCP server, the tool registry |
| `ruflo/` | Thin published wrapper; `npx ruflo` is what most consuming workspaces run |
| `workspace:*` | pnpm protocol used for all intra-`v3/` cross-package deps — see [[../09_DECISIONS/decision-workspace-protocol]] |
| registry decoupling | `@claude-flow/cli`'s `mcp-tools/types.ts` is a byte-shim re-exporting from `@claude-flow/cli-core` — see [[../05_SECURITY/registry-decoupling]] |

## Main Content

### Two dependency trees, two package managers

- **Root** (`D:\Project\ME\Ruflo\package.json`): an **npm** workspace. Its
  `workspaces` array (`package.json:4-8`) lists exactly three packages —
  `v3/@claude-flow/codex`, `v3/@claude-flow/plugin-agent-federation`,
  `v3/@claude-flow/security` — which are also the three entries in its
  `bundleDependencies` (`package.json:205-209`). Everything else the root
  depends on (`@claude-flow/cli-core`, `@claude-flow/mcp`, `@claude-flow/neural`,
  `@claude-flow/shared`, `@claude-flow/memory` as optional) is an **ordinary
  semver dependency**, not a workspace link — those resolve from whatever the
  registry or local `node_modules` provides, which is the open publishing risk
  documented in [[../07_RUNBOOKS/publishing-runbook]].
- **`v3/`** (`v3/package.json`, name `@claude-flow/v3-monorepo`): a separate
  **pnpm** workspace. `v3/pnpm-workspace.yaml` declares `packages:
  ["@claude-flow/*"]`, so every directory under `v3/@claude-flow/` with a
  `package.json` is a member. `v3/package.json`'s own `build` script is
  `pnpm -r build`, which builds every member in dependency order.
- A fresh checkout therefore needs **both** installs: `npm install` at repo
  root, and `pnpm install` inside `v3/`. Skipping either produces confusing
  "module not found" errors that look like broken code rather than a missed
  install step.

### The 23 packages under `v3/@claude-flow/`

Surveyed directly from each package's `package.json` `description` field
(`node.exe` run against `v3/@claude-flow/*/package.json`, this session). Of
the 24 directories under `v3/@claude-flow/`, one (`agents/`) holds YAML agent
definitions, not a package — no `package.json` — leaving 23 real packages.

| Package | Version | Purpose |
| --- | --- | --- |
| `@claude-flow/cli` | 3.35.0 | The CLI entry point — 60+ agents, swarm coordination, MCP server, hooks, vector memory |
| `@claude-flow/cli-core` | 3.7.0-alpha.5 | Lightweight core CLI surface (memory + hooks only), fast cold-start for plugin skills |
| `@claude-flow/mcp` | 3.0.0-alpha.9 | Standalone MCP server — stdio/http/websocket transports, connection pooling, tool registry |
| `@claude-flow/guidance` | 3.0.0-alpha.4 | Governance control plane — compiles, retrieves, enforces, evolves guidance rules |
| `@claude-flow/hooks` | 3.0.0-alpha.7 | Event-driven lifecycle hooks with ReasoningBank learning |
| `@claude-flow/memory` | 3.0.0-alpha.21 | AgentDB unification, HNSW indexing, hybrid SQLite+AgentDB backend |
| `@claude-flow/shared` | 3.0.0-alpha.8 | Common types, events, utilities, core interfaces |
| `@claude-flow/security` | 3.0.0-alpha.14 | CVE fixes, input validation, path security |
| `@claude-flow/neural` | 3.0.0-alpha.9 | SONA adaptive learning, 7 RL algorithms, Flash Attention, MoE, LoRA, EWC++ |
| `@claude-flow/swarm` | 3.0.0-alpha.7 | Standalone swarm coordination — 100+ agents, 4 topologies, hive-mind, consensus |
| `@claude-flow/codex` | 3.0.3 | OpenAI Codex platform adapter (dual-mode Claude + Codex) |
| `@claude-flow/embeddings` | 3.0.0-alpha.18 | Embedding service — OpenAI, Transformers.js, agentic-flow ONNX, mock providers |
| `@claude-flow/providers` | 3.0.0-alpha.6 | Multi-LLM provider system |
| `@claude-flow/deployment` | 3.0.0-alpha.7 | Release management, CI/CD, versioning |
| `@claude-flow/performance` | 3.0.0-alpha.6 | Benchmarking, Flash Attention validation, optimization |
| `@claude-flow/plugins` | 3.0.0-alpha.7 | Unified Plugin SDK — worker, hook, provider integration |
| `@claude-flow/plugin-agent-federation` | 1.0.0-alpha.18 | Cross-installation agent federation, zero-trust, PII-gated audit trails |
| `@claude-flow/plugin-iot-cognitum` | 1.0.0-alpha.5 | IoT Cognitum Seed device-agent bridge |
| `@claude-flow/claims` | 3.0.0-alpha.8 | Issue claiming and work coordination |
| `@claude-flow/aidefence` | 3.0.2 | AI manipulation defense — prompt injection detection |
| `@claude-flow/browser` | 3.0.0-alpha.4 | Browser automation for AI agents |
| `@claude-flow/integration` | 3.0.0 | agentic-flow@alpha deep integration, TokenOptimizer |
| `@claude-flow/testing` | 3.0.0-alpha.6 | TDD London School framework, test utilities, fixtures |

### The `ruflo/` wrapper

`ruflo/package.json` publishes as `ruflo`, `bin: { ruflo: "bin/ruflo.js" }`.
This is the third package in the release train (alongside `@claude-flow/cli`
and the root `claude-flow` umbrella) and the one most install instructions
reference (`npx ruflo@latest`). **This fork is never consumed that way** —
see [[../07_RUNBOOKS/wire-a-consuming-workspace]] for why every generated
`npx ruflo@latest` MCP entry resolves to upstream, not this tree.

### The `bin/` entry chain

```
D:\Project\ME\Ruflo\bin\cli.js                         (repo-root proxy)
  → imports v3/@claude-flow/cli/bin/cli.js              (bin/cli.js:10-11)
      → imports v3/@claude-flow/cli/dist/src/index.js   (normal CLI mode)
      → imports v3/@claude-flow/cli/dist/src/mcp-client.js (piped-stdio MCP mode)
```

The root proxy (`bin/cli.js`, 12 lines) does nothing but resolve the absolute
path to the package's compiled entry and `import()` it — see
[[cli-and-mcp-surface]] for what happens once execution reaches the package's
own `bin/cli.js`. Because the import targets `dist/`, **the fork must be
built before it runs** — see [[build-and-dist]].

### Package decoupling in practice

`v3/@claude-flow/cli/src/mcp-tools/types.ts` is explicitly a "re-export shim
(ADR-100, alpha.5)": `export * from '@claude-flow/cli-core/mcp-tools/types';`.
The type definitions and the `getProjectCwd()` helper that most of the tool
registry depends on actually live in `@claude-flow/cli-core`, not in
`@claude-flow/cli` itself — a concrete example of the registry-decoupling
pattern this fork's packages follow. See
[[../05_SECURITY/registry-decoupling]] for the fuller decision record.

## Related Code

- `D:/Project/ME/Ruflo/package.json:1-214` — root npm workspace, `bundleDependencies`
- `D:/Project/ME/Ruflo/v3/package.json` — v3 pnpm workspace root, `pnpm -r build`
- `D:/Project/ME/Ruflo/v3/pnpm-workspace.yaml` — `packages: ["@claude-flow/*"]`
- `D:/Project/ME/Ruflo/bin/cli.js` — root proxy entry
- `D:/Project/ME/Ruflo/v3/@claude-flow/cli/bin/cli.js` — real entry point
- `D:/Project/ME/Ruflo/v3/@claude-flow/cli/src/mcp-tools/types.ts:8` — cli-core re-export shim
- `D:/Project/ME/Ruflo/ruflo/package.json` — thin published wrapper

## Related Notes

- [[cli-and-mcp-surface]]
- [[build-and-dist]]
- [[state-layer]]
- [[helper-system]]
- [[../07_RUNBOOKS/wire-a-consuming-workspace]]
- [[../07_RUNBOOKS/publishing-runbook]]
- [[../09_DECISIONS/decision-workspace-protocol]]
- [[../05_SECURITY/registry-decoupling]]
