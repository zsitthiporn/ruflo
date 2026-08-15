---
title: Worker Brief Standard
summary: The 8-section worker dispatch template, why the environment block goes first, and the templates available in the team-lead skill.
tags: [orchestration, worker-dispatch, brief-template, environment-block, stop-conditions]
domain: orchestration
service: Ruflo
status: active
last_reviewed: 2026-08-15
related: [02_ORCHESTRATION/hub-and-spoke-doctrine, 02_ORCHESTRATION/verification-tiers, 02_ORCHESTRATION/team-style-goal, 08_TROUBLESHOOTING/node-version-traps]
rag_include: true
retrieval_priority: high
audience: [agent, human]
sensitivity: public
source_of_truth: true
aliases: [worker brief, dispatch template, worker prompt sections, environment block]
aliases_th: [เทมเพลตมอบหมายงาน, ช่วงข้อมูลสภาพแวดล้อม]
task_types: [worker-dispatch, orchestration-setup]
---

# Worker Brief Standard

## Summary

A worker dispatch brief has 8 sections, in a fixed order. Section 0 — the environment block — is the single highest-return section: its absence cost two different workers roughly 20 minutes each, and once cost a worker a wrong conclusion that Node 22 wasn't installed on the machine at all (see [[08_TROUBLESHOOTING/node-version-traps]]). The `team-lead` skill ships four ready-made templates built on this shape: writing-worker, investigator, verifier, and ops-worker.

## Key Terms

| Term | Meaning |
| --- | --- |
| Environment block (§0) | Runtime path, test command, shell traps, source-vs-dist distinction, read-only-git-allowed statement |
| Ground-truth block (§3) | Facts the lead has already verified, stated verbatim so the worker doesn't re-derive or contradict them |
| Capability boundary (§4) | States *how* the worker may act, not just *what* it may touch |
| Proof tier (§5) | Named verification tier from [[02_ORCHESTRATION/verification-tiers]], plus any negative tests required |
| Stop conditions (§6) | When to stop and report instead of improvising, including never routing around a permission denial |

## Main Content

### The 8 sections, in order

0. **Environment block.** Runtime path (which Node/tool version and where it lives), the exact test command to run, known shell traps (e.g. the Git Bash `stdin is not a tty` issue — see [[08_TROUBLESHOOTING/git-bash-tty-shim]]), whether the worker is looking at source or a built `dist/`, and an explicit statement of whether read-only git operations are allowed. This section has the highest measured return of the eight: its absence has cost workers roughly 20 minutes each re-deriving environment facts the lead already knew, and in one case led a worker to wrongly conclude that Node 22 was not installed on the machine at all — see [[08_TROUBLESHOOTING/node-version-traps]] for the concrete incident.
1. **Identity.** Who the worker is for this task and what role it plays.
2. **Read-first.** Pre-digested context the worker needs before acting — links, file paths, prior findings — so it doesn't have to rediscover them.
3. **Shared rules + ground-truth block, verbatim.** Facts the lead has already verified, stated exactly as verified, so the worker builds on them instead of re-deriving (and potentially contradicting) them.
4. **Capability boundary.** Not just *what* the worker may touch (its ownership set) but *how* it may act — read-only vs. may-edit, may-run-tests vs. may-not, and explicitly: never invoke the `ruflo` CLI.
5. **Proof tier, named, plus negative tests.** Which of the three tiers from [[02_ORCHESTRATION/verification-tiers]] applies, and any negative/tautology-check tests required for that tier.
6. **Stop conditions.** When to stop and report rather than improvise. The hard rule inside this section: **never route around a permission denial** — treating a denial as an obstacle to engineer past is laundering, not problem-solving, and is grounds to stop and escalate instead.
7. **Report format.** What the report must contain: proven-vs-not-proven claims, and the mandatory dissent slot (see [[02_ORCHESTRATION/hub-and-spoke-doctrine]]).

### Why the environment block goes first

Every other section assumes the worker already knows where it's running and how to check its own work. Put environment information anywhere else in the brief and a worker under time pressure tends to skip straight to the task, hit an environment-shaped wall (wrong Node version, wrong shell, source vs. dist confusion), and burn a large fraction of its budget diagnosing something the lead could have stated in one line. Ordering it first is what converts that cost from "worker rediscovers it" to "worker never needed to."

### Templates in the `team-lead` skill

The `team-lead` skill (see [[02_ORCHESTRATION/team-style-goal]] for where it lives) ships four brief templates built on this 8-section shape, tuned per role:

| Template | Shape |
| --- | --- |
| `writing-worker` | For workers producing new code or content |
| `investigator` | For read-only research and root-cause work |
| `verifier` | For workers whose sole job is to check another worker's claim |
| `ops-worker` | For workers running commands/builds/deploys within a bounded capability set |

## Related Code

- `D:/Project/ME/Ruflo/CLAUDE.md` — "Worker Briefs and Reporting" section, "The dispatch brief" example

## Related Notes

- [[02_ORCHESTRATION/hub-and-spoke-doctrine]]
- [[02_ORCHESTRATION/verification-tiers]]
- [[02_ORCHESTRATION/team-style-goal]]
- [[08_TROUBLESHOOTING/node-version-traps]]
- [[08_TROUBLESHOOTING/git-bash-tty-shim]]
