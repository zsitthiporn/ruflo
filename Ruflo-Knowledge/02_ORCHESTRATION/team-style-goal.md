---
title: Team-Style Goal
summary: Why the Ruflo fork exists — to run the owner's hub-and-spoke working style instead of upstream's swarm-by-reflex doctrine, and where that goal is tracked.
tags: [orchestration, hub-and-spoke, fork-goal, team-lead, github-issues]
domain: orchestration
service: Ruflo
status: active
last_reviewed: 2026-08-15
related: [02_ORCHESTRATION/hub-and-spoke-doctrine, 02_ORCHESTRATION/worker-brief-standard, 02_ORCHESTRATION/internal-board-mechanics, 11_AI/agent-start]
rag_include: true
retrieval_priority: high
audience: [agent, human]
sensitivity: public
source_of_truth: true
aliases: [fork goal, why this fork exists, team-lead style, hub-and-spoke rollout]
aliases_th: [เป้าหมายฟอร์ก, สไตล์ทีมลีด, ทำไมต้องฟอร์กนี้]
task_types: [orchestration-setup, onboarding]
---

# Team-Style Goal

## Summary

The Ruflo fork exists to run the owner's own working style: the main chat session acts as a **team lead** — single voice to the user, decomposer of work, dispatcher of isolated workers, skeptical reviewer of every report, sole writer of the task board, and sole merger. Upstream's swarm doctrine was deliberately rewritten out. The style was trialed first on the BIGO workspace before being generalized here.

## Key Terms

| Term | Meaning |
| --- | --- |
| Team lead | The main chat session — single voice to the user, dispatches, reviews, owns the board, merges |
| Worker | Isolated subagent that reports to the lead only, never to the user or to another worker by default |
| `team-lead` skill | The house playbook for this model — user-level skill, not project-local |
| `issue-swarm` | Companion skill kept for batches of hosted-tracker issues specifically |
| Three-layer state | Obsidian vault (permanent) / ruflo board (working) / external tracker (optional mirror) |

## Main Content

### Why the fork exists

Ruflo is a personal fork whose stated purpose is not primarily to add features on top of upstream `claude-flow`, but to replace upstream's **swarm-by-reflex doctrine** — auto-initializing a swarm on perceived complexity, a fixed researcher → architect → coder → tester pipeline, agents messaging each other freely, hive-mind consensus as a default — with a **hub-and-spoke** model that matches how the owner actually wants to work: one lead, isolated workers, no peer mesh, no consensus round. The lead is the single point of decomposition, dispatch, skeptical review, board ownership, and merge authority. See [[02_ORCHESTRATION/hub-and-spoke-doctrine]] for the operating rules this implies.

### Where the playbook lives

The house playbook for this model is the **user-level `team-lead` skill**, kept in a dedicated skills repository (`D:\Project\ME\Agent-skills`) and symlinked into `~/.claude/skills` so it is available across every project, not just Ruflo. This is a deliberate choice: the working style is the owner's, not this repository's, so the skill lives at user scope and Ruflo consumes it like any other project would.

A companion skill, `issue-swarm`, remains in active use for a different shape of work: batches of pre-existing issues on a hosted tracker (GitLab/GitHub/Jira) that need triage and parallel dispatch as a set. `team-lead` and `issue-swarm` are not competitors — `team-lead` is the general orchestration doctrine, `issue-swarm` is the specialization for tracker-issue batches.

### Three-layer state model

The rollout settled on three distinct layers of state, each with a different lifetime and purpose:

1. **Obsidian vault** (this vault) — permanent knowledge: architecture facts, security decisions, troubleshooting lore, ADRs. Durable across sessions and across projects.
2. **Ruflo board** — working state for the current task: what's in progress, what's blocked, what's next. Lives in `.claude-flow/tasks/store.json` per workspace (see [[02_ORCHESTRATION/internal-board-mechanics]]) and is explicitly *not* meant to be permanent knowledge.
3. **External tracker** (optional) — a mirror of the working state on a hosted tracker (GitHub Issues, GitLab, Jira), synced by the lead when the work needs visibility outside the local session.

These layers are intentionally not merged into one system: the vault survives when the board is cleared, the board survives across a session without needing a tracker, and the tracker is opt-in overhead only when external visibility is worth it.

### Rollout tracking

The rollout plan for this working style itself lived as a set of GitHub issues, `#1` through `#17`. As of the last review, all of them are closed except:

- **`#1`** — the master plan issue, kept open as the umbrella/reference.
- **`#5`** — the BIGO pilot, still pending. The remaining action is to pick 2–3 GitLab issues on the BIGO workspace and restart a BIGO session under this model to validate it end-to-end on a second, independent codebase before calling the rollout complete.

## Related Code

- `D:/Project/ME/Ruflo/CLAUDE.md` — "Hub-and-Spoke Orchestration" section, the in-repo statement of this doctrine
- `D:\Project\ME\Agent-skills` — external skills repository holding the `team-lead` and `issue-swarm` skills (symlinked to `~/.claude/skills`)

## Related Notes

- [[02_ORCHESTRATION/hub-and-spoke-doctrine]]
- [[02_ORCHESTRATION/worker-brief-standard]]
- [[02_ORCHESTRATION/internal-board-mechanics]]
- [[02_ORCHESTRATION/verification-tiers]]
- [[11_AI/agent-start]]
