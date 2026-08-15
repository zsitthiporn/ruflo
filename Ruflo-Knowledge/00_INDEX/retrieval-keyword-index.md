---
title: Retrieval Keyword Index
summary: Normalized keywords and aliases, including Thai, for searching the Ruflo knowledge vault.
tags: [index, retrieval, aliases, semantic-search]
domain: knowledge-index
service: Ruflo
status: active
last_reviewed: 2026-08-15
related: [knowledge-index, task-entrypoints, troubleshooting-index]
rag_include: true
retrieval_priority: high
audience: [agent, human]
sensitivity: public
source_of_truth: true
aliases: [retrieval keyword index, alias map, semantic search aliases]
aliases_th: [คำค้น, ชื่อเรียกระบบ, ค้นความรู้]
task_types: [routing, alias-resolution]
note_role: router
routing_intents: [routing, alias-resolution]
---

# Retrieval Keyword Index

## Summary

Normalized keywords and aliases, including the Thai terms the user actually types, for searching the Ruflo knowledge vault.

## Key Terms

| Term | Meaning |
| --- | --- |
| Domain | knowledge-index |
| Related system | Ruflo |
| `retrieval keyword index` | Search keyword |
| `aliases` | Search keyword |
| `Thai aliases` | Search keyword |

## Main Content

| Keyword Or Alias | Canonical Note |
| --- | --- |
| Ruflo, claude-flow fork, ruvnet/ruflo fork, zsitthiporn/ruflo | [[../SYSTEM_CONTEXT]] |
| team lead, หัวหน้าทีม, single voice to user | [[../02_ORCHESTRATION/hub-and-spoke-doctrine]] |
| hub-and-spoke, team style, ทีม, agent team | [[../02_ORCHESTRATION/team-style-goal]], [[../02_ORCHESTRATION/hub-and-spoke-doctrine]] |
| เริ่มงาน, start task, agent bootstrap, bootstrap | [[../11_AI/agent-start]] |
| task board, บอร์ดงาน, store.json, .claude-flow/tasks | [[../02_ORCHESTRATION/internal-board-mechanics]] |
| verification tiers, ตรวจงาน, proof tier, light/medium/heavy proof | [[../02_ORCHESTRATION/verification-tiers]] |
| worker brief, dispatch brief, ownership set | [[../02_ORCHESTRATION/worker-brief-standard]] |
| monorepo layout, package map, v3/@claude-flow, workspace protocol | [[../01_ARCHITECTURE/monorepo-layout]] |
| CLI surface, MCP surface, bin/cli.js, mcp start | [[../01_ARCHITECTURE/cli-and-mcp-surface]] |
| state layer, memory backend, AgentDB, task store persistence | [[../01_ARCHITECTURE/state-layer]] |
| build and dist, tsc, prepublishOnly, bundling, stage-internal-runtime-bundles | [[../01_ARCHITECTURE/build-and-dist]] |
| helper system, hook-handler.cjs, intelligence.cjs, helpers.manifest.json | [[../01_ARCHITECTURE/helper-system]] |
| build and test runbook, npm run build, npm test | [[../07_RUNBOOKS/build-and-test-runbook]] |
| wire a consuming workspace, npm link, install this fork elsewhere | [[../07_RUNBOOKS/wire-a-consuming-workspace]] |
| upstream rebase, merge upstream, ruvnet upstream sync | [[../07_RUNBOOKS/upstream-rebase-runbook]] |
| helper signing, ลายเซ็น helper, sign-helpers.mjs, Ed25519 | [[../07_RUNBOOKS/helper-signing-runbook]], [[../05_SECURITY/helper-signing-key]] |
| publishing, npm publish, pnpm publish, dist-tag | [[../07_RUNBOOKS/publishing-runbook]] |
| registry decoupling, ตัดขาด upstream, npx ruflo@latest vs node bin/cli.js | [[../05_SECURITY/registry-decoupling]] |
| telemetry removal, upstream telemetry, phone-home | [[../05_SECURITY/upstream-telemetry-removal]] |
| node version, ปัญหา node, Node.js version trap | [[../08_TROUBLESHOOTING/node-version-traps]] |
| git bash tty, stdin is not a tty, node.exe shim | [[../08_TROUBLESHOOTING/git-bash-tty-shim]] |
| stray daemon, orphaned mcp process, concurrent sessions | [[../08_TROUBLESHOOTING/stray-daemon-processes]] |
| lockfile substitution, registry substitution, npm resolves upstream package | [[../08_TROUBLESHOOTING/lockfile-registry-substitution]] |
| fake session restore, %SESSION_ID%, session-end writes nothing | [[../08_TROUBLESHOOTING/fake-session-restore-output]] |
| self-matching diagnostics, doctor false positive, health check matches its own echo | [[../08_TROUBLESHOOTING/self-matching-diagnostics]] |
| workspace protocol decision, workspace:*, pnpm workspace | [[../09_DECISIONS/decision-workspace-protocol]] |
| fork-owned signing key decision, ~/.ruflo/helpers-signing.key | [[../09_DECISIONS/decision-fork-owned-signing-key]] |
| opt-in registry callbacks decision | [[../09_DECISIONS/decision-opt-in-registry-callbacks]] |
| declined features decision | [[../09_DECISIONS/decision-declined-features]] |
| package rename declined decision | [[../09_DECISIONS/decision-package-rename-declined]] |
| coordination surface honesty, task tools, teammate-idle, task-completed, worker-dispatch | [[../11_AI/honest-status-of-coordination-surfaces]] |
| markdown note standard, frontmatter | [[../12_STANDARDS/markdown-note-standard]] |
| troubleshooting, ปัญหา, incident | [[troubleshooting-index]] |
| task entrypoints, routing, workflow | [[task-entrypoints]] |

## Related Code

- `D:/Project/ME/Ruflo`

## Related Notes

- [[knowledge-index]]
- [[task-entrypoints]]
- [[troubleshooting-index]]
