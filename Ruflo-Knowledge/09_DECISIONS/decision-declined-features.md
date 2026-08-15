---
title: Decision — Declined Features
summary: ADR — four proposed features declined with explicit reopen signals (issue #6): scheduled daemon, vault semantic index, worklog generator, and teammate-idle auto-assignment (the last one permanent).
tags: [decision, adr, declined-features, scope-discipline, teammate-idle]
domain: decisions
service: Ruflo
status: active
last_reviewed: 2026-08-15
related: [02_ORCHESTRATION/hub-and-spoke-doctrine, 02_ORCHESTRATION/internal-board-mechanics, honest-status-of-coordination-surfaces]
rag_include: true
retrieval_priority: normal
audience: [agent, human]
sensitivity: public
source_of_truth: true
aliases: [declined features issue 6, why no auto-assignment, why no scheduled daemon, why no vault semantic index]
aliases_th: [ฟีเจอร์ที่ปฏิเสธ, เหตุผลไม่ทำ auto-assign]
task_types: [decision-record, scope-management, orchestration-setup]
---

# Decision — Declined Features

## Summary

ADR recording four features proposed and declined under issue `#6`, each with a stated reopen signal rather than a flat no. Three are conditionally reopenable if circumstances change; the fourth — teammate-idle auto-assignment — is declined **permanently**, because it structurally contradicts the lead-routes-work principle this fork is built around.

## Key Terms

| Term | Meaning |
| --- | --- |
| Scheduled daemon | A proposed always-on daemon triggering background workers on a timer |
| Vault semantic index | A proposed chunk-similarity search layer over the Obsidian vault |
| Worklog generator | A proposed automatic generator of work-session summaries |
| Teammate-idle auto-assignment | A proposed feature to auto-assign pending tasks to an idle teammate hook |

## Main Content

### Context

Four feature proposals surfaced under issue `#6` during the orchestration-model rollout. Each was evaluated against the fork's actual operating constraints (the lock-free board from [[02_ORCHESTRATION/internal-board-mechanics]], the lead-routes-work doctrine from [[02_ORCHESTRATION/hub-and-spoke-doctrine]], and the vault's own retrieval design) rather than declined by default.

### Decision — declined, with reopen signals

1. **Scheduled daemon.** Would introduce a second writer against a store that already has no write locking (see [[02_ORCHESTRATION/internal-board-mechanics]]) — a timer-driven daemon writing to the board concurrently with the lead is exactly the concurrency hazard that mechanics note documents. The manual habit `daemon trigger -w consolidate` already covers the need adequately. **Reopen if** manual triggers are observed happening more than weekly — at that frequency the automation would start paying for its added concurrency risk.

2. **Vault semantic index.** The vault already has its own retrieval design — `rag_include`, `retrieval_priority`, a manifest, and a router — and a chunk-similarity index would pull in the **opposite** direction from the route-once-read-smallest doctrine this vault is built on: semantic chunk search tends to surface partial, decontextualized fragments, where this vault's design intentionally routes a reader to the single smallest complete note that answers the question. **Reopen if** the router is observed actually misrouting queries in practice — at that point a semantic layer might be solving a real, observed problem rather than a hypothetical one.

3. **Worklog generator.** An automatic generator of session worklogs was declined on the reasoning that the value of a worklog is in the **judgement** captured — what actually happened and why it mattered — not in a mechanically produced list of titles or file diffs. A generator would produce the latter, not the former. No reopen condition was stated; this one is closer to "not the right kind of tool for the job" than "not yet justified."

4. **Teammate-idle auto-assignment.** Declined **permanently**, not conditionally. Auto-assigning a pending task to an idle teammate hook directly contradicts the lead-routes-work principle at the center of this fork's whole model (see [[02_ORCHESTRATION/hub-and-spoke-doctrine]]): an auto-assigned task arrives at a worker **without** the ground-truth block and the explicit ownership boundary that make a dispatch safe in the first place. Those two things are not optional metadata — they are what let a worker execute without re-deriving facts the lead already verified, and what prevents two workers from touching the same file. A feature that skips both by construction is not a smaller version of safe dispatch; it is a different, unsafe thing. See [[honest-status-of-coordination-surfaces]] for the related fact that the `teammate-idle` hook is currently a stub for exactly this reason.

### Reopen-when

- Scheduled daemon: manual `daemon trigger` usage observed more than weekly.
- Vault semantic index: the router is observed misrouting queries.
- Worklog generator: not applicable — considered a category mismatch, not a maturity gap.
- Teammate-idle auto-assignment: **never** — permanent, structural conflict with the lead-routes-work principle.

## Related Code

- `D:/Project/ME/Ruflo/CLAUDE.md` — "Agent Teams Hooks — status" table, `TeammateIdle` row

## Related Notes

- [[02_ORCHESTRATION/hub-and-spoke-doctrine]]
- [[02_ORCHESTRATION/internal-board-mechanics]]
- [[honest-status-of-coordination-surfaces]]
