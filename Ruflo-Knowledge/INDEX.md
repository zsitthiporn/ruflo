---
title: Ruflo Knowledge Index
summary: Thin router — which index to use for which kind of request.
tags: [index, onboarding, rag, ai-readable]
domain: knowledge-index
service: Ruflo
status: active
last_reviewed: 2026-08-15
related: [SYSTEM_CONTEXT, AGENTS, README, 00_INDEX/task-entrypoints, 00_INDEX/knowledge-index, 00_INDEX/retrieval-keyword-index, 00_INDEX/troubleshooting-index, 11_AI/agent-start]
rag_include: false
retrieval_priority: low
audience: [human]
sensitivity: public
source_of_truth: false
aliases: [Ruflo knowledge index, human navigation]
task_types: [navigation]
---

# Ruflo Knowledge Index

## Summary

Thin router for the Ruflo knowledge vault. This file only says which index to open next — it does not enumerate notes itself. For the full topic listing use [[00_INDEX/knowledge-index]].

## Key Terms

| Term | Meaning |
| --- | --- |
| Domain | knowledge-index |
| Related system | Ruflo |
| `router` | Search keyword |
| `entrypoint` | Search keyword |
| `navigation` | Search keyword |

## Main Content

### Which Index To Use

| Need | Go To |
| --- | --- |
| Agent knowledge bootstrap (start here as an agent) | [[11_AI/agent-start]] |
| Workspace context — what this fork is, repo layout, where knowledge lives | [[SYSTEM_CONTEXT]] |
| Vault authoring rules pointer | [[AGENTS]] |
| Task-based workflow routing ("for task X, start at note Y") | [[00_INDEX/task-entrypoints]] |
| Full topic listing by folder | [[00_INDEX/knowledge-index]] |
| Keyword and Thai-alias lookup | [[00_INDEX/retrieval-keyword-index]] |
| Symptom-to-note lookup | [[00_INDEX/troubleshooting-index]] |
| Note authoring standard | [[12_STANDARDS/markdown-note-standard]] |
| Honest status of task/hook/MCP coordination surfaces | [[11_AI/honest-status-of-coordination-surfaces]] |

### Directory Map

| Directory | Purpose | Owner |
| --- | --- | --- |
| `00_INDEX` | Navigation, routing, keyword and troubleshooting indexes | this file's author |
| `01_ARCHITECTURE` | Monorepo layout, CLI/MCP surface, state layer, build/dist, helper system | sibling |
| `02_ORCHESTRATION` | Team style, hub-and-spoke doctrine, board mechanics, verification tiers, worker briefs | sibling |
| `05_SECURITY` | Registry decoupling, helper signing key, upstream telemetry removal | sibling |
| `07_RUNBOOKS` | Build/test, wiring a consumer, upstream rebase, helper signing, publishing | sibling |
| `08_TROUBLESHOOTING` | Symptom-root-cause-fix notes for this fork's known traps | sibling |
| `09_DECISIONS` | ADR-style decision records | sibling |
| `11_AI` | AI-agent bootstrap and coordination-surface honesty | this file's author |
| `12_STANDARDS` | Markdown note standard | this file's author |

### Retrieval Hints For AI Agents

- Route once through [[00_INDEX/task-entrypoints]] before loading anything else; do not preload this file, `README.md`, or `00_INDEX/knowledge-index.md`.
- For ambiguous wording or Thai input, normalize through [[00_INDEX/retrieval-keyword-index]].
- For a bug, error, or unexpected behavior, search [[00_INDEX/troubleshooting-index]] first.
- Verify anything about coordination hooks or MCP tools against [[11_AI/honest-status-of-coordination-surfaces]] before trusting a tool's own description of what it does.

## Related Code

- `D:/Project/ME/Ruflo`

## Related Notes

- [[SYSTEM_CONTEXT]]
- [[AGENTS]]
- [[README]]
- [[11_AI/agent-start]]
- [[00_INDEX/task-entrypoints]]
- [[00_INDEX/knowledge-index]]
- [[00_INDEX/retrieval-keyword-index]]
- [[00_INDEX/troubleshooting-index]]
- [[12_STANDARDS/markdown-note-standard]]
