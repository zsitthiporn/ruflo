---
title: Git Bash TTY Shim
summary: In Git Bash, the nvm4w node shim fails on piped stdin with "stdin is not a tty"; use node.exe directly. PowerShell and cmd are unaffected.
tags: [troubleshooting, git-bash, windows, node-shim, stdin]
domain: troubleshooting
service: Ruflo
status: active
last_reviewed: 2026-08-15
related: [08_TROUBLESHOOTING/node-version-traps, 02_ORCHESTRATION/worker-brief-standard]
rag_include: true
retrieval_priority: high
audience: [agent, human]
sensitivity: public
source_of_truth: true
aliases: [stdin is not a tty, node shim git bash, node.exe workaround]
aliases_th: [ปัญหา stdin ใน Git Bash, ต้องใช้ node.exe]
task_types: [troubleshooting, environment-setup]
---

# Git Bash TTY Shim

## Summary

In **Git Bash**, the `node` command is an nvm-for-Windows (nvm4w) shim that fails with `stdin is not a tty` whenever it receives piped stdin. The fix is to call `node.exe` directly instead of `node`. **PowerShell** and `cmd` run plain `node` fine — this is a Git-Bash-specific shim behavior, not a general Windows Node problem. It has bitten at least one agent into believing the build itself was broken.

## Key Terms

| Term | Meaning |
| --- | --- |
| nvm4w shim | The `node` wrapper script nvm-for-Windows installs, used to dispatch to the active Node version |
| `stdin is not a tty` | The error the shim throws when it receives piped (non-interactive) stdin in Git Bash |
| `node.exe` | The real Node binary — bypasses the shim's stdin check entirely |

## Main Content

### The trap

Git Bash on this machine resolves `node` to an nvm-for-Windows shim script, not the Node binary directly. That shim performs a TTY check on stdin as part of its dispatch logic. When a command pipes data into `node` (`echo … | node script.js`, or any tool that invokes `node` with piped/non-interactive stdin), the shim's TTY check fails and it throws:

```text
stdin is not a tty
```

This error has nothing to do with the script being run, the Node version, or the repo's build — it is purely an artifact of the shim rejecting the specific stdin shape Git Bash handed it. It has been mistaken for a genuinely broken build by at least one agent before this trap was documented, costing debugging time chasing a nonexistent build failure.

### The fix

Call `node.exe` explicitly instead of `node` when working in Git Bash:

```bash
node.exe bin/cli.js …
```

`node.exe` is the real Node binary and bypasses the shim's stdin/TTY check entirely.

### Shell-specific — not a general Windows problem

- **Git Bash**: affected — use `node.exe`.
- **PowerShell**: unaffected — the primary shell on this machine, and plain `node bin/cli.js …` runs fine there.
- **cmd**: unaffected — plain `node bin/cli.js …` runs fine there too.

Because PowerShell is the primary shell on this machine, this trap mostly matters when a worker or script specifically invokes Git Bash (POSIX shell scripts, `.sh` files, or an agent defaulting to bash-style invocation).

## Related Code

- `D:/Project/ME/Ruflo/CLAUDE.md` — "One shell trap, confirmed on this machine" callout at the top of the file

## Related Notes

- [[08_TROUBLESHOOTING/node-version-traps]]
- [[02_ORCHESTRATION/worker-brief-standard]]
