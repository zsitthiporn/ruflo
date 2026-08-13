/**
 * Issue #10 — the fork must stay inside the project workspace it was
 * pointed at. Three regressions fixed here:
 *
 * 1. `.claude-flow/policy/state.json` resolved from the real process.cwd()
 *    instead of the CLAUDE_FLOW_CWD-aware getProjectCwd() that task/session/
 *    memory already honor (policy-runtime.ts). Every exported policy-runtime
 *    function's default parameter, and the authorizeMcpTool() MCP-dispatch
 *    fallback (the effective resolution path for a live MCP session, since
 *    mcp-server.ts's context never carries an explicit projectRoot), now
 *    default to getProjectCwd() instead of process.cwd().
 * 2. Informational commands (--help/-h) must write nothing: policy state
 *    (index.ts's migration call, guarded) AND the daemon-autostart block
 *    (index.ts's `commandPath[0] !== 'daemon' && !flags.help && !flags.h`)
 *    are both skipped for --help/-h now. (--version already wrote nothing
 *    pre-fix — it returns before the migration block in index.ts, and
 *    bin/cli.js short-circuits it even earlier. That is a regression guard
 *    here, not a new fix.)
 * 3. `ensureDaemonRunning` (fired for nearly every command, not just
 *    `memory init`) used to resolve its workspace the same broken way, AND
 *    the spawned `daemon start` child re-derived its own root from an
 *    inherited OS cwd / env var instead of an explicit argument — two
 *    values that happened to agree only because nothing in the chain read
 *    the inherited CLAUDE_FLOW_CWD. buildDaemonSpawnPlan() now stamps the
 *    resolved root into argv (--workspace), the spawn cwd, AND the child's
 *    env in one place, so all three agree by construction. Separately
 *    flipped to opt-in/default-off (RUFLO_DAEMON_AUTOSTART=1|true|on|yes, or
 *    daemon.autostart:true in claude-flow.config.json) — see
 *    daemon-autostart.test.ts for that gate's own coverage; not repeated
 *    here.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  autoMigratePolicyStateIfNeeded,
  authorizeMcpTool,
  loadPolicyState,
} from '../src/services/policy-runtime.js';
import { callMCPTool } from '../src/mcp-client.js';
import {
  buildDaemonSpawnPlan,
  ensureDaemonRunning,
} from '../src/services/daemon-autostart.js';
import { resolveWorkspaceFlag } from '../src/commands/daemon.js';

const dirs: string[] = [];
function scratchDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  dirs.push(dir);
  return dir;
}

const savedCwdEnv = process.env.CLAUDE_FLOW_CWD;
const savedDaemonEnv = process.env.RUFLO_DAEMON_AUTOSTART;

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
  if (savedCwdEnv === undefined) delete process.env.CLAUDE_FLOW_CWD;
  else process.env.CLAUDE_FLOW_CWD = savedCwdEnv;
  if (savedDaemonEnv === undefined) delete process.env.RUFLO_DAEMON_AUTOSTART;
  else process.env.RUFLO_DAEMON_AUTOSTART = savedDaemonEnv;
});

describe('issue #10 — policy state honors CLAUDE_FLOW_CWD, not raw process.cwd()', () => {
  it('autoMigratePolicyStateIfNeeded() with no explicit root resolves against CLAUDE_FLOW_CWD', async () => {
    const pinnedRoot = scratchDir('issue10-pinned-');
    mkdirSync(join(pinnedRoot, '.claude-flow'), { recursive: true });
    // Simulate the escape scenario directly: process.env pinned to pinnedRoot,
    // while the function is called with NO argument (the fixed default).
    process.env.CLAUDE_FLOW_CWD = pinnedRoot;
    const result = await autoMigratePolicyStateIfNeeded();
    expect(result.statePath).toBe(join(pinnedRoot, '.claude-flow', 'policy', 'state.json'));
    expect(existsSync(result.statePath!)).toBe(true);
  });

  it('the pre-fix call shape (explicit process.cwd()) is what used to cause the escape — regression guard on the mechanism', async () => {
    const pinnedRoot = scratchDir('issue10-pinned-');
    const decoyCwd = scratchDir('issue10-decoy-');
    mkdirSync(join(pinnedRoot, '.claude-flow'), { recursive: true });
    mkdirSync(join(decoyCwd, '.claude-flow'), { recursive: true });
    process.env.CLAUDE_FLOW_CWD = pinnedRoot;

    // Old index.ts:148 called autoMigratePolicyStateIfNeeded(process.cwd())
    // explicitly, which overrides the fixed default and reproduces the bug
    // on demand — proves the fix is index.ts passing getProjectCwd() now,
    // not merely the function's own default changing.
    const escaped = await autoMigratePolicyStateIfNeeded(decoyCwd);
    expect(escaped.statePath).toBe(join(decoyCwd, '.claude-flow', 'policy', 'state.json'));
    expect(existsSync(join(pinnedRoot, '.claude-flow', 'policy', 'state.json'))).toBe(false);
  });

  it('authorizeMcpTool() falls back to CLAUDE_FLOW_CWD when context carries no projectRoot — the real mcp-server.ts:642 shape', async () => {
    const pinnedRoot = scratchDir('issue10-mcp-pinned-');
    mkdirSync(join(pinnedRoot, '.claude-flow'), { recursive: true });
    process.env.CLAUDE_FLOW_CWD = pinnedRoot;

    // mcp-server.ts builds { sessionId } only — no projectRoot. Reproduce
    // that context shape exactly.
    const decision = await authorizeMcpTool('memory_status', {}, { sessionId: 'mcp-test-session' }, {
      actionType: 'memory.read',
    });
    expect(decision.enforcedOutcome).toBe('allowed');
    expect(loadPolicyState(pinnedRoot).receipts).toHaveLength(1);
  });

  it('callMCPTool() end-to-end (mcp-client.ts unmodified) lands the authorization receipt under the pinned root', async () => {
    const pinnedRoot = scratchDir('issue10-callmcp-pinned-');
    mkdirSync(join(pinnedRoot, '.claude-flow'), { recursive: true });
    process.env.CLAUDE_FLOW_CWD = pinnedRoot;

    // { sessionId } only, exactly like mcp-server.ts:642 — no projectRoot
    // threaded through. Authorization runs (and writes its receipt) before
    // the handler executes, so this proves the write location even though
    // memory_stats itself may fail/return unusable data in a bare scratch dir.
    await callMCPTool('memory_stats', {}, { sessionId: 'mcp-test-session' }).catch(() => {});
    expect(loadPolicyState(pinnedRoot).receipts.length).toBeGreaterThanOrEqual(1);
  });
});

describe('issue #10 — daemon-autostart resolves its workspace consistently by construction', () => {
  it('buildDaemonSpawnPlan stamps the SAME resolved root into argv --workspace, spawn cwd, and env.CLAUDE_FLOW_CWD', () => {
    const root = scratchDir('issue10-daemon-plan-');
    // Deliberately pass a DIFFERENT inherited CLAUDE_FLOW_CWD to prove the
    // plan does not just forward process.env verbatim — it overwrites the
    // var to agree with the resolved root (the "trap" the lead flagged:
    // cwd and inherited env disagreeing silently).
    process.env.CLAUDE_FLOW_CWD = scratchDir('issue10-daemon-decoy-env-');

    const plan = buildDaemonSpawnPlan(root);

    // 1) argv: --workspace is stamped LAST, matching commands/daemon.ts's
    //    own resolveWorkspaceFlag() precedence and the #1914 convention
    //    (daemonCommandLineBelongsToWorkspace expects it as the final token).
    expect(plan.args.slice(-2)).toEqual(['--workspace', root]);
    // 2) spawn cwd agrees.
    expect(plan.options.cwd).toBe(root);
    // 3) inherited env is overwritten to agree too, not left disagreeing.
    expect((plan.options.env as Record<string, string>).CLAUDE_FLOW_CWD).toBe(root);
    // 4) round-trip through the CHILD's own validation (commands/daemon.ts,
    //    the same function the real `daemon start` action calls at
    //    `resolveWorkspaceFlag(ctx.flags.workspace) ?? process.cwd()`): what
    //    the child would parse out of the stamped --workspace argument
    //    resolves to exactly the same path we handed it as `cwd`. This is
    //    the closest safe proxy to observing the spawned daemon's actual
    //    root without running `daemon start` for real.
    expect(resolveWorkspaceFlag(plan.args.at(-1))).toBe(plan.options.cwd);
  });

  it('ensureDaemonRunning forwards whatever root it is given straight to the spawn function (index.ts wiring is what selects getProjectCwd())', () => {
    // spawnFn is injected below (never the real defaultSpawn), so this is
    // safe to run opted in — no OS-level process is ever created regardless
    // of RUFLO_DAEMON_AUTOSTART. Opt-in is required post-#10 (default off);
    // this test is about root forwarding, not the opt-in gate itself (see
    // daemon-autostart.test.ts for that).
    process.env.RUFLO_DAEMON_AUTOSTART = '1';
    const root = scratchDir('issue10-daemon-ensure-');
    mkdirSync(join(root, '.claude-flow'), { recursive: true });
    // isRufloProject() needs a real marker file, not just the bare dir —
    // matches the existing daemon-autostart.test.ts fixtures.
    writeFileSync(join(root, '.claude-flow', 'config.json'), '{}');

    let capturedRoot: string | undefined;
    const result = ensureDaemonRunning(root, {
      isAlive: () => false,
      spawnFn: (projectRoot) => { capturedRoot = projectRoot; },
    });
    expect(result.started).toBe(true);
    expect(capturedRoot).toBe(root);
  });

  it('never actually spawns (RUFLO_DAEMON_AUTOSTART=0 short-circuits before buildDaemonSpawnPlan runs) — safety net for this test file', () => {
    process.env.RUFLO_DAEMON_AUTOSTART = '0';
    const root = scratchDir('issue10-daemon-optout-');
    mkdirSync(join(root, '.claude-flow'), { recursive: true });
    let spawned = 0;
    const result = ensureDaemonRunning(root, { isAlive: () => false, spawnFn: () => { spawned++; } });
    expect(result.started).toBe(false);
    expect(spawned).toBe(0);
  });
});
