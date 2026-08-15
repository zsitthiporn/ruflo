---
title: Self-Matching Diagnostics
summary: Two live incidents where a diagnostic search matched itself — a grep counting its own explanatory comments, a process check matching the shell running it. Rule: a suspiciously dirty result indicts the query first.
tags: [troubleshooting, diagnostics, false-positive, grep, process-check, self-reference]
domain: troubleshooting
service: Ruflo
status: active
last_reviewed: 2026-08-15
related: [02_ORCHESTRATION/verification-tiers, 08_TROUBLESHOOTING/stray-daemon-processes, 02_ORCHESTRATION/hub-and-spoke-doctrine]
rag_include: true
retrieval_priority: normal
audience: [agent, human]
sensitivity: public
source_of_truth: true
aliases: [grep matches its own comment, process check matches itself, suspiciously dirty result, self-matching trap]
aliases_th: [การค้นหาที่จับผลลัพธ์ของตัวเอง, ผลลัพธ์สกปรกผิดปกติ]
task_types: [troubleshooting, verification, review]
---

# Self-Matching Diagnostics

## Summary

Two live incidents produced the same lesson: a diagnostic query can match **itself** rather than the thing it's checking for, and the resulting false positive looks exactly like a real finding unless you specifically account for it. A grep for a deprecated pattern counted its own fix's explanatory comment as a hit; a process check for a running daemon matched the shell process executing the check. The rule that follows: **a suspiciously dirty result indicts the query first** — filter by process name and command shape, exclude comments, before believing a scan.

## Key Terms

| Term | Meaning |
| --- | --- |
| Self-matching | A search or check whose own output/artifact satisfies the pattern it's testing for |
| Suspiciously dirty result | A count or match list higher than expected, in a way that should prompt query review before conclusion |
| Comment exclusion | Filtering out matches that occur inside explanatory comments referencing the pattern, not using it |

## Main Content

### Incident 1 — the grep that counted its own comment

A search for a deprecated `npx …@latest` pattern (part of the sweep described in [[05_SECURITY/registry-decoupling]]) returned **4 hits**. Three of those four were not remaining instances of the problem — they were the **fix's own explanatory comment**, written to document what pattern had been removed and why, sitting in the same file as the fix. A naive read of "4 hits" would have suggested the fix was incomplete; the real remaining-instance count was 1.

### Incident 2 — the process check that matched its own shell

A check for a running `daemon start` process, described in [[08_TROUBLESHOOTING/stray-daemon-processes]], used a command-line text match that was loose enough to also match the PowerShell or bash process **currently executing the check itself** — since that process's own command line contained the search text. This produced PIDs that churned on every invocation of the check, looking like contamination or a runaway process, when it was actually the diagnostic re-detecting itself each time it ran.

### The rule

**A suspiciously dirty result indicts the query first, not the system under test.** Before treating an unexpectedly high match count as evidence of a real problem:

- **Exclude comments** from pattern matches when checking for remaining instances of removed code, not just literal usage.
- **Filter process checks by process name AND command shape**, not command-line substring alone — a substring match is exactly what let the shell running the check match itself.
- Ask whether the artifact being searched could plausibly contain the diagnostic's own trace (a fix's comment, a wrapper script's own invocation) before concluding the count reflects the real world.

This is not a one-off gotcha specific to these two incidents — it is a general property of any diagnostic that searches a live system or a codebase that includes the diagnostic's own recent changes. See [[02_ORCHESTRATION/verification-tiers]] for where this fits into the broader proof-tier discipline.

## Related Code

_(No specific file — this is a diagnostic-methodology pattern observed across the registry-cleanup grep and the daemon-process check described in the related notes below.)_

## Related Notes

- [[02_ORCHESTRATION/verification-tiers]]
- [[08_TROUBLESHOOTING/stray-daemon-processes]]
- [[02_ORCHESTRATION/hub-and-spoke-doctrine]]
- [[05_SECURITY/registry-decoupling]]
