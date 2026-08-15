---
title: Ruflo System Context
summary: Workspace-level context for AI agents and engineers working in the Ruflo fork.
tags: [system-context, onboarding, architecture, fork, hub-and-spoke]
domain: system-context
service: Ruflo
status: active
last_reviewed: 2026-08-15
related: [AGENTS, INDEX, 00_INDEX/knowledge-index, 02_ORCHESTRATION/team-style-goal, 02_ORCHESTRATION/hub-and-spoke-doctrine, 01_ARCHITECTURE/monorepo-layout]
rag_include: true
retrieval_priority: normal
audience: [agent, human]
sensitivity: public
source_of_truth: true
aliases: [Ruflo workspace, Ruflo Knowledge, claude-flow fork, ruvnet/ruflo fork]
aliases_th: [ระบบ Ruflo, โปรเจกต์ Ruflo, คลังความรู้ Ruflo]
task_types: [workspace-orientation]
---

# Ruflo System Context

## Summary

Workspace-level context for AI agents and engineers working in the Ruflo fork: what this repo is, how the team style works, where the packages live, and where the rest of the knowledge vault picks up.

## Key Terms

| Term | Meaning |
| --- | --- |
| Domain | system-context |
| Related system | Ruflo |
| `Ruflo` | Fork name — the public release train (`@claude-flow/cli`, `claude-flow`, `ruflo`) |
| `hub-and-spoke` | This fork's orchestration model — one lead, isolated workers |
| `fork's own build` | `node bin/cli.js …`, never `npx ruflo@latest` |

## Main Content

### Workspace Root

```text
D:\Project\ME\Ruflo
```

### Knowledge Vault

```text
D:\Project\ME\Ruflo\Ruflo-Knowledge
```

### What This Fork Is

- A personal fork of `ruvnet/ruflo` (upstream `github.com/ruvnet/claude-flow` lineage), maintained as `zsitthiporn/ruflo`.
- Adapted from upstream's swarm-by-reflex doctrine into a **hub-and-spoke agent-team system**: the main chat session is the team lead — single voice to the user, dispatches isolated workers, reviews every report, owns the task board, performs all merges. Workers report to the lead only.
- The house playbook for this model is the user-level `team-lead` skill.
- **The repo is PUBLIC on GitHub** (`zsitthiporn/ruflo`). Nothing sensitive belongs in this vault or in code: no keys, tokens, or private data. Machine paths like `C:\Users\sitth\...` are acceptable — they already appear in the repo's own committed docs.

### The Fork Runs Its Own Build

- CLI examples in this vault and in the repo's `CLAUDE.md` read `node bin/cli.js …` and assume the repo root as the working directory — deliberately not `npx ruflo@latest` / `npx claude-flow@latest`, which fetch the upstream registry build rather than this fork's source.
- One confirmed shell trap: in **Git Bash** the `node` shim fails with `stdin is not a tty` — use `node.exe bin/cli.js …` there. **PowerShell** (the primary shell on this machine) and `cmd` run `node bin/cli.js …` fine. See [[08_TROUBLESHOOTING/git-bash-tty-shim]].

### Team Style, In One Paragraph

The main chat is the lead: it triages, decomposes, dispatches non-overlapping work to isolated subagent workers, reviews every report as a claim (not a verified result), and is the only writer of the task board and shared manifests. A coordination call (CLI or MCP) records or advises work — it never performs the implementation; Claude Code's Task tool and its file/Bash tools do the actual execution. See [[02_ORCHESTRATION/team-style-goal]] for the fork's stated goal and rollout, and [[02_ORCHESTRATION/hub-and-spoke-doctrine]] for the operating rules that follow from it.

### Repo Layout At A Glance

| Package | Path | Purpose |
| --- | --- | --- |
| `@claude-flow/cli` | `v3/@claude-flow/cli/` | CLI entry point (public release package) |
| `@claude-flow/codex` | `v3/@claude-flow/codex/` | Dual-mode Claude + Codex collaboration |
| `@claude-flow/guidance` | `v3/@claude-flow/guidance/` | Governance control plane |
| `@claude-flow/hooks` | `v3/@claude-flow/hooks/` | Hooks + background workers |
| `@claude-flow/memory` | `v3/@claude-flow/memory/` | AgentDB + HNSW search |
| `@claude-flow/security` | `v3/@claude-flow/security/` | Input validation, CVE remediation |
| `claude-flow` (root) | repo root | Umbrella publish package |
| `ruflo` | `ruflo/` | Thin wrapper users actually run via `npx ruflo` |

The normal public release train is exactly three packages: `@claude-flow/cli`, `claude-flow`, and `ruflo`. Everything else under `v3/@claude-flow/*` is an internal component, bundled rather than published standalone. Full detail: [[01_ARCHITECTURE/monorepo-layout]].

### Where Knowledge Lives

- Route through [[00_INDEX/task-entrypoints]] first for any recurring or unclear task.
- Full topic listing by folder: [[00_INDEX/knowledge-index]].
- Keyword and Thai-alias lookup: [[00_INDEX/retrieval-keyword-index]].
- Symptom to note: [[00_INDEX/troubleshooting-index]].
- Minimal agent bootstrap: [[11_AI/agent-start]].
- Note authoring rules: [[12_STANDARDS/markdown-note-standard]].

## Related Code

- `D:/Project/ME/Ruflo/AGENTS.md`
- `D:/Project/ME/Ruflo/CLAUDE.md`
- `D:/Project/ME/Ruflo/bin/cli.js`
- `D:/Project/ME/Ruflo/v3/@claude-flow`

## Related Notes

- [[AGENTS]]
- [[INDEX]]
- [[00_INDEX/knowledge-index]]
- [[00_INDEX/task-entrypoints]]
- [[02_ORCHESTRATION/team-style-goal]]
- [[02_ORCHESTRATION/hub-and-spoke-doctrine]]
- [[01_ARCHITECTURE/monorepo-layout]]
- [[11_AI/agent-start]]
