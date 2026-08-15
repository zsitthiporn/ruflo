---
title: Troubleshooting Index
summary: Entrypoint for Ruflo troubleshooting notes — symptom to note.
tags: [index, troubleshooting, incident, rca]
domain: troubleshooting
service: Ruflo
status: active
last_reviewed: 2026-08-15
related: [knowledge-index, task-entrypoints, retrieval-keyword-index]
rag_include: true
retrieval_priority: high
audience: [agent, human]
sensitivity: public
source_of_truth: true
aliases: [troubleshooting, incident, RCA, root cause]
aliases_th: [แก้ปัญหา, ปัญหา node, หาสาเหตุ, ตรวจสอบปัญหา]
task_types: [troubleshooting, incident]
note_role: router
routing_intents: [troubleshooting, incident]
---

# Troubleshooting Index

## Summary

Entrypoint for Ruflo troubleshooting notes. Search for the symptom first; only create a new note under `08_TROUBLESHOOTING` if one genuinely does not exist yet.

## Key Terms

| Term | Meaning |
| --- | --- |
| Domain | troubleshooting |
| Related system | Ruflo |
| `troubleshooting index` | Search keyword |
| `known trap` | Search keyword |
| `root cause` | Search keyword |

## Main Content

### Start Here

1. Search for an exact error message, command, hook name, or symptom below.
2. If no note exists, follow [[../12_STANDARDS/markdown-note-standard]] to write one under `08_TROUBLESHOOTING/`.
3. Link the new note to affected architecture, orchestration, and security notes.
4. Update this table after adding a recurring issue.

### Known Issues

| Symptom | Note | Status |
| --- | --- | --- |
| `node` shim fails with `stdin is not a tty` when run from Git Bash | [[../08_TROUBLESHOOTING/git-bash-tty-shim]] | Documented |
| CLI or daemon resolves an unexpected Node.js version | [[../08_TROUBLESHOOTING/node-version-traps]] | Documented |
| Multiple concurrent MCP/daemon processes left running across sessions, causing resource contention or state corruption | [[../08_TROUBLESHOOTING/stray-daemon-processes]] | Documented |
| `npm install` silently resolves a package from the public registry instead of this fork's local source | [[../08_TROUBLESHOOTING/lockfile-registry-substitution]] | Documented |
| Session-restore output shows a literal `%SESSION_ID%` placeholder and zeroed fields instead of real state | [[../08_TROUBLESHOOTING/fake-session-restore-output]] | Documented |
| A diagnostic or health-check surface reports success by matching its own echoed output rather than verifying real state | [[../08_TROUBLESHOOTING/self-matching-diagnostics]] | Documented |
| Concurrent CLI writers to the task board lose entries silently while each individually prints `[OK]` | [[../11_AI/honest-status-of-coordination-surfaces]] | Documented |
| No recurring issue documented yet for a given symptom | [[../12_STANDARDS/markdown-note-standard]] | Write a new note |

## Related Code

- `D:/Project/ME/Ruflo`

## Related Notes

- [[knowledge-index]]
- [[task-entrypoints]]
- [[retrieval-keyword-index]]
- [[../11_AI/honest-status-of-coordination-surfaces]]
