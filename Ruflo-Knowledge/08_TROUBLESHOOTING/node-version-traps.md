---
title: Node Version Traps
summary: The machine's default Node is v16.20.2 but the repo needs 20+; Node 22 IS installed via nvm4w, just not the shell default — costing two agents about 20 minutes each before this was documented.
tags: [troubleshooting, node-version, nvm, environment, windows]
domain: troubleshooting
service: Ruflo
status: active
last_reviewed: 2026-08-15
related: [08_TROUBLESHOOTING/git-bash-tty-shim, 02_ORCHESTRATION/worker-brief-standard]
rag_include: true
retrieval_priority: high
audience: [agent, human]
sensitivity: public
source_of_truth: true
aliases: [fetch is not defined, crypto.getRandomValues is not a function, wrong node version, nvm4w]
aliases_th: [เวอร์ชัน Node ผิด, node 16 กับ node 22]
task_types: [troubleshooting, environment-setup]
---

# Node Version Traps

## Summary

**The machine's default Node drifts — check `node --version` before trusting any note, including this one.** During the incident this note records (2026-08-14) the default was **v16.20.2** against a repo requiring **Node 20+**, surfacing as `fetch is not defined` in scripts or Vite/Vitest dying with `crypto.getRandomValues is not a function`. By 2026-08-15 the default had been switched to **v24.19.0** via nvm4w, which makes those symptoms disappear — but the lesson is version-agnostic: when a repo script fails with a missing-global error, suspect the runtime before the code, and run `nvm list` before concluding a suitable version is not installed (an agent once wrongly concluded exactly that; 22.22.3, 22.13.1, and 18.19.0 were all present). Known-good pinned fallback: `C:\Users\sitth\AppData\Local\nvm\v22.22.3\node.exe`.

## Key Terms

| Term | Meaning |
| --- | --- |
| Default-Node drift | The nvm4w default changes over time (16.20.2 during the incident → 24.19.0 the next day); never hardcode it in a brief without checking |
| Required Node | 20+ for this repo's scripts and test tooling |
| `fetch is not defined` / `crypto.getRandomValues` | The two failure signatures of running under Node < 20 |
| `nvm list` | The command that reveals the other installed versions — do not skip it |
| Pinned fallback | `C:\Users\sitth\AppData\Local\nvm\v22.22.3\node.exe` — call by full path when the default is unsuitable |

## Main Content

### The symptom

Running repo scripts or the test suite under the machine's default Node produces one of two failure signatures:

- **`fetch is not defined`** — surfaces in scripts that assume a global `fetch`, which Node 16 does not provide.
- **`crypto.getRandomValues is not a function`** — Vite and Vitest die with this when run under Node 16, since the API they depend on isn't present at that version.

Both symptoms look like a broken build or a missing dependency. They are neither — they are a Node version mismatch.

### The fix

Node 22.22.3 **is already installed** on this machine via nvm-for-Windows, at:

```text
C:\Users\sitth\AppData\Local\nvm\v22.22.3\node.exe
```

Two ways to use it for a given command or session:

1. Call the binary directly: `C:\Users\sitth\AppData\Local\nvm\v22.22.3\node.exe bin/cli.js …`
2. Prepend its directory to `PATH` for the current shell session only — **do not** switch the machine-wide nvm default, since other work on this machine may depend on the current default.

### Do not skip `nvm list`

`nvm list` on this machine shows multiple installed versions: **22.22.3, 22.13.1, and 18.19.0** — Node 22 is not a hypothetical fix that needs to be installed, it is already present and just not the active default. One agent skipped this check, assumed no alternative Node existed, and wrongly concluded the task was blocked on a missing installation. Running `nvm list` before escalating a Node-version problem as "not installed" would have caught this immediately.

### Cost

This has cost **two separate agents roughly 20 minutes each** — time spent diagnosing the symptom as a build or dependency problem before identifying it as a version mismatch, and in one case, additional time spent on the wrong conclusion that no fix was available on the machine.

## Related Code

- `D:/Project/ME/Ruflo/CLAUDE.md` — engine/version expectations for the repo

## Related Notes

- [[08_TROUBLESHOOTING/git-bash-tty-shim]]
- [[02_ORCHESTRATION/worker-brief-standard]]
