---
title: Hub-and-Spoke Doctrine
summary: The operating rules for lead and worker roles in Ruflo's hub-and-spoke model, plus the mandatory dissent slot and its proven track record of catching bad lead assumptions.
tags: [orchestration, hub-and-spoke, worker-protocol, dissent, reporting-contract]
domain: orchestration
service: Ruflo
status: active
last_reviewed: 2026-08-15
related: [02_ORCHESTRATION/team-style-goal, 02_ORCHESTRATION/worker-brief-standard, 02_ORCHESTRATION/internal-board-mechanics, 08_TROUBLESHOOTING/self-matching-diagnostics]
rag_include: true
retrieval_priority: high
audience: [agent, human]
sensitivity: public
source_of_truth: true
aliases: [lead worker rules, dissent slot, hub and spoke rules, worker reporting contract]
aliases_th: [กฎลีดกับเวิร์กเกอร์, ช่องความเห็นแย้ง]
task_types: [orchestration-setup, worker-dispatch, review]
---

# Hub-and-Spoke Doctrine

## Summary

The concrete rules that follow from running hub-and-spoke instead of a swarm: the lead is the single voice, decomposer, non-overlapping-ownership assigner, sole board writer, skeptical reviewer, and sole merger; workers report to the lead only, stay inside their ownership set, return evidence, and escalate rather than guess. A mandatory **dissent slot** in every worker report — "where I disagree" — has already refuted the lead's own stated ground truth three separate times in this session's history, and out-of-scope findings (reported, never fixed on the spot) have produced the highest-value discoveries.

## Key Terms

| Term | Meaning |
| --- | --- |
| Lead | The main chat session; owns decomposition, dispatch, board, review, and merge |
| Worker | Isolated subagent; reports to lead only, stays in its ownership set |
| Dissent slot | Mandatory "where I disagree" section in every worker report |
| Out-of-scope finding | Something a worker notices outside its brief — reported, never fixed inline |
| Report as claim | The lead treats every worker report as unverified until spot-checked against the code |

## Main Content

### Lead responsibilities

- Single voice to the user — workers never address the user directly.
- Decomposes the work and decides what is delegated versus done inline.
- Assigns every worker an explicit, **non-overlapping** ownership set — no two workers ever own the same file.
- Is the **only** writer of the task board and of shared manifests/lockfiles.
- Reviews every worker report as a **claim**, not a verified result — spot-checks anything load-bearing against the actual code before acting on it or relaying it to the user.
- Performs all merges and resolves every overlap.
- **Never polls** a running worker — dispatches, keeps working on what it owns, and waits for the report to arrive.

### Worker responsibilities

- Reports to the lead only. Not to the user, and not to another worker unless the lead explicitly sanctioned that specific hop for a real dependency.
- Stays inside its assigned ownership set. A file outside that set is something to *report*, not something to *edit*.
- Returns evidence: absolute file paths, line numbers, commands actually run, exit codes, what failed — not a narrative summary alone.
- Escalates instead of guessing when the brief and reality disagree.
- Never invokes the `ruflo` CLI directly (see the CLI-corruption risk covered in [[08_TROUBLESHOOTING/stray-daemon-processes]] and the concurrent-session helper-corruption history in the repo's `CLAUDE.md`).
- Never writes board state — that is the lead's job alone.

### The dissent slot

Every worker report carries a mandatory dissent section — "where I disagree" with the lead's stated ground truth or assumptions — even when the answer is "none." This is not decorative. Across this session's history the dissent slot has **refuted the lead's own ground truth three times**:

1. A `--version` claim the lead treated as fact was false; the real culprit was `--help` behaving differently than assumed.
2. A `statePath` the lead assumed was unset was actually populated — with a dead/stale value, not an absence.
3. A "helper-refresh pulls from the network" assumption was wrong — it operates on a **local copy**, not a network fetch.

Each of these would have propagated as accepted fact if the worker had simply agreed with the brief instead of checking it. The dissent slot is what makes hub-and-spoke self-correcting rather than a hierarchy where the lead's assumptions become unquestioned truth two hops downstream.

### Out-of-scope findings — report, never fix

Workers are explicitly instructed to **report** anything they notice outside their ownership set rather than fix it inline, even when the fix looks trivial. This discipline is what produced the highest-value discoveries in this fork's history, all found incidentally while a worker was doing something else:

- A third, previously unknown `CLAUDE.md`-equivalent file influencing behavior.
- The `[COGNITUM]` ad injected into transcripts under rate-limiting (see [[05_SECURITY/upstream-telemetry-removal]]).
- An `npx`-based re-infection vector in generated hooks (see [[05_SECURITY/registry-decoupling]]).
- Silent field drops on the task board's write path (see [[02_ORCHESTRATION/internal-board-mechanics]]).

None of these were what the dispatched worker was asked to look for. They surfaced because "report, don't fix" keeps a worker's attention on evidence instead of on rushing to close its own ticket.

## Related Code

- `D:/Project/ME/Ruflo/CLAUDE.md` — "Hub-and-Spoke Orchestration" and "Worker Briefs and Reporting" sections
- `v3/@claude-flow/cli/src/mcp-tools/task-tools.ts` — where board writes actually land

## Related Notes

- [[02_ORCHESTRATION/team-style-goal]]
- [[02_ORCHESTRATION/worker-brief-standard]]
- [[02_ORCHESTRATION/internal-board-mechanics]]
- [[02_ORCHESTRATION/verification-tiers]]
- [[08_TROUBLESHOOTING/self-matching-diagnostics]]
- [[honest-status-of-coordination-surfaces]]
