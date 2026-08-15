---
title: Upstream Rebase Runbook
summary: The post-rebase checklist from fork-maintenance.md §4 — pubkey-constant diff, helper diff, doctrine survival, rebuild, and out-of-tree smoke test — for every merge or rebase onto upstream ruvnet/ruflo.
tags: [runbook, upstream, rebase, merge, fork-maintenance]
domain: runbook
service: Ruflo
status: active
last_reviewed: 2026-08-15
related: [../01_ARCHITECTURE/helper-system, ../01_ARCHITECTURE/build-and-dist]
rag_include: true
retrieval_priority: high
audience: [agent, human]
sensitivity: public
source_of_truth: true
aliases: [upstream rebase, merge upstream, ruvnet upstream sync, RUFLO_HELPERS_PUBKEY diff, rebase checklist]
aliases_th: [rebase upstream, sync กับ ruvnet]
task_types: [runbook, git-operations, security]
note_role: focused
routing_intents: [rebase-onto-upstream, merge-from-ruvnet-ruflo]
---

# Upstream Rebase Runbook

## Summary

Upstream `ruvnet/ruflo` is active, and every rebase or merge can silently
reopen drift this fork has deliberately closed — most dangerously, restoring
upstream's helper-signing public key, which would make upstream-signed
helpers trusted here again. This checklist is mined directly from
`docs/fork-maintenance.md` §4 and must be run in full after every rebase or
merge, not spot-checked.

## Key Terms

| Term | Meaning |
| --- | --- |
| `RUFLO_HELPERS_PUBKEY` | `src/init/helper-signing.ts:48-50` — the single line most likely to be silently restored to upstream's key by a merge |
| `.claude/helpers/.LOCKED` | Root project marker; a rebase that touches `.claude/helpers/` should not silently delete it |
| Hub-and-spoke doctrine | The fork's orchestration model — upstream keeps reintroducing auto-swarm doctrine that must not survive a merge |
| Known-false-claims list | `docs/fork-maintenance.md` §"Known-false claims in the shipped surface" — check whether upstream has since fixed any |

## Main Content

### The checklist, in order

- [ ] **`.claude/helpers/.LOCKED` still present**, and `~/.claude/helpers/.LOCKED`
      too. (Note: as of this session, `~/.claude/helpers/.LOCKED` was found
      **absent on this machine** — that gap predates this rebase and is
      tracked in [[../01_ARCHITECTURE/helper-system]], not something a rebase
      itself would have caused, but confirm it hasn't gotten worse.)
- [ ] **`git diff` on `.claude/helpers/**` is clean.** If helpers changed,
      decide deliberately whether to take upstream's version, keep the
      fork's, or hand-merge — never accept upstream's copies by default.
- [ ] **`RUFLO_HELPERS_PUBKEY` in `src/init/helper-signing.ts` is still
      ours.** This is the single highest-consequence line in the checklist —
      a merge that restores upstream's constant silently re-opens the trust
      this fork closed, and **nothing will fail loudly when it does**: the
      code still runs, verification still "works", it just verifies against
      the wrong key. Diff this constant every single rebase, not just when
      helpers appear to have changed. See
      [[../05_SECURITY/helper-signing-key]] for what's at stake.
- [ ] **Hub-and-spoke doctrine survived the merge** in both root `CLAUDE.md`
      and `v3/@claude-flow/cli/CLAUDE.md` — upstream will keep reintroducing
      auto-swarm doctrine (auto-initializing a swarm on "complexity", a
      reflexive researcher→architect→coder→tester pipeline, free
      worker-to-worker messaging, hive-mind-by-default). None of that is how
      this fork works; a rebase that silently reverts these files needs the
      fork's doctrine restored on top. See
      [[../02_ORCHESTRATION/hub-and-spoke-doctrine]].
- [ ] **The known-false-claims list is still accurate.** Re-check each item
      in `docs/fork-maintenance.md` §"Known-false claims in the shipped
      surface" (task-tool `.swarm/memory.db` claim, `hooks session-end`'s
      unwritten `statePath`, `hooks teammate-idle`'s stub, `worker-dispatch`
      needing a live daemon, the `embeddings chunk --file` no-op, the
      board-read display bugs) against the post-rebase source — upstream may
      have genuinely fixed some of these, which is good news worth recording
      in the doc, not silently dropping.
- [ ] **Rebuild, then smoke-test from outside the repo**:
      `node.exe D:/Project/ME/Ruflo/bin/cli.js --version` from a scratch
      directory. See [[../07_RUNBOOKS/build-and-test-runbook]] for the full
      build sequence this depends on.
- [ ] **Consuming workspaces still point at the local build**, not
      `npx ruflo@latest`. Spot-check at least one external `.mcp.json` entry
      per [[../07_RUNBOOKS/wire-a-consuming-workspace]].

### Why this order

The pubkey-diff and doctrine-survival checks come before the rebuild
deliberately: both are silent-failure modes (wrong key still "verifies",
missing doctrine still "runs") that a passing build or a green test suite
will not catch. Rebuild and smoke-test are last because they're the cheapest
possible positive signal, not the most informative one — a clean build
proves the code compiles, not that the fork's guarantees are intact.

## Related Code

- `D:/Project/ME/Ruflo/v3/@claude-flow/cli/src/init/helper-signing.ts:16-50` — the pubkey constant and its rotation history
- `D:/Project/ME/Ruflo/CLAUDE.md` — root doctrine (Hub-and-Spoke Orchestration section)
- `D:/Project/ME/Ruflo/v3/@claude-flow/cli/CLAUDE.md` — package-level doctrine mirror
- `docs/fork-maintenance.md` §4 "Upstream rebase checklist" — the canonical source for this checklist

## Related Notes

- [[../01_ARCHITECTURE/helper-system]]
- [[../01_ARCHITECTURE/build-and-dist]]
- [[../05_SECURITY/helper-signing-key]]
- [[../02_ORCHESTRATION/hub-and-spoke-doctrine]]
- [[../07_RUNBOOKS/build-and-test-runbook]]
- [[../07_RUNBOOKS/wire-a-consuming-workspace]]
