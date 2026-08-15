---
title: Markdown Note Standard
summary: Required structure, naming rules, and English-first language policy for Ruflo Knowledge markdown notes.
tags: [standard, markdown, ai-readable, knowledge-management]
domain: standard
service: Ruflo
status: active
last_reviewed: 2026-08-15
related: [../11_AI/agent-start, ../AGENTS]
rag_include: true
retrieval_priority: normal
audience: [agent, human]
sensitivity: public
source_of_truth: true
aliases: [Markdown note standard, knowledge note schema, frontmatter standard]
aliases_th: [มาตรฐาน Markdown, มาตรฐานโน้ตความรู้]
task_types: [knowledge-authoring, standards]
---

# Markdown Note Standard

## Summary

Required structure, naming rules, and English-first language policy for Ruflo Knowledge markdown notes. Adapted from the sibling BIGO-Knowledge vault's standard, with `sensitivity` defaulting to `public` because this repo is public on GitHub.

## Key Terms

| Term | Meaning |
| --- | --- |
| Domain | standard |
| Related system | Ruflo |
| `Markdown note standard` | Search keyword |
| `frontmatter` | Search keyword |
| `required sections` | Search keyword |
| `kebab-case` | Search keyword |

## Main Content

### Language Policy

- Write canonical note content in English by default.
- Preserve Thai lookup wording only in the inline `aliases_th` frontmatter field when it carries business meaning or is a commonly searched alias.
- Do not translate source code identifiers, package names, CLI flags, hook names, file names, commands, or error messages.

### Naming

- Use lowercase kebab-case filenames.
- Make filenames semantic and searchable.
- Use one topic, problem, decision, or runbook per file.
- Avoid generic names like `notes.md` or `temp.md`.
- New notes under `01_ARCHITECTURE`, `02_ORCHESTRATION`, `05_SECURITY`, `07_RUNBOOKS`, `08_TROUBLESHOOTING`, and `09_DECISIONS` must match the filenames already indexed in [[../00_INDEX/knowledge-index]] — check there before creating a new file in those folders.

### Required Frontmatter

```text
---
title: ...
summary: ...
tags: [...]
domain: ...
service: Ruflo
status: active
last_reviewed: YYYY-MM-DD
related: [...]
rag_include: true
retrieval_priority: normal
audience: [agent, human]
sensitivity: public
source_of_truth: true
aliases: [...]
aliases_th: [...]
task_types: [...]
note_role: focused
routing_intents: [...]
---
```

The RAG fields are required for every active note. `rag_include: true` is explicit opt-in; drafts must set `rag_include: false` and `source_of_truth: false`. Omit `aliases_th` when no Thai alias is useful. Use `note_role: router` only for a concise routing note, with narrow `routing_intents`; use `focused` for normal retrievable evidence.

**Sensitivity default is `public`.** This repo is public on GitHub (`zsitthiporn/ruflo`) — never write secrets, tokens, credentials, or private data into any note regardless of the `sensitivity` value. Machine paths (`C:\Users\...`, `D:\Project\...`) are acceptable since they already appear in the repo's own committed docs.

### Required Visible Sections

- Title.
- Summary.
- Key Terms.
- Main Content.
- Related Code.
- Related Notes.

Compact agent-only routing notes may omit visible `Summary` and `Key Terms` sections when equivalent `summary`, `aliases`, and `aliases_th` frontmatter is present.

### Retrieval Keyword Rules

- Use exact command, flag, hook, tool, file, and error names when safe.
- Include common aliases only when they are useful search terms.
- Keep `aliases` and `aliases_th` as single-line inline lists so validators can parse them without loading the note body.
- Keep keywords short.

### Obsidian Linking Rules

- Use Obsidian wiki links for knowledge-to-knowledge references, such as `[[../01_ARCHITECTURE/monorepo-layout]]`.
- Prefer links to canonical active notes.
- Do not embed raw logs, secrets, credentials, or internal-only artifacts.
- Verify every wikilink resolves to a real filename before treating a note as finished — a broken link in a router note misroutes every agent that follows it.

## Related Code

- `D:/Project/ME/Ruflo/Ruflo-Knowledge`

## Related Notes

- [[../11_AI/agent-start]]
- [[../AGENTS]]
