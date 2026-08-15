---
title: Decision — Opt-In Registry Callbacks
summary: ADR — auto-update, helper-refresh, proven-config-adoption, and daemon-autostart were all opt-out by default; the decision made all four opt-in in source defaults, since a fresh workspace should be safe without anyone remembering an env var.
tags: [decision, adr, opt-in, auto-update, daemon-autostart, safe-defaults]
domain: decisions
service: Ruflo
status: active
last_reviewed: 2026-08-15
related: [05_SECURITY/registry-decoupling, 08_TROUBLESHOOTING/stray-daemon-processes, 05_SECURITY/upstream-telemetry-removal]
rag_include: true
retrieval_priority: normal
audience: [agent, human]
sensitivity: public
source_of_truth: true
aliases: [opt-in defaults decision, safe by default ADR, auto-update opt-in]
aliases_th: [การตัดสินใจตั้งค่าเริ่มต้นแบบต้องเปิดเอง]
task_types: [decision-record, security-audit, dependency-management]
---

# Decision — Opt-In Registry Callbacks

## Summary

ADR recording the switch of four previously opt-out behaviors — auto-update, helper-refresh, proven-config-adoption, and daemon-autostart — to opt-in **in source defaults**. The prior state was safe only if nobody forgot to set a disabling environment variable; the new state is safe with no configuration at all. The objection that this "affects existing users" was treated as void, since this is a private fork with one user whose explicit goal is removing surprises, not a public project weighing a breaking-change cost against a broad user base.

## Key Terms

| Term | Meaning |
| --- | --- |
| Opt-out (prior state) | Behavior runs by default; a user must know to set a variable to disable it |
| Opt-in (chosen state) | Behavior does not run by default; a user must explicitly enable it |
| `.LOCKED` markers | A prior belt-and-braces safeguard, now demoted to secondary since opt-in is the primary safeguard |

## Main Content

### Context

Four distinct automatic behaviors were opt-out by default: auto-update (running `npm install` from cwd unprompted), helper-refresh (overwriting local helper files), proven-config-adoption (adopting remote configuration automatically — the third path found mid-task with no opt-out at all, per [[05_SECURITY/registry-decoupling]]), and daemon-autostart (spawning a background daemon as a side effect of nearly any CLI command, per [[08_TROUBLESHOOTING/stray-daemon-processes]]). Each was individually safe only under the assumption that a user or operator had already set the right environment variable to turn it off.

### Options considered

1. **Keep opt-out, document better.** Leave the defaults as-is and rely on documentation to tell users which variables to set. Rejected implicitly: this is the status quo that produced the stray-daemon PID incident and the silent auto-update/refresh/adoption risk in the first place — documentation does not prevent a forgotten variable.
2. **Opt-in in source defaults (chosen).** Flip all four behaviors so the default, with zero configuration, is "does not run."
3. **Keep `.LOCKED` marker files as the primary safeguard.** Rely on marker files that block the behavior when present, without changing the underlying default.

### Decision

**All four are now opt-in in source defaults**, gated behind explicit environment variables: `CLAUDE_FLOW_AUTO_UPDATE`, `RUFLO_HELPERS_AUTO_REFRESH`, `RUFLO_PROVEN_CONFIG_AUTO_ADOPT`, and daemon-autostart's own opt-in gate.

### Consequences

- **A fresh workspace is safe by default**, with no setup step required — cloning the repo and running a command does not trigger a network fetch, a file overwrite, a config adoption, or a stray daemon.
- **`.LOCKED` marker files are demoted to belt-and-braces**, a secondary safeguard rather than the primary one — the primary safeguard is now the default itself being off.
- **Helper-refresh tests needed adjustment**: tests exercising the auto-refresh path now require `RUFLO_HELPERS_AUTO_REFRESH=1` set explicitly in `beforeEach`, since the behavior no longer fires implicitly.
- **The "affects existing users" objection was treated as void** for this fork specifically: it is a private fork with exactly one user, whose stated goal for this whole line of work is *removing* surprises, not preserving a legacy default for a user base that does not exist here. This reasoning would not automatically transfer to a fork or project with real external users depending on the old defaults.

### Reopen-when

Reopen if this fork ever gains real external users who depend on the current opt-in defaults being opt-out instead — at that point the "no user base to break" reasoning above no longer holds and the tradeoff needs to be re-evaluated on its own terms.

## Related Code

- `v3/@claude-flow/cli/src/update/index.ts`, `v3/@claude-flow/cli/src/update/rate-limiter.ts` — auto-update opt-in gate
- `v3/@claude-flow/cli/src/init/helper-refresh.ts` — helper-refresh opt-in gate
- `v3/@claude-flow/cli/src/config/proven-config-refresh.ts` — proven-config-adoption opt-in gate
- `v3/@claude-flow/cli/src/services/daemon-autostart.ts` — daemon-autostart opt-in gate

## Related Notes

- [[05_SECURITY/registry-decoupling]]
- [[08_TROUBLESHOOTING/stray-daemon-processes]]
- [[05_SECURITY/upstream-telemetry-removal]]
