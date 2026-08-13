/**
 * Regression test for GitHub issue #12 (the write-path counterpart to #9).
 *
 * `task create` printed a created task, returned a taskId, and exited 0 —
 * looking like success — while silently dropping data:
 *
 *   1. `--assign` was lost entirely. task_create's handler (mcp-tools/
 *      task-tools.ts) reads `input.assignTo` — its own declared inputSchema
 *      name — but the CLI (commands/task.ts) sent `assignedTo`, a key the
 *      handler never looked at. The task was created unassigned every time.
 *   2. `--parent`, `--dependencies`, and an internally-attached `metadata`
 *      object were collected/sent by the CLI but accepted by neither the
 *      handler's schema nor its storage — discarded on arrival.
 *      `--timeout` got a different, non-mutually-exclusive fix: it was
 *      removed from the CLI surface entirely (see commands/task.ts), because
 *      nothing anywhere in the codebase ever reads a stored task's timeout
 *      for enforcement or displays it back — offering the flag implied
 *      behavior that does not exist.
 *
 * This test exercises the REAL round trip: it does NOT mock
 * `../src/mcp-client.js`, so it goes through the actual task_create /
 * task_list / task_status handlers in mcp-tools/task-tools.ts against a real
 * store.json on disk — same discipline as
 * __tests__/task-command-round-trip-9.test.ts (the read-path sibling fix).
 *
 * Scope note (updated for #13): task_status now returns `dependencies` for
 * real — it's a direct read of the field task_create has persisted since
 * #12, verified below via both `store.json` and the task_status response.
 * `parentId` is a separate, still-open case (task_status doesn't return it
 * either; out of scope for #13, reported to the lead). `dependents`, task
 * logs, and task metrics were removed from the CLI surface entirely (see
 * commands/task.ts) rather than backed, because nothing anywhere generates
 * any of the three.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { taskCommand } from '../src/commands/task.js';
import type { CommandContext } from '../src/types.js';

const createCmd = taskCommand.subcommands!.find(c => c.name === 'create')!;
const listCmd = taskCommand.subcommands!.find(c => c.name === 'list')!;
const statusCmd = taskCommand.subcommands!.find(c => c.name === 'status')!;
const retryCmd = taskCommand.subcommands!.find(c => c.name === 'retry')!;

function baseCtx(): CommandContext {
  return { args: [], flags: { _: [] }, cwd: '/test', interactive: false };
}

function readStore(root: string): { tasks: Record<string, Record<string, unknown>> } {
  return JSON.parse(readFileSync(join(root, '.claude-flow', 'tasks', 'store.json'), 'utf-8'));
}

describe('#12 — task CLI write path: fields collected by the CLI must survive to disk', () => {
  let root: string;
  let originalCwdEnv: string | undefined;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'ruflo-task-cli-12-'));
    originalCwdEnv = process.env.CLAUDE_FLOW_CWD;
    process.env.CLAUDE_FLOW_CWD = root;
    // Silence table/box rendering noise; not asserted on in this file.
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    if (originalCwdEnv === undefined) {
      delete process.env.CLAUDE_FLOW_CWD;
    } else {
      process.env.CLAUDE_FLOW_CWD = originalCwdEnv;
    }
    rmSync(root, { recursive: true, force: true });
  });

  it('--assign survives to store.json, task list, and task status (bug 1)', async () => {
    const created = await createCmd.action!({
      ...baseCtx(),
      flags: { type: 'bug-fix', description: 'assign should stick', priority: 'normal', assign: 'agent-x', _: [] },
    });

    expect(created.success).toBe(true);
    const taskId = (created.data as { taskId: string; assignedTo?: string[] }).taskId;

    // 1. Storage, not display: the record on disk must carry the assignee.
    const stored = readStore(root);
    expect(stored.tasks[taskId].assignedTo).toEqual(['agent-x']);

    // 2. task_create's own response already reflects it.
    expect((created.data as { assignedTo?: string[] }).assignedTo).toEqual(['agent-x']);

    // 3. task list reflects it too (separate read path, already fixed by #9;
    //    re-checked here so a regression in either fix is caught here too).
    const listed = await listCmd.action!({ ...baseCtx(), flags: { all: true, _: [] } });
    const row = (listed.data as { tasks: Array<{ taskId: string; assignedTo?: string[] }> })
      .tasks.find(t => t.taskId === taskId);
    expect(row?.assignedTo).toEqual(['agent-x']);

    // 4. task status reflects it too.
    const status = await statusCmd.action!({ ...baseCtx(), args: [taskId] });
    expect((status.data as { assignedTo?: string[] }).assignedTo).toEqual(['agent-x']);
  });

  it('--parent and --dependencies survive to store.json (bug 2)', async () => {
    const created = await createCmd.action!({
      ...baseCtx(),
      flags: {
        type: 'bug-fix',
        description: 'parent/deps should stick',
        priority: 'normal',
        parent: 'task-parent-1',
        dependencies: 'task-a, task-b',
        _: [],
      },
    });

    expect(created.success).toBe(true);
    const taskId = (created.data as { taskId: string }).taskId;

    const stored = readStore(root);
    expect(stored.tasks[taskId].parentId).toBe('task-parent-1');
    expect(stored.tasks[taskId].dependencies).toEqual(['task-a', 'task-b']);

    // task_create's own response reflects both (both are read back by the
    // handler's return value, unlike task_status — see file header).
    expect((created.data as { parentId?: string }).parentId).toBe('task-parent-1');
    expect((created.data as { dependencies?: string[] }).dependencies).toEqual(['task-a', 'task-b']);

    // #13 — task_status now surfaces `dependencies` too (not just storage
    // and task_create's own echo). `parentId` is intentionally NOT asserted
    // here: task_status still doesn't return it (see file header).
    const status = await statusCmd.action!({ ...baseCtx(), args: [taskId] });
    expect((status.data as { dependencies?: string[] }).dependencies).toEqual(['task-a', 'task-b']);
  });

  it('CLI-attached metadata survives to store.json (bug 2)', async () => {
    const created = await createCmd.action!({
      ...baseCtx(),
      flags: { type: 'bug-fix', description: 'metadata should stick', priority: 'normal', _: [] },
    });

    const taskId = (created.data as { taskId: string }).taskId;
    const stored = readStore(root);
    expect(stored.tasks[taskId].metadata).toEqual({ source: 'cli', createdBy: 'user' });
  });

  it('no timeout field is written to store.json — the flag was removed, not silently accepted', async () => {
    const created = await createCmd.action!({
      ...baseCtx(),
      // Even if a caller still sets ctx.flags.timeout directly (bypassing
      // the CLI's own option parser, which no longer defines --timeout at
      // all), the create action must not forward it into the MCP payload.
      flags: { type: 'bug-fix', description: 'timeout must not appear', priority: 'normal', timeout: 999, _: [] },
    });

    const taskId = (created.data as { taskId: string }).taskId;
    const stored = readStore(root);
    expect(stored.tasks[taskId]).not.toHaveProperty('timeout');

    const createOptionNames = createCmd.options?.map(o => o.name) ?? [];
    expect(createOptionNames).not.toContain('timeout');
  });

  it('#14 — task retry carries over parentId and dependencies (same structural position)', async () => {
    const created = await createCmd.action!({
      ...baseCtx(),
      flags: {
        type: 'bug-fix', description: 'retry should keep my parent/deps', priority: 'normal',
        parent: 'task-parent-1', dependencies: 'task-a, task-b', _: [],
      },
    });
    const originalId = (created.data as { taskId: string }).taskId;

    const retried = await retryCmd.action!({ ...baseCtx(), args: [originalId] });
    expect(retried.success).toBe(true);
    const newTaskId = (retried.data as { newTaskId: string }).newTaskId;

    // 1. Storage: task_retry's handler (mcp-tools/task-tools.ts) must clone
    //    parentId/dependencies onto the new record, not just type/priority/
    //    assignedTo/tags as it did before #14.
    const stored = readStore(root);
    expect(stored.tasks[newTaskId].parentId).toBe('task-parent-1');
    expect(stored.tasks[newTaskId].dependencies).toEqual(['task-a', 'task-b']);

    // 2. task_retry's own response echoes both back (same pattern as
    //    task_create's response).
    expect((retried.data as { parentId?: string }).parentId).toBe('task-parent-1');
    expect((retried.data as { dependencies?: string[] }).dependencies).toEqual(['task-a', 'task-b']);

    // 3. task_status renders both for the new task too — #13 made
    //    parentId/dependencies real, rendered fields, which is exactly why a
    //    retry silently dropping them became a live, visible bug ("None")
    //    instead of a harmless gap. Capture the actual rendered table text
    //    (not just the .data payload) so this proves the display surface,
    //    not only storage — beforeEach mocks stdout to discard by default,
    //    so accumulate locally for this one call.
    let rendered = '';
    stdoutSpy.mockImplementation((chunk: unknown) => {
      rendered += typeof chunk === 'string' ? chunk : String(chunk);
      return true;
    });
    const status = await statusCmd.action!({ ...baseCtx(), args: [newTaskId] });
    stdoutSpy.mockImplementation(() => true);

    expect((status.data as { parentId?: string }).parentId).toBe('task-parent-1');
    expect((status.data as { dependencies?: string[] }).dependencies).toEqual(['task-a', 'task-b']);
    // The table renders "Property | Value" columns without a literal colon,
    // so assert on the real values appearing (replacing what would render as
    // "None" pre-fix) rather than a colon-joined string that the renderer
    // never produces.
    expect(rendered).toContain('task-parent-1');
    expect(rendered).toContain('task-a, task-b');

    // The original record is untouched (retry clones, it doesn't mutate).
    expect(stored.tasks[originalId].parentId).toBe('task-parent-1');
    expect(stored.tasks[originalId].dependencies).toEqual(['task-a', 'task-b']);
  });

  it('#14 — task retry does not copy metadata (creation-event provenance stays with the original)', async () => {
    const created = await createCmd.action!({
      ...baseCtx(),
      flags: { type: 'bug-fix', description: 'retry should not inherit my metadata', priority: 'normal', _: [] },
    });
    const originalId = (created.data as { taskId: string }).taskId;

    // The CLI always attaches { source: 'cli', createdBy: 'user' } on create
    // (see the 'CLI-attached metadata survives to store.json' test above),
    // so its absence on the retry is a meaningful, deliberate assertion —
    // not a tautology from an empty field to begin with.
    const preRetryStore = readStore(root);
    expect(preRetryStore.tasks[originalId].metadata).toEqual({ source: 'cli', createdBy: 'user' });

    const retried = await retryCmd.action!({ ...baseCtx(), args: [originalId] });
    const newTaskId = (retried.data as { newTaskId: string }).newTaskId;

    const stored = readStore(root);
    expect(stored.tasks[newTaskId]).not.toHaveProperty('metadata');
    // The original's own metadata must survive untouched.
    expect(stored.tasks[originalId].metadata).toEqual({ source: 'cli', createdBy: 'user' });
  });
});
