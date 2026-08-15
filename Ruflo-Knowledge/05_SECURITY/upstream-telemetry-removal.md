---
title: Upstream Telemetry Removal
summary: Upstream's marketing/telemetry subsystem — sponsor-tagged config writes, a session-fetched ad host, and a rate-limit ad injected into transcripts — was deleted from the fork rather than gated, tracked as issue #11.
tags: [security, telemetry, privacy, funnel, deletion-over-gating]
domain: security
service: Ruflo
status: active
last_reviewed: 2026-08-15
related: [05_SECURITY/registry-decoupling, 09_DECISIONS/decision-opt-in-registry-callbacks, 02_ORCHESTRATION/hub-and-spoke-doctrine]
rag_include: true
retrieval_priority: normal
audience: [agent, human]
sensitivity: public
source_of_truth: true
aliases: [funnel removal, COGNITUM ad, sponsor spinnerVerbs, telemetry deletion issue 11]
aliases_th: [การลบระบบเทเลเมทรีต้นทาง, โฆษณาที่แทรกในทรานสคริปต์]
task_types: [security-audit, privacy, telemetry]
---

# Upstream Telemetry Removal

## Summary

Upstream's marketing subsystem — tracked and removed under issue `#11` — wrote sponsor-tagged content into Claude Code's own settings file by default with no visible disclosure, fetched an ad-serving host every session, printed a `[COGNITUM]` ad into the transcript when rate-limited, and attributed statusline clicks to the same host. All of it was **deleted**, not gated, on the reasoning that a gate is exactly what a future rebase can silently flip back on.

## Key Terms

| Term | Meaning |
| --- | --- |
| `spinnerVerbs` | Sponsor-tagged strings the SessionStart hook wrote into Claude Code's own `~/.claude/settings.json` |
| `funnel.ruv.io` | The ad/marketing host fetched every session, with local caches under `~/.ruflo` |
| `[COGNITUM]` ad | Text injected into the transcript specifically when the user was rate-limited |
| Deletion over gating | The chosen remediation style — remove the code path entirely rather than add an off switch |
| `src/funnel/*.ts` | The subsystem's source location, now guarded by a static scan test |

## Main Content

### What was found

The removed subsystem had four distinct behaviors, none of them disclosed in a way a user would actually see:

1. **`SessionStart` hook writes into Claude Code's own config.** It wrote sponsor-tagged `spinnerVerbs` into `~/.claude/settings.json` — not the fork's own config, Claude Code's — by default, with `--yes` passed and `stdio` ignored, meaning whatever disclosure text existed for this behavior was never actually displayed to the user running the session.
2. **Per-session fetch to an ad host.** `funnel.ruv.io` was contacted on every session start, with response caches written under `~/.ruflo`.
3. **Rate-limit ad injection.** A `[COGNITUM]` ad string was printed directly into the transcript specifically when the user hit a rate limit — found not by reading the source, but by a **guard test asserting on the generator's output**, i.e. the injected text was caught empirically rather than spotted in a code review.
4. **Statusline click attribution** routed through the same ad-serving host as the session fetch.

### Why deletion instead of gating

The remediation removed the write path in `events.ts` and the broader subsystem entirely, rather than adding an environment-variable gate to disable it (the pattern used elsewhere for the opt-in behaviors in [[09_DECISIONS/decision-opt-in-registry-callbacks]]). The reasoning: **a gate is exactly what a future upstream rebase can flip back to its old default**, silently, the same way the helper-signing pubkey constant can be silently reverted on a bad merge (see [[05_SECURITY/helper-signing-key]]). Deleting the code path removes it from the merge surface entirely — there is no toggle for a rebase to accidentally restore to "on."

### What was kept

The write path in `events.ts` is disabled, but the **delete/inspect helpers were kept**. This lets a user who ran a previous version of the tool — before this removal — clear out whatever data those earlier sessions already wrote, without needing to reintroduce the writing code to do it.

### The guard test

A regression test now scans `src/funnel/*.ts` for any of: an HTTP import, a `fetch` call, a reference to `ruv.io`, or a `child_process` import. This is a static content scan against the *output* of the funnel subsystem's source, not a runtime check — it is designed to fail loudly if a future rebase or refactor reintroduces network calls into this directory, closing the same class of "silently reintroduced on merge" risk described above.

## Related Code

- `v3/@claude-flow/cli/src/funnel/` — the subsystem directory: `events.ts`, `disclosure.ts`, `consent.ts`, `promo.ts`, `rate-limit-notifier.ts`, `state.ts`, and others
- `v3/@claude-flow/cli/src/funnel/events.ts` — the write path that was disabled

## Related Notes

- [[05_SECURITY/registry-decoupling]]
- [[09_DECISIONS/decision-opt-in-registry-callbacks]]
- [[02_ORCHESTRATION/hub-and-spoke-doctrine]]
