---
title: Fake Session Restore Output
summary: The "Session restored" table with literal %SESSION_ID% printed at every session start is a hardcoded fallback in hook-handler.cjs, not evidence of real persistence — the real mechanism is the session_save/session_restore MCP tools.
tags: [troubleshooting, session-restore, hardcoded-fallback, hooks, misleading-output]
domain: troubleshooting
service: Ruflo
status: active
last_reviewed: 2026-08-15
related: [02_ORCHESTRATION/internal-board-mechanics, honest-status-of-coordination-surfaces, state-layer]
rag_include: true
retrieval_priority: normal
audience: [agent, human]
sensitivity: public
source_of_truth: true
aliases: [session restored fake table, SESSION_ID literal, hook-handler hardcoded fallback, session-end writes nothing]
aliases_th: [ตารางเซสชันปลอม, session_save คือของจริง]
task_types: [troubleshooting, session-management]
---

# Fake Session Restore Output

## Summary

Every session start prints a "Session restored / Tasks 0 · Agents 0 · Memory 0" table, sometimes with the **literal, unsubstituted string** `%SESSION_ID%` still in it. This is a **hardcoded fallback** inside `hook-handler.cjs`, rendered whenever the real session module fails to load — it is not evidence that anything was actually restored, and the zeroes are not a real count of anything. Real persistence in this system goes through the `session_save` / `session_restore` MCP tools, whose round-trip has been proven to actually work. The `hooks session-end` CLI command, despite advertising that it persists state, writes nothing.

## Key Terms

| Term | Meaning |
| --- | --- |
| Hardcoded fallback | Static placeholder text `hook-handler.cjs` prints when the real session module fails to load |
| `%SESSION_ID%` literal | Un-substituted template placeholder — a tell that the fallback path fired, not the real one |
| `session_save` / `session_restore` | The MCP tools that actually persist and round-trip session state |
| `hooks session-end` | CLI command that reports success and returns a `statePath` but writes no file |

## Main Content

### What the output looks like, and why it's misleading

At session start, a table resembling:

```text
Session restored
Tasks: 0   Agents: 0   Memory: 0
```

is printed — and in the failure case that actually produces this table, the session-ID field shows the literal unsubstituted placeholder `%SESSION_ID%` rather than a real identifier. The table's presence *looks* like confirmation that a prior session's state was found and loaded. It is not: the table is a **hardcoded fallback string** baked into `hook-handler.cjs`, rendered specifically when the real session-restoration module fails to load for any reason. The zero counts are not "nothing was restored because there was nothing to restore" — they are static text with no underlying query behind them at all.

### The tell

The literal `%SESSION_ID%` string is the reliable signal that the fallback fired rather than the real path: a genuine restoration would substitute an actual session identifier into that slot. If that placeholder is visible verbatim in the output, the module load failed and nothing was actually inspected, let alone restored.

### What real persistence actually is

Persistence that has been proven to work in this system is the **`session_save`** / **`session_restore`** MCP tool pair — a round-trip that has been verified to actually write and later retrieve session state. This is the mechanism to reach for when real cross-session persistence is needed, not the CLI hooks below.

### `hooks session-end` writes nothing

The `hooks session-end` CLI command advertises that it "persists state" and returns a `statePath` value in its output — but it does **not** write a session-state file to that path or anywhere else. The returned `statePath` is populated in the response without a corresponding write ever happening. Anyone relying on this command's own claim of success, or its returned path, to confirm state was saved is trusting an unbacked claim. See [[honest-status-of-coordination-surfaces]] for the broader pattern of coordination surfaces that advertise more than they deliver.

## Related Code

- `.claude/helpers/hook-handler.cjs` — contains the hardcoded fallback table, including the `%SESSION_ID%` placeholder path
- `.claude/helpers/session.cjs` — session module the fallback triggers when it fails to load

## Related Notes

- [[02_ORCHESTRATION/internal-board-mechanics]]
- [[honest-status-of-coordination-surfaces]]
- [[state-layer]]
