---
title: Stray Daemon Processes
summary: Nearly every CLI command used to auto-spawn a daemon rooted at raw process.cwd() — ignoring CLAUDE_FLOW_CWD — once causing a scratch-dir command to spawn a daemon against the live repo. Now opt-in, with a self-matching trap in the diagnostic query itself.
tags: [troubleshooting, daemon, process-management, opt-in, incident, windows]
domain: troubleshooting
service: Ruflo
status: active
last_reviewed: 2026-08-15
related: [09_DECISIONS/decision-opt-in-registry-callbacks, 08_TROUBLESHOOTING/self-matching-diagnostics]
rag_include: true
retrieval_priority: normal
audience: [agent, human]
sensitivity: public
source_of_truth: true
aliases: [daemon auto-spawn, stray daemon pid incident, CLAUDE_FLOW_CWD ignored, memory init daemon]
aliases_th: [เดมอนหลงเหลือ, เดมอนสร้างเองโดยไม่ตั้งใจ]
task_types: [troubleshooting, process-management, incident-response]
---

# Stray Daemon Processes

## Summary

Formerly, nearly every CLI command auto-spawned a background daemon rooted at the raw `process.cwd()` of the process that invoked it — ignoring the `CLAUDE_FLOW_CWD` override entirely. This once caused an agent's `task create`, run from a pinned scratch directory, to spawn a daemon pointed at the **live repository** instead — a PID incident that was only resolved by killing the process with explicit user approval. Daemon auto-start is now opt-in; `--help` starts nothing; the spawn plan stamps one consistent root into argv, cwd, and the child's environment together. Checking for stray daemons has its own trap: a loose process filter matches the very diagnostic shell running the check.

## Key Terms

| Term | Meaning |
| --- | --- |
| `process.cwd()` root bug | Daemon spawn logic used the invoking process's raw cwd, not the intended/overridden workspace root |
| `CLAUDE_FLOW_CWD` | The env var meant to pin the daemon's working root — was being ignored by the old spawn path |
| Opt-in daemon start | Current default — a CLI command does not start a daemon unless explicitly asked |
| Self-matching trap | A process filter for "daemon running" matching the shell that's running the filter itself |

## Main Content

### The original bug

The daemon-autostart logic rooted its spawned daemon at `process.cwd()` — the working directory of whatever process happened to invoke the CLI command — rather than respecting `CLAUDE_FLOW_CWD` when it was set. In one concrete incident, an agent ran `task create` from a **pinned scratch directory** specifically to avoid touching the live repository, and the auto-spawn logic nonetheless started a daemon rooted at the live repo path. This produced a stray, unintended daemon process attached to the wrong working tree — a PID that had to be identified and killed, with the kill only performed after explicit user approval (destructive process termination is not something an agent does unilaterally).

**`memory init`** had the same auto-spawn behavior and the same bug — it was not limited to the `daemon` command family.

### The fix

Daemon starting is now **opt-in**: a CLI command does not spawn a background daemon as a side effect of running. `--help` in particular starts nothing at all, closing the specific failure mode where even an informational command could trigger a spawn. When a daemon *is* explicitly started, the spawn plan now stamps **one consistent root** into three places together — the process argv, the child process's cwd, and the child process's environment — so there is no longer a path where the daemon's actual working root can drift from what the caller intended.

This CLAUDE_FLOW_CWD-honoring fix in the CLI's project-root default is tracked in commit `576bc9fb9` ("fix(metaharness): honour CLAUDE_FLOW_CWD in the CLI project-root default").

### Checking for stray daemons — and its own trap

The correct check for a stray daemon on Windows:

```powershell
Get-CimInstance Win32_Process | Where-Object {
  $_.Name -eq 'node.exe' -and $_.CommandLine -match 'cli\.js.+daemon'
}
```

A **looser** match is not safe to use here: filtering only on command text containing something like `daemon start` risks matching the PowerShell or bash process that is running the check itself, since the diagnostic command's own command line contains that text. This is a specific instance of the general self-matching-diagnostics trap — see [[08_TROUBLESHOOTING/self-matching-diagnostics]] — and it applies with extra force to process checks, since the shell running the check is itself a process on the same machine being scanned.

## Related Code

- `v3/@claude-flow/cli/src/services/daemon-autostart.ts` — daemon auto-start logic and opt-in gate
- `v3/@claude-flow/cli/src/commands/daemon.ts` — `daemon` command family

## Related Notes

- [[09_DECISIONS/decision-opt-in-registry-callbacks]]
- [[08_TROUBLESHOOTING/self-matching-diagnostics]]
