---
title: Task Entrypoints
summary: Routing guide for recurring Ruflo workspace requests.
tags: [index, task-entrypoint, workflow, ai-readable]
domain: ai-operations
service: Ruflo
status: active
last_reviewed: 2026-08-15
related: [knowledge-index, troubleshooting-index, retrieval-keyword-index, markdown-note-standard]
rag_include: true
retrieval_priority: high
audience: [agent, human]
sensitivity: public
source_of_truth: true
aliases: [task entrypoint, workflow routing, task router]
aliases_th: [เริ่มงาน, หาความรู้, เลือกโน้ต]
task_types: [routing]
note_role: router
routing_intents: [routing, workflow]
---

# Task Entrypoints

## Summary

Routing guide for recurring Ruflo workspace requests. Match the user's intent to the first note to read — do not load the whole vault.

## Key Terms

| Term | Meaning |
| --- | --- |
| Domain | ai-operations |
| Related system | Ruflo |
| `task entrypoint` | Search keyword |
| `workflow routing` | Search keyword |
| `hub-and-spoke` | Search keyword |
| `troubleshooting` | Search keyword |
| `publishing` | Search keyword |

## Main Content

| User Intent | First Notes To Read |
| --- | --- |
| Understand the workspace | [[../SYSTEM_CONTEXT]], [[../01_ARCHITECTURE/monorepo-layout]] |
| Add or update knowledge | [[../12_STANDARDS/markdown-note-standard]] |
| Act as team lead / understand hub-and-spoke doctrine | [[../02_ORCHESTRATION/hub-and-spoke-doctrine]], [[../02_ORCHESTRATION/team-style-goal]] |
| Write a worker dispatch brief | [[../02_ORCHESTRATION/worker-brief-standard]] |
| Understand what the internal task board actually persists | [[../02_ORCHESTRATION/internal-board-mechanics]] |
| Decide what proof tier a change needs before it lands | [[../02_ORCHESTRATION/verification-tiers]] |
| Check whether a hook or MCP coordination surface does what it claims | [[../11_AI/honest-status-of-coordination-surfaces]] |
| Work on the CLI or MCP tool surface | [[../01_ARCHITECTURE/cli-and-mcp-surface]] |
| Work on the state/persistence layer (task store, memory backend) | [[../01_ARCHITECTURE/state-layer]] |
| Understand the build and dist pipeline | [[../01_ARCHITECTURE/build-and-dist]] |
| Work on the helper system (hook-handler.cjs, intelligence.cjs, signing) | [[../01_ARCHITECTURE/helper-system]] |
| Build and test the repo locally | [[../07_RUNBOOKS/build-and-test-runbook]] |
| Wire this fork into another workspace (link, install, consume) | [[../07_RUNBOOKS/wire-a-consuming-workspace]] |
| Prove a newly wired workspace works and does not leak state | [[../07_RUNBOOKS/verify-a-wired-workspace]] |
| Rebase or merge onto upstream `ruvnet/ruflo` | [[../07_RUNBOOKS/upstream-rebase-runbook]] |
| Sign or rotate the helper signing key | [[../07_RUNBOOKS/helper-signing-runbook]], then [[../05_SECURITY/helper-signing-key]] |
| Publish a package to npm | [[../07_RUNBOOKS/publishing-runbook]] |
| Debug an issue or unexpected behavior | [[troubleshooting-index]] |
| Understand why the fork decouples from the upstream registry | [[../05_SECURITY/registry-decoupling]] |
| Understand what upstream telemetry was removed and why | [[../05_SECURITY/upstream-telemetry-removal]] |
| Understand why a past architectural choice was made | [[knowledge-index]] under `09_DECISIONS`, or search [[retrieval-keyword-index]] |

## Related Code

- `D:/Project/ME/Ruflo`

## Related Notes

- [[knowledge-index]]
- [[troubleshooting-index]]
- [[retrieval-keyword-index]]
- [[../AGENTS]]
- [[../12_STANDARDS/markdown-note-standard]]
- [[../02_ORCHESTRATION/hub-and-spoke-doctrine]]
