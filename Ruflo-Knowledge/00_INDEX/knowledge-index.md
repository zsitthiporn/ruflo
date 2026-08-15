---
title: Knowledge Index
summary: Full topic listing by folder for the Ruflo knowledge vault.
tags: [index, semantic-search, onboarding, rag]
domain: knowledge-index
service: Ruflo
status: active
last_reviewed: 2026-08-15
related: [task-entrypoints, retrieval-keyword-index, troubleshooting-index, INDEX, SYSTEM_CONTEXT]
rag_include: false
retrieval_priority: low
audience: [human]
sensitivity: public
source_of_truth: false
aliases: [knowledge index, topic navigation, full listing]
task_types: [navigation]
---

# Knowledge Index

## Summary

Full topic index for the Ruflo knowledge base, organized by folder. Use [[task-entrypoints]] to route by intent instead of browsing this list end to end.

## Key Terms

| Term | Meaning |
| --- | --- |
| Domain | knowledge-index |
| Related system | Ruflo |
| `topic retrieval` | Search keyword |
| `full listing` | Search keyword |
| `folder map` | Search keyword |

## Main Content

### Core Context

- Minimal agent bootstrap: [[../11_AI/agent-start]]
- Workspace overview, fork identity, repo layout: [[../SYSTEM_CONTEXT]]
- Task-based workflow routing: [[task-entrypoints]]
- Keyword and Thai-alias index: [[retrieval-keyword-index]]
- Troubleshooting index: [[troubleshooting-index]]
- Vault authoring rules pointer: [[../AGENTS]]
- Human navigation router: [[../INDEX]]

### 01_ARCHITECTURE

- Monorepo layout (packages, publish train, workspace protocol): [[../01_ARCHITECTURE/monorepo-layout]]
- CLI and MCP tool surface: [[../01_ARCHITECTURE/cli-and-mcp-surface]]
- State/persistence layer (task store, memory backend): [[../01_ARCHITECTURE/state-layer]]
- Build and dist pipeline: [[../01_ARCHITECTURE/build-and-dist]]
- Helper system (hook-handler, intelligence, signing): [[../01_ARCHITECTURE/helper-system]]

### 02_ORCHESTRATION

- Team style goal (why hub-and-spoke, rollout phases): [[../02_ORCHESTRATION/team-style-goal]]
- Hub-and-spoke doctrine (lead vs worker rules): [[../02_ORCHESTRATION/hub-and-spoke-doctrine]]
- Internal board mechanics (what the task board actually persists): [[../02_ORCHESTRATION/internal-board-mechanics]]
- Verification tiers (how much proof a change needs): [[../02_ORCHESTRATION/verification-tiers]]
- Worker brief standard (the seven-section dispatch brief): [[../02_ORCHESTRATION/worker-brief-standard]]

### 05_SECURITY

- Registry decoupling (why the fork never fetches `@latest` from npm at runtime): [[../05_SECURITY/registry-decoupling]]
- Helper signing key (fork-owned Ed25519 key, rotation): [[../05_SECURITY/helper-signing-key]]
- Upstream telemetry removal: [[../05_SECURITY/upstream-telemetry-removal]]

### 07_RUNBOOKS

- Build and test runbook: [[../07_RUNBOOKS/build-and-test-runbook]]
- Wire a consuming workspace: [[../07_RUNBOOKS/wire-a-consuming-workspace]]
- Upstream rebase runbook: [[../07_RUNBOOKS/upstream-rebase-runbook]]
- Helper signing runbook: [[../07_RUNBOOKS/helper-signing-runbook]]
- Publishing runbook: [[../07_RUNBOOKS/publishing-runbook]]

### 08_TROUBLESHOOTING

- Node version traps: [[../08_TROUBLESHOOTING/node-version-traps]]
- Git Bash tty shim (`stdin is not a tty`): [[../08_TROUBLESHOOTING/git-bash-tty-shim]]
- Stray daemon processes: [[../08_TROUBLESHOOTING/stray-daemon-processes]]
- Lockfile / registry substitution: [[../08_TROUBLESHOOTING/lockfile-registry-substitution]]
- Fake session-restore output: [[../08_TROUBLESHOOTING/fake-session-restore-output]]
- Self-matching diagnostics: [[../08_TROUBLESHOOTING/self-matching-diagnostics]]

### 09_DECISIONS

- Workspace protocol decision (`workspace:*` adoption): [[../09_DECISIONS/decision-workspace-protocol]]
- Fork-owned signing key decision: [[../09_DECISIONS/decision-fork-owned-signing-key]]
- Opt-in registry callbacks decision: [[../09_DECISIONS/decision-opt-in-registry-callbacks]]
- Declined features decision: [[../09_DECISIONS/decision-declined-features]]
- Package rename declined decision: [[../09_DECISIONS/decision-package-rename-declined]]

### 11_AI

- Agent bootstrap: [[../11_AI/agent-start]]
- Honest status of coordination surfaces (task tools, hooks, MCP worker-dispatch): [[../11_AI/honest-status-of-coordination-surfaces]]

### 12_STANDARDS

- Markdown note standard: [[../12_STANDARDS/markdown-note-standard]]

## Related Code

- `D:/Project/ME/Ruflo`

## Related Notes

- [[task-entrypoints]]
- [[retrieval-keyword-index]]
- [[troubleshooting-index]]
- [[../INDEX]]
- [[../SYSTEM_CONTEXT]]
- [[../11_AI/agent-start]]
