---
title: Honest Status Of Coordination Surfaces
summary: What Ruflo's task tools, hooks, and MCP worker-dispatch actually do, verified against source, versus what they advertise.
tags: [coordination, hooks, mcp, task-board, honesty-audit]
domain: ai-operations
service: Ruflo
status: active
last_reviewed: 2026-08-15
related: [agent-start, ../02_ORCHESTRATION/internal-board-mechanics, ../02_ORCHESTRATION/hub-and-spoke-doctrine, ../08_TROUBLESHOOTING/fake-session-restore-output]
rag_include: true
retrieval_priority: high
audience: [agent, human]
sensitivity: public
source_of_truth: true
aliases: [coordination surface honesty, task tools, worker-dispatch, teammate-idle, task-completed]
aliases_th: [บอร์ดงาน, ตรวจงาน]
task_types: [reference, ai-operations]
---

# Honest Status Of Coordination Surfaces

## Summary

Several of Ruflo's coordination surfaces — task tools, hooks, and the MCP `worker-dispatch` tool — advertise more than they deliver. This note records what was actually verified against the source this week, so an agent does not trust a tool's own description over the code.

## Key Terms

| Term | Meaning |
| --- | --- |
| Domain | ai-operations |
| Related system | Ruflo |
| `coordination surface` | A tool or hook that claims to record, persist, or route work |
| `leadNotified` | A flag `task-completed` echoes back — not a delivered notification |
| `synthetic-completed` | The status `worker-dispatch` returns when it fakes execution |

## Main Content

### Verified Status Table

| Surface | What It Advertises | What Actually Happens |
| --- | --- | --- |
| Task tools (`task_create` / `task_status` / `task_list`) | Persistence "in the `.swarm/memory.db`" (per tool descriptions) | The handler writes `<cwd>/.claude-flow/tasks/store.json` — a plain JSON file, not that database, with **no write locking** |
| `hooks teammate-idle` | Auto-assigns pending tasks to an idle teammate | Honest acknowledgement only. Auto-assignment is **declined by doctrine**, not pending — the lead routes work, and an auto-assigned task would arrive without the ground-truth block and ownership boundary that make a dispatch safe |
| `hooks task-completed` | "Notify lead", train patterns | `leadNotified` echoes the input flag back; **no notification is delivered**. Its `trainPatterns: true` learning path is real (SONA / EWC++) |
| `hooks session-end` | "Persist state", returns a `statePath` | Writes no session state file. Real persistence goes through the `session_save` tool instead |
| SessionStart hook | Restores prior session state on startup | When its module fails to load, it prints a **fake restore table** — literal `%SESSION_ID%` placeholder text and zeroed fields — instead of failing loudly. See [[../08_TROUBLESHOOTING/fake-session-restore-output]] |
| MCP `worker-dispatch` | Dispatches a background worker | Requires a running daemon. With `background: false` it returns `synthetic-completed` **without executing anything**. The only daemon-less one-shot path is the CLI `daemon trigger -w <worker>` |
| Daemon autostart | Starts automatically when needed | Opt-in only — `RUFLO_DAEMON_AUTOSTART=1` env var or `daemon.autostart: true` in config (config wins on conflict). Running `--help` starts nothing |

### Concurrent Writers, Proven

Concurrent CLI writers to the task board lose entries silently while each individually reports success. A test with 16 concurrent writers landed only 5 entries in `store.json` — every writer printed `[OK]`, and none reported the loss. This is the direct consequence of no write locking on a plain JSON file, and it is why the hub-and-spoke doctrine makes the lead the **only** writer of the board — see [[../02_ORCHESTRATION/internal-board-mechanics]] and [[../02_ORCHESTRATION/hub-and-spoke-doctrine]].

### What This Means For An Agent

- Treat every coordination surface above as a **reporting surface**, not as coordination you can rely on for correctness.
- Never run two concurrent writers against the task board, even briefly — the loss is silent, not an error.
- A tool result claiming work was "notified", "persisted", or "dispatched" is a bookkeeping entry, not evidence. Verify against the code or the resulting file, not the tool's own success message.

## Related Code

- `D:/Project/ME/Ruflo/v3/@claude-flow/hooks`
- `D:/Project/ME/Ruflo/v3/@claude-flow/cli`

## Related Notes

- [[agent-start]]
- [[../02_ORCHESTRATION/internal-board-mechanics]]
- [[../02_ORCHESTRATION/hub-and-spoke-doctrine]]
- [[../08_TROUBLESHOOTING/fake-session-restore-output]]
