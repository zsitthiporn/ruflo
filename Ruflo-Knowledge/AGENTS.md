---
title: Ruflo Knowledge Agent Instructions Pointer
summary: Compatibility pointer to the repo's agent instructions and this vault's authoring rules.
tags: [ai-agent, compatibility, operating-rules]
domain: ai-operations
service: Ruflo
status: active
last_reviewed: 2026-08-15
related: [11_AI/agent-start, 12_STANDARDS/markdown-note-standard]
rag_include: false
retrieval_priority: low
audience: [human]
sensitivity: public
source_of_truth: false
aliases: [agent rules, Claude Code rules, Codex rules]
task_types: [agent-setup]
---

# Ruflo Knowledge Agent Instructions Pointer

## Summary

The repo's own `CLAUDE.md` and `AGENTS.md` at `D:/Project/ME/Ruflo/` are the source of truth for how this fork is operated (hub-and-spoke team model, tool routing, publishing procedure). This vault note only covers how to author knowledge inside `Ruflo-Knowledge`. Knowledge retrieval starts with [[11_AI/agent-start]].

## Key Terms

- `agent instructions`
- `knowledge authoring rules`

## Main Content

Do not duplicate the repo's own operating rules, MCP configuration, or publishing procedure in this vault. Read `D:/Project/ME/Ruflo/CLAUDE.md` and `D:/Project/ME/Ruflo/AGENTS.md` for that. This note covers vault-local authoring rules only:

1. **English-first.** Write canonical note content in English. Keep Thai wording only as `aliases_th` for lookup, per [[12_STANDARDS/markdown-note-standard]].
2. **No secrets.** This repo is public on GitHub (`zsitthiporn/ruflo`). Never put keys, tokens, credentials, or private data in a note — not even redacted-looking placeholders that could be mistaken for real ones in review. Machine paths (`C:\Users\...`, `D:\Project\...`) are fine; they already appear in the repo's committed docs.
3. **Follow `12_STANDARDS`.** Every note uses the frontmatter and section shape defined in [[12_STANDARDS/markdown-note-standard]] — do not improvise a different structure.
4. **Route, don't preload.** Agents should read [[11_AI/agent-start]] first and route once through [[00_INDEX/task-entrypoints]], not preload every index file.

## Related Code

- `D:/Project/ME/Ruflo/CLAUDE.md`
- `D:/Project/ME/Ruflo/AGENTS.md`

## Related Notes

- [[11_AI/agent-start]]
- [[12_STANDARDS/markdown-note-standard]]
- [[00_INDEX/task-entrypoints]]
