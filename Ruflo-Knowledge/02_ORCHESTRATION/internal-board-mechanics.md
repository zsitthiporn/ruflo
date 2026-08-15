---
title: Internal Board Mechanics
summary: How the ruflo task board actually persists — a lock-free JSON file that silently loses entries under concurrent writers — and the rules that follow from that measured fact.
tags: [orchestration, task-board, concurrency, data-loss, mcp, store-json]
domain: orchestration
service: Ruflo
status: active
last_reviewed: 2026-08-15
related: [02_ORCHESTRATION/hub-and-spoke-doctrine, 02_ORCHESTRATION/worker-brief-standard, honest-status-of-coordination-surfaces]
rag_include: true
retrieval_priority: high
audience: [agent, human]
sensitivity: public
source_of_truth: true
aliases: [task board, store.json, board write loss, task_create task_list, no locking board]
aliases_th: [กระดานงาน, บอร์ดงานสูญหาย, store.json ไม่มีล็อก]
task_types: [orchestration-setup, troubleshooting, worker-dispatch]
---

# Internal Board Mechanics

## Summary

The "board" behind the ruflo task tools (`task_create` / `task_list` / `task_update`) is a **plain JSON file** at `<workspace>/.claude-flow/tasks/store.json`, not the swarm memory database its own tool descriptions claim, and it has **no write locking**. Concurrent CLI writers measurably lose entries silently — 16 writers produced only 5 surviving entries, and every one of those losses printed `[OK]` with exit code 0. This proven fact is why the lead is the board's only writer.

## Key Terms

| Term | Meaning |
| --- | --- |
| Board | The ruflo task tools' persisted state — `task_create`/`task_list`/`task_update` when MCP is wired |
| `store.json` | `<workspace>/.claude-flow/tasks/store.json` — the actual backing file, plain JSON, no lock |
| Silent loss | A write that reports success (`[OK]`, exit 0) but never lands in the file |
| Read-path bug (#9) | CLI board reads returned blank IDs — fixed |
| Write-path bug (#12) | CLI board writes silently dropped the `--assign` field — fixed |

## Main Content

### What the tool descriptions claim vs. what happens

The MCP tool descriptions for `task_create`, `task_status`, and `task_list` advertise persistence "in the `.swarm/memory.db`." That claim does not match the implementation: the handler writes to `<cwd>/.claude-flow/tasks/store.json` — an ordinary JSON file on disk, not the SQLite-backed swarm memory database the description implies. This distinction matters because a JSON file with no locking behaves very differently under concurrency than a database would.

### The concurrency proof

The no-locking claim was verified empirically, not assumed: 16 concurrent CLI writers targeting the same board produced only **5 surviving entries** — the other 11 writes were lost. Critically, **every one of the 16 writes reported success** (`[OK]`, exit code 0). A caller has no way to detect the loss from the CLI's own output; the only way to know an entry didn't land is to re-read the file afterward and count.

### Rules this forces

Because the failure mode is silent, the mitigation has to be structural, not defensive coding inside the board tool itself:

- **Lead-only writes.** Only the team lead session writes to the board. Workers report; the lead is the one who records progress.
- **One lead session per workspace.** Two lead sessions writing to the same workspace's board is the same concurrency hazard as 16 CLI writers — it is data loss, not a race that merely needs a retry.
- **Never mix CLI and MCP writes** against the same board. Pick one write path per workspace and stay on it.
- **Native `TodoWrite`** is the lead's in-session checklist and is always safe — it does not touch `store.json` at all, so it carries none of this risk. It is not a substitute for cross-session board state, only for the lead's own working list within one session.

### Fixed bugs on this path

Two concrete bugs were found and fixed on the board's CLI surface (tracked as fork issues, referenced here by number):

- **`#9`** — CLI board reads were broken: `task list` returned entries with blank IDs, making them unusable as references. Fixed.
- **`#12`** — the CLI write path silently dropped the `--assign` field on `task create` — a task could be created with no assignee even when one was explicitly passed. Fixed.

### Where there is no MCP board at all

In workspaces where the claude-flow MCP server isn't wired up, there is no `store.json`-backed board to write to. In that situation, whatever task list the calling harness provides (e.g. Claude Code's own in-session task list) serves as the board **under the same rules** — one writer, no concurrent mutation, treat every unverified entry as a claim.

## Related Code

- `v3/@claude-flow/cli/src/mcp-tools/task-tools.ts` — the `task_create`/`task_status`/`task_list` MCP tool handlers and the `store.json` write path
- `<workspace>/.claude-flow/tasks/store.json` — the actual board file (workspace-relative, not committed)

## Related Notes

- [[02_ORCHESTRATION/hub-and-spoke-doctrine]]
- [[02_ORCHESTRATION/worker-brief-standard]]
- [[02_ORCHESTRATION/verification-tiers]]
- [[honest-status-of-coordination-surfaces]]
- [[08_TROUBLESHOOTING/fake-session-restore-output]]
