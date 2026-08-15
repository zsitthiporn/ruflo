---
title: Ruflo Agent Start
summary: Minimal bootstrap for token-efficient Ruflo knowledge routing.
tags: [ai-agent, bootstrap, retrieval]
domain: ai-operations
service: Ruflo
status: active
last_reviewed: 2026-08-15
related: [../00_INDEX/task-entrypoints, honest-status-of-coordination-surfaces]
rag_include: true
retrieval_priority: highest
audience: [agent]
sensitivity: public
source_of_truth: true
aliases: [agent bootstrap, knowledge start]
aliases_th: [เริ่มงาน, ค้นความรู้, ใช้ knowledge]
task_types: [all]
note_role: router
routing_intents: [agent-bootstrap, knowledge-retrieval]
---

# Ruflo Agent Start

## Main Content

1. This repo is public (`zsitthiporn/ruflo`) — even so, never write secrets, tokens, or private data into any note.
2. If the task names a system, file, or error, read its focused note directly. Otherwise route once through [[../00_INDEX/task-entrypoints]].
3. Use [[../00_INDEX/retrieval-keyword-index]] only for aliases and Thai lookups, [[../00_INDEX/troubleshooting-index]] for symptoms and incidents.
4. Load one or two focused notes. Follow `Related Notes` only for a material gap, and verify code contracts against current source — this fork changes fast and a note can go stale.
5. Never preload `README.md`, `INDEX.md`, `00_INDEX/knowledge-index.md`, or any topic map.
6. Before trusting a hook or MCP tool's own description of what it does, check [[honest-status-of-coordination-surfaces]] — several advertise more than they deliver.
7. Coordination calls (CLI or MCP) record or advise; they never perform the implementation. Do not invoke the `ruflo` CLI as a worker — see the repo's own `CLAUDE.md` hub-and-spoke rules.
8. Put reusable findings in the smallest canonical note and route through the indexes, rather than duplicating content.

## Related Code

- `D:/Project/ME/Ruflo/AGENTS.md`
- `D:/Project/ME/Ruflo/CLAUDE.md`

## Related Notes

- [[../00_INDEX/task-entrypoints]]
- [[honest-status-of-coordination-surfaces]]
