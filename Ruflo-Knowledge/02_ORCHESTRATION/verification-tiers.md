---
title: Verification Tiers
summary: The three proof tiers a lead names per work item before dispatch, the measured effect of tiering on worker efficiency, and the self-matching anti-patterns to watch for.
tags: [orchestration, verification, proof-tiers, worker-dispatch, anti-patterns]
domain: orchestration
service: Ruflo
status: active
last_reviewed: 2026-08-15
related: [02_ORCHESTRATION/worker-brief-standard, 02_ORCHESTRATION/hub-and-spoke-doctrine, 08_TROUBLESHOOTING/self-matching-diagnostics]
rag_include: true
retrieval_priority: normal
audience: [agent, human]
sensitivity: public
source_of_truth: true
aliases: [proof tiers, verification standard, worker proof levels, baseline before after]
aliases_th: [ระดับการพิสูจน์, มาตรฐานการตรวจสอบงาน]
task_types: [worker-dispatch, review, verification]
---

# Verification Tiers

## Summary

Not every change needs the same weight of proof. The lead picks one of three verification tiers per work item and names it explicitly in the worker's dispatch prompt: dead-surface removal, behaviour change, or production/propagation-delay change. Naming the right tier up front measurably changed worker efficiency — the same worker went from 11 minutes / 49 tool calls to 4 minutes / 19 calls on a comparable, larger follow-up task once tiering and the environment block (see [[02_ORCHESTRATION/worker-brief-standard]]) were both in place.

## Key Terms

| Term | Meaning |
| --- | --- |
| Tier 1 | Dead-surface removal or description-only fix — grep + typecheck + tests, no baseline/tautology check needed |
| Tier 2 | Behaviour change — needs a baseline, execution proof, and a regression test verified non-tautological by reverting the fix |
| Tier 3 | Production or propagation-delay change — full standard, including wait-and-recheck, but only where propagation delay actually applies |
| Tautological test | A test that passes whether or not the fix is present — caught by reverting the fix and confirming the test then fails |

## Main Content

### The three tiers

1. **Tier 1 — dead-surface removal / description fix.** Deleting unused code, correcting a misleading tool description, or any change with no runtime behavioural surface. Proof requirement: grep to confirm the surface is actually gone, a typecheck pass, and the existing test suite still green. No baseline capture and no tautology check — there is no behaviour to compare before/after.

2. **Tier 2 — behaviour change.** Anything that changes what the system actually does. Requires: a captured **baseline** (what happened before the change), **execution proof** (what happens after, actually run — not inferred), and a **regression test that is verified non-tautological** by reverting the fix and confirming the test then fails. A regression test that still passes with the fix reverted is not proof of anything; it is Tier 2's most common false-positive.

3. **Tier 3 — production / propagation-delay change.** The full Tier 2 standard plus a wait-and-recheck step. This step applies **only** to systems that genuinely have propagation delay (e.g. a cache, a registry, a distributed config) — applying wait-and-recheck to a system with no such delay is wasted verification effort, not extra rigor.

### The lead names the tier — it is not the worker's guess

The tier is chosen by the lead based on the shape of the work, and it is stated explicitly in the worker's dispatch prompt, not left for the worker to infer. A worker guessing the tier tends to either over-verify trivial changes (burning time) or under-verify real behaviour changes (missing regressions) — naming it removes that guesswork.

### Measured effect

Adding explicit tiering, combined with the environment block described in [[02_ORCHESTRATION/worker-brief-standard]], had a measured effect on the same worker across two comparable tasks: an earlier dispatch took **11 minutes and 49 tool calls**; a **larger** follow-up task, dispatched with tiering and the environment block both present, took **4 minutes and 19 calls**. The follow-up was strictly bigger in scope and still finished faster — the efficiency gain is attributable to the worker not having to rediscover its own operating constraints and proof bar mid-task.

### Anti-patterns caught live

Two live incidents illustrate why proof has to be checked, not just produced:

- **A grep matching its own explanatory comment.** A search for a deprecated pattern counted hits that included the fix's own comment describing the pattern it removed — inflating the apparent remaining-instance count. See [[08_TROUBLESHOOTING/self-matching-diagnostics]] for the general rule this produced.
- **A process check matching the shell running it.** A check for a running daemon process matched the very shell process executing the check, producing a false positive that looked like contamination. The rule this produced: a suspiciously dirty result indicts the query first, not the system under test.

## Related Code

- `D:/Project/ME/Ruflo/CLAUDE.md` — "Review & Second Opinion" section (adjacent doctrine at the global level)

## Related Notes

- [[02_ORCHESTRATION/worker-brief-standard]]
- [[02_ORCHESTRATION/hub-and-spoke-doctrine]]
- [[08_TROUBLESHOOTING/self-matching-diagnostics]]
- [[02_ORCHESTRATION/team-style-goal]]
