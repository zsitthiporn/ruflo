---
title: Verify A Wired Workspace
summary: A paste-ready smoke prompt that proves a newly wired workspace runs this fork, keeps its state to itself, and does not leak into the fork's own repo — with the two false alarms that waste time if you do not know about them.
tags: [runbook, smoke-test, mcp, workspace-isolation, onboarding]
domain: runbook
service: Ruflo
status: active
last_reviewed: 2026-08-16
related: [wire-a-consuming-workspace, ../01_ARCHITECTURE/state-layer, ../02_ORCHESTRATION/hub-and-spoke-doctrine]
rag_include: true
retrieval_priority: high
audience: [agent, human]
sensitivity: public
source_of_truth: true
aliases: [smoke test a workspace, verify wiring, is the MCP server the fork, workspace isolation test, pilot readiness check]
aliases_th: [ทดสอบการเดินสาย, เช็คว่าใช้ fork จริงไหม, ทดสอบ workspace ใหม่]
task_types: [runbook, mcp-setup, onboarding, troubleshooting]
note_role: focused
routing_intents: [verify-a-new-workspace, prove-state-isolation]
---

# Verify A Wired Workspace

## Summary

After following [[wire-a-consuming-workspace]], run this before trusting the
workspace with real work. The prompt below is pasted into a **fresh Claude Code
session opened at the target workspace** — not at this repo — and reports
pass/fail per check.

The design principle: most of the checks confirm the wiring *works*; **check 4
confirms it does not leak**. That is the one that matters. A workspace can pass
every "does it work" check while silently writing into the fork's own state,
because both directions look identical from inside the new workspace.

## Key Terms

| Term | Meaning |
| --- | --- |
| Foreign cwd | A working directory that is not the workspace — the shape an MCP server actually runs in, and the shape that has broken isolation before |
| Leak | State from workspace A landing under workspace B (or under this fork's repo) |
| False alarm | A check that looks like a failure but is a known, harmless quirk — two of them are documented below |

## Main Content

### The prompt

Replace `<WORKSPACE>` with the target's absolute path and `<FORK>` with this
repo's path. The expected version is whatever `package.json` currently declares
— check it rather than trusting the number written here.

```text
โหมดทดสอบการเดินสาย — ห้ามเขียน product code ใดๆ และห้ามเริ่มงานจริง

<WORKSPACE> เพิ่งถูกเดินสายเข้ากับ ruflo fork ที่ <FORK> (ไม่ใช่ package จาก npm
registry) ช่วยตรวจ 8 ข้อนี้แล้วรายงานเป็นตาราง ผ่าน/ไม่ผ่าน พร้อมค่าที่เห็นจริง
ถ้าข้อไหนไม่ผ่าน ให้บอกว่าเห็นค่าอะไรแทน อย่าพยายามซ่อมเอง

1. MCP server ต่อติดไหม — มี tool ชื่อขึ้นต้น mcp__claude-flow__ หรือไม่
   (ถ้าเห็นเป็น mcp__ruflo__ แปลว่า key ผิด = ไม่ผ่าน)

2. เรียก mcp__claude-flow__system_info แล้วเช็ค:
   - version ต้องตรงกับที่ fork ประกาศไว้ (ไม่ใช่เวอร์ชันที่ใหม่กว่าจาก registry)
   - cwd ต้องเป็น <WORKSPACE> ไม่ใช่ <FORK> และไม่ใช่ temp
   หมายเหตุ: ตอน MCP handshake มันรายงาน serverInfo.version = "3.0.0" ซึ่งเป็น
   string ที่ hardcode ไว้ (issue #18) ไม่ใช่สัญญาณผิดปกติ — ให้ยึด system_info

3. สร้าง task ทดสอบ: mcp__claude-flow__task_create
   type=research, description="WIRING-TEST — ลบทิ้งได้"
   แล้วเช็คว่าไฟล์โผล่ที่ <WORKSPACE>\.claude-flow\tasks\store.json

4. เช็คว่า <FORK>\.claude-flow\tasks\store.json **ไม่ถูกแตะ**
   (จำนวน entries ต้องเท่าเดิม และต้องไม่มีคำว่า WIRING-TEST อยู่ในนั้น)
   — นี่คือข้อสำคัญที่สุด ถ้าพลาดแปลว่า state รั่วข้ามโปรเจค

5. เช็คว่าไม่มีโฟลเดอร์ .claude-flow หรือ .swarm โผล่ที่อื่นนอกจาก <WORKSPACE> root

6. เช็คว่า skill "team-lead" โหลดได้ และสรุปให้ฟัง 3 บรรทัดว่าใน workspace นี้
   ใครเป็นคนเขียน board / ใครเป็นคน merge / worker ห้ามทำอะไรบ้าง

7. ทดสอบ Agent Teams: dispatch subagent read-only หนึ่งตัว ชื่อ "probe"
   ให้มันอ่านเอกสารออกแบบของโปรเจคหนึ่งไฟล์ แล้วตอบกลับมาเป็นคำเดียว/บรรทัดเดียว
   ห้ามให้มันแก้ไฟล์ ห้ามให้มันรัน ruflo CLI

8. ลบ task ทดสอบทิ้ง แล้วลบโฟลเดอร์ <WORKSPACE>\.claude-flow ให้เกลี้ยง
   ยืนยันว่าลบแล้วจริง

ห้ามทำ: ห้ามรัน `ruflo init`, ห้ามแก้ .mcp.json, ห้าม npm/npx install อะไรทั้งสิ้น,
ห้ามสร้างไฟล์ใหม่นอกจาก state ที่ระบบเขียนเอง
```

### Why each check earns its place

| # | Proves |
| --- | --- |
| 1 | The registration key is `claude-flow`. A `ruflo` key exposes the tools as `mcp__ruflo__*` and silently breaks the ~166 `mcp__claude-flow__*` references in the plugins |
| 2 | The running server is **this fork**, and `CLAUDE_FLOW_CWD` reached the process |
| 3 | State is written, and written to the right root |
| 4 | **State does not leak.** The only check that can catch cross-workspace contamination |
| 5 | No nested state directories from a stray cwd |
| 6 | The doctrine is loaded, not just the tools |
| 7 | Agent Teams works — the layer all delegated work depends on, and usually the least exercised |
| 8 | The pilot starts from clean state rather than test residue |

### The two false alarms

Both of these look like failures and are not. Knowing them in advance is most
of this note's value.

1. **`serverInfo.version` reports `3.0.0` at handshake.** It is a hardcoded
   string (`bin/cli.js`, tracked as issue #18), unrelated to the real version.
   Read `system_info` instead, which reports the true one.
2. **`.claude-flow/` is absent before the first tool call.** Wiring alone
   creates nothing; the directory appears when state is first written. An empty
   workspace is the expected pre-state, not a broken one.

### Worked example — Textlens, 2026-08-16

The wiring was verified before this prompt existed, by driving the server
directly rather than through a session: spawned exactly as `.mcp.json` declares
it, from the system temp directory (a foreign cwd), then sent `initialize` and
`task_create` over stdio.

```
server: ruflo 3.0.0        <- the hardcoded string, see false alarm 1
task_create ok: true
-> D:\Project\ME\Textlens\.claude-flow\tasks\store.json   created
-> D:\Project\ME\Ruflo   board                            7 entries, untouched
-> neural dir under the Textlens pin                      D:\Project\ME\Textlens\.claude-flow\neural
```

That direct form is the faster check when a session is not open yet, and it
tests the same invariants as steps 2–5. The session prompt additionally covers
6 and 7, which cannot be reached without a real session.

## Related Code

- `D:/Project/ME/Ruflo/bin/cli.js` — the entry a wired `.mcp.json` must invoke
- `v3/@claude-flow/cli/src/mcp-tools/types.ts` — re-exports `getProjectCwd()`, the pin every state path resolves through

## Related Notes

- [[wire-a-consuming-workspace]]
- [[../01_ARCHITECTURE/state-layer]]
- [[../02_ORCHESTRATION/hub-and-spoke-doctrine]]
