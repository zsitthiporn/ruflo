/**
 * Regression test for GitHub issue #9.
 *
 * `task create` persisted correctly, but `task list`, `task status <id>`, and
 * `task list --all` were all broken when reading the same store back:
 *   - `task list`        — ID column printed blank
 *   - `task status <id>` — printed "Task: undefined"
 *   - `task list --all`  — printed "No tasks found" against a non-empty store
 *
 * Root causes (all in src/commands/task.ts, the CLI's own render path):
 *   1. task_list / task_status return each record keyed `taskId`, not `id`.
 *      The CLI read `t.id` / `result.id`, which is always undefined.
 *   2. `--all` sent `status: 'all'` literally. task_list's filter treats
 *      `status` as a plain allow-list with no 'all' special case, so it
 *      filtered out every task instead of skipping the filter.
 *   3. `--agent` sent `agentId`, but task_list's filter reads `assignedTo`.
 *
 * This test exercises the REAL round trip: it does NOT mock
 * `../src/mcp-client.js`, so it goes through the actual task_create /
 * task_list / task_status handlers in mcp-tools/task-tools.ts against a
 * real store.json on disk — the thing nothing exercised before #9 shipped.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { taskCommand } from '../src/commands/task.js';
import { callMCPTool } from '../src/mcp-client.js';
import type { CommandContext } from '../src/types.js';

const createCmd = taskCommand.subcommands!.find(c => c.name === 'create')!;
const listCmd = taskCommand.subcommands!.find(c => c.name === 'list')!;
const statusCmd = taskCommand.subcommands!.find(c => c.name === 'status')!;
const cancelCmd = taskCommand.subcommands!.find(c => c.name === 'cancel')!;
const retryCmd = taskCommand.subcommands!.find(c => c.name === 'retry')!;

function baseCtx(): CommandContext {
  return { args: [], flags: { _: [] }, cwd: '/test', interactive: false };
}

describe('#9 — task CLI read path against a store written by task create', () => {
  let root: string;
  let originalCwdEnv: string | undefined;
  let stdout: string;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'ruflo-task-cli-9-'));
    originalCwdEnv = process.env.CLAUDE_FLOW_CWD;
    process.env.CLAUDE_FLOW_CWD = root;

    stdout = '';
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      stdout += typeof chunk === 'string' ? chunk : String(chunk);
      return true;
    });
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

  it('creates a task that survives to disk', async () => {
    const result = await createCmd.action!({
      ...baseCtx(),
      flags: { type: 'bug-fix', description: 'round trip regression', priority: 'high', _: [] },
    });

    expect(result.success).toBe(true);
    const taskId = (result.data as { taskId: string }).taskId;
    expect(taskId).toMatch(/^task-/);

    const stored = JSON.parse(readFileSync(join(root, '.claude-flow', 'tasks', 'store.json'), 'utf-8'));
    expect(stored.tasks[taskId]).toBeDefined();
    expect(stored.tasks[taskId].taskId).toBe(taskId);
  });

  it('task list renders the real task ID, not a blank column (bug 1)', async () => {
    const created = await createCmd.action!({
      ...baseCtx(),
      flags: { type: 'bug-fix', description: 'list should show my id', priority: 'normal', _: [] },
    });
    const taskId = (created.data as { taskId: string }).taskId;

    stdout = '';
    const result = await listCmd.action!({ ...baseCtx(), flags: { _: [] } });

    expect(result.success).toBe(true);
    expect((result.data as { tasks: Array<{ taskId: string }> }).tasks[0].taskId).toBe(taskId);
    // printTable truncates the ID column to width 15 (slice(0,12) + '...'),
    // so assert on a prefix rather than the full (often-longer) ID.
    expect(stdout).toContain(taskId.slice(0, 12));
  });

  it('task status prints the real task ID as the box title, not "undefined" (bug 1)', async () => {
    const created = await createCmd.action!({
      ...baseCtx(),
      flags: { type: 'research', description: 'status should show my id', priority: 'low', _: [] },
    });
    const taskId = (created.data as { taskId: string }).taskId;

    stdout = '';
    const result = await statusCmd.action!({ ...baseCtx(), args: [taskId] });

    expect(result.success).toBe(true);
    expect((result.data as { taskId: string }).taskId).toBe(taskId);
    expect(stdout).toContain(`Task: ${taskId}`);
    expect(stdout).not.toMatch(/Task: undefined/);
  });

  it('task list --all shows tasks instead of "No tasks found" (bug 2)', async () => {
    const created = await createCmd.action!({
      ...baseCtx(),
      flags: { type: 'testing', description: 'all should find me', priority: 'normal', _: [] },
    });
    const taskId = (created.data as { taskId: string }).taskId;

    stdout = '';
    const result = await listCmd.action!({ ...baseCtx(), flags: { all: true, _: [] } });

    expect(result.success).toBe(true);
    expect((result.data as { tasks: Array<{ taskId: string }> }).tasks.map(t => t.taskId)).toContain(taskId);
    expect(stdout).not.toContain('No tasks found matching criteria');
    expect(stdout).toContain(taskId.slice(0, 12));
  });

  it('task list --status all also bypasses the filter, not just --all (bug 2)', async () => {
    await createCmd.action!({
      ...baseCtx(),
      flags: { type: 'testing', description: 'status=all should also find me', priority: 'normal', _: [] },
    });

    const result = await listCmd.action!({ ...baseCtx(), flags: { status: 'all', _: [] } });

    expect(result.success).toBe(true);
    expect((result.data as { tasks: unknown[] }).tasks.length).toBeGreaterThan(0);
  });

  it('task list --agent filters by the real assignee (bug 3)', async () => {
    const target = await createCmd.action!({
      ...baseCtx(),
      flags: { type: 'bug-fix', description: 'assigned to agent-x', priority: 'normal', _: [] },
    });
    const other = await createCmd.action!({
      ...baseCtx(),
      flags: { type: 'bug-fix', description: 'not assigned', priority: 'normal', _: [] },
    });
    const targetId = (target.data as { taskId: string }).taskId;
    const otherId = (other.data as { taskId: string }).taskId;

    // Exercise the real task_assign handler directly (no agent record needed
    // for it to record the assignment) rather than re-deriving CLI plumbing
    // for the `task assign` subcommand, which is out of scope for #9.
    await callMCPTool('task_assign', { taskId: targetId, agentIds: ['agent-x'] });

    const result = await listCmd.action!({ ...baseCtx(), flags: { agent: 'agent-x', all: true, _: [] } });

    expect(result.success).toBe(true);
    const ids = (result.data as { tasks: Array<{ taskId: string }> }).tasks.map(t => t.taskId);
    expect(ids).toContain(targetId);
    expect(ids).not.toContain(otherId);
  });

  it('#14 — task status on a missing task id is reported as an error, not rendered as a task box', async () => {
    stdout = '';
    let stderr = '';
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk: unknown) => {
      stderr += typeof chunk === 'string' ? chunk : String(chunk);
      return true;
    });

    try {
      const result = await statusCmd.action!({ ...baseCtx(), args: ['definitely-does-not-exist-xyz'] });

      // task_status's handler (mcp-tools/task-tools.ts) returns
      // { status: 'not_found', ... } rather than throwing, so the CLI must
      // itself recognize it and fail — not just pass it through to the
      // render path below, which used to print a box full of "undefined"
      // fields indistinguishable from a real, mostly-empty task.
      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);

      // No task box was rendered — this is the pre-fix bug signature.
      expect(stdout).not.toContain('Task: definitely-does-not-exist-xyz');
      expect(stdout).not.toMatch(/Type:\s+undefined/);

      // The failure is actually surfaced to the user (on stderr, where
      // printError writes).
      expect(stderr).toMatch(/not found/i);
    } finally {
      stderrSpy.mockRestore();
    }
  });

  // #17 — task_cancel and task_retry's handlers (mcp-tools/task-tools.ts)
  // return { success: false, error } for an unknown taskId rather than
  // throwing, same as task_status did for #14. The CLI (commands/task.ts)
  // never checked for it, so `task cancel`/`task retry <missing-id>` printed
  // a false "cancelled"/"retried" success and exited 0.
  it('#17 — task cancel on a missing id fails cleanly, not a false success', async () => {
    const result = await cancelCmd.action!({
      ...baseCtx(),
      args: ['definitely-does-not-exist-cancel'],
      flags: { force: true, _: [] },
    });

    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(1);
  });

  it('#17 — task retry on a missing id fails cleanly, not a false success', async () => {
    const result = await retryCmd.action!({
      ...baseCtx(),
      args: ['definitely-does-not-exist-retry'],
    });

    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(1);
  });

  // #17 — task_cancel's handler never returned `previousStatus` on its
  // *success* path either (only the not-found path was missing-id-specific);
  // the CLI's "Previous status: ..." line read `undefined` off every real
  // cancel, not just a missing one. Assert the real prior status survives.
  it('#17 — task cancel on a real task returns the real previousStatus, not undefined', async () => {
    const created = await createCmd.action!({
      ...baseCtx(),
      flags: { type: 'bug-fix', description: 'cancel should report my real prior status', priority: 'normal', _: [] },
    });
    const taskId = (created.data as { taskId: string }).taskId;

    const result = await cancelCmd.action!({
      ...baseCtx(),
      args: [taskId],
      flags: { force: true, _: [] },
    });

    expect(result.success).toBe(true);
    expect((result.data as { previousStatus?: string }).previousStatus).toBe('pending');
  });

  // #17 — fixing the not-found short-circuit required checking
  // `!result.success` in the CLI, but task_retry's success path never set
  // `success: true` (only its two failure paths did). Without adding it,
  // that guard would have misread every successful retry as a failure. This
  // is the case that fix protects — guard it directly.
  it('#17 — task retry on a real task still succeeds and returns a new task id', async () => {
    const created = await createCmd.action!({
      ...baseCtx(),
      flags: { type: 'bug-fix', description: 'retry should still succeed after the success:true fix', priority: 'normal', _: [] },
    });
    const taskId = (created.data as { taskId: string }).taskId;

    const result = await retryCmd.action!({ ...baseCtx(), args: [taskId] });

    expect(result.success).toBe(true);
    expect(result.exitCode).toBeUndefined();

    const newTaskId = (result.data as { newTaskId?: string }).newTaskId;
    expect(newTaskId).toBeDefined();
    expect(newTaskId).toMatch(/^task-/);
    expect(newTaskId).not.toBe(taskId);

    const stored = JSON.parse(readFileSync(join(root, '.claude-flow', 'tasks', 'store.json'), 'utf-8'));
    expect(stored.tasks[newTaskId!]).toBeDefined();
  });
});
