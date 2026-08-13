/**
 * Self-running daemon (auto-start).
 *
 * The self-optimizing loop's workers (distillation, backup, and the future
 * evolve worker) are inert unless the daemon runs — but it required a manual
 * `ruflo daemon start`. This can run a daemon on ordinary CLI use, SAFELY:
 *
 *   - single-instance: only starts when no live daemon holds the pidfile, and
 *     the spawned `daemon start` independently enforces single-instance via its
 *     own lock + checkExistingDaemon() — so a race spawns at most one survivor,
 *   - bounded lifetime: the daemon self-terminates on TTL/idle (12h hard TTL,
 *     30m idle default; RUFLO_DAEMON_TTL_SECS / RUFLO_DAEMON_IDLE_SECS) —
 *     auto-start never means "runs forever",
 *   - issue #10 (opt-IN, default OFF): a background process that outlives its
 *     command, with its own writer touching a store that has no write
 *     locking, is not something to start without being asked. Explicit
 *     opt-in via RUFLO_DAEMON_AUTOSTART=1|true|on|yes, OR a project-local
 *     `{ "daemon": { "autostart": true } }` in claude-flow.config.json — the
 *     file-based path exists because the env var only reaches a process that
 *     inherited it. A non-interactive shell (cron, CI, many tool-invoked
 *     shells — bash skips ~/.bashrc entirely for these; see its own
 *     `case $- in *i*) ;; *) return;; esac` guard) never re-sources a shell
 *     rc file per invocation, so `export RUFLO_DAEMON_AUTOSTART=1` in one
 *     such shell does NOT persist to the next one. A project config field has
 *     no such gap — it's read fresh from disk every time, independent of
 *     which shell (or whether any shell at all) launched the command. The
 *     config file is authoritative when present (either direction), so
 *     `daemon.autostart: false` still forces it off even under a
 *     globally-exported RUFLO_DAEMON_AUTOSTART=1 — anyone who already relied
 *     on the pre-#10 opt-out keeps working exactly the same; RUFLO_DAEMON_
 *     AUTOSTART=0 also still means off, same as before, just now redundant
 *     with the new default,
 *   - cheap: a pidfile read + a signal-0 liveness check on the fast path,
 *   - best-effort + silent-on-failure: never blocks or fails a command. When
 *     it DOES start something, the caller (index.ts) announces it in a way
 *     that survives --quiet — see the writeErrorln call there instead of
 *     printInfo.
 *
 * Reuses `daemon start` verbatim (all its lock/TTL/worker machinery) — this
 * module only decides WHETHER to spawn, never reimplements the daemon.
 */
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

/** True if a live daemon already holds the project's pidfile. */
export function isDaemonAlive(projectRoot: string): boolean {
  const pidFile = path.join(projectRoot, '.claude-flow', 'daemon.pid');
  try {
    if (!fs.existsSync(pidFile)) return false;
    const pid = parseInt(fs.readFileSync(pidFile, 'utf-8').trim(), 10);
    if (Number.isNaN(pid) || pid === process.pid) return false;
    process.kill(pid, 0); // signal 0 = existence check
    return true;
  } catch {
    // Dead process → stale pidfile. Clean it so `daemon start` proceeds cleanly.
    try { fs.unlinkSync(pidFile); } catch { /* ignore */ }
    return false;
  }
}

/**
 * Project-local override: `{ "daemon": { "autostart": <bool> } }` in
 * claude-flow.config.json. Returns `undefined` when the file is absent,
 * malformed, or doesn't set the key — the parse error must fail OPEN to "no
 * opinion" (fall through to the env var), never silently force a state
 * either way.
 */
function projectAutostartConfig(projectRoot: string): boolean | undefined {
  try {
    const raw = fs.readFileSync(path.join(projectRoot, 'claude-flow.config.json'), 'utf-8');
    const cfg = JSON.parse(raw);
    return typeof cfg?.daemon?.autostart === 'boolean' ? cfg.daemon.autostart : undefined;
  } catch {
    return undefined; // absent/malformed config = no opinion, defer to the env var
  }
}

/**
 * Issue #10: default OFF. Explicit opt-in only — RUFLO_DAEMON_AUTOSTART set
 * to a truthy value, or a project config that says so. A project config
 * verdict (either direction) wins over the env var when present.
 */
function autostartEnabled(projectRoot: string): boolean {
  const configured = projectAutostartConfig(projectRoot);
  if (configured !== undefined) return configured;
  return /^(1|true|on|yes)$/i.test(process.env.RUFLO_DAEMON_AUTOSTART ?? '');
}

/**
 * Return true only when the directory contains a durable Ruflo project marker.
 *
 * A bare `.claude/` is owned by Claude Code, and a bare `.claude-flow/` is not
 * sufficient either: startup-time policy/champion migration can create it
 * before this function runs. Treating that mutation as authorization caused a
 * read-only command in any Claude project to spawn a detached daemon (#2852).
 */
export function isRufloProject(projectRoot: string): boolean {
  const root = path.resolve(projectRoot);
  const directMarkers = [
    path.join(root, '.claude-flow', 'config.yaml'),
    path.join(root, '.claude-flow', 'config.yml'),
    path.join(root, '.claude-flow', 'config.json'),
    path.join(root, 'claude-flow.config.json'),
    path.join(root, '.swarm', 'memory.db'),
  ];
  if (directMarkers.some((marker) => fs.existsSync(marker))) return true;

  try {
    const settings = JSON.parse(
      fs.readFileSync(path.join(root, '.claude', 'settings.json'), 'utf-8'),
    );
    if (settings && typeof settings === 'object' && 'claudeFlow' in settings) {
      return true;
    }
  } catch { /* absent/malformed/non-Ruflo settings */ }

  try {
    const mcp = JSON.parse(fs.readFileSync(path.join(root, '.mcp.json'), 'utf-8'));
    const servers = mcp?.mcpServers;
    if (servers && typeof servers === 'object'
      && ('ruflo' in servers || 'claude-flow' in servers)) {
      return true;
    }
  } catch { /* absent/malformed/non-Ruflo MCP config */ }

  return false;
}

export interface EnsureResult { started: boolean; reason?: string }

/** Spawn `daemon start` detached, reusing all its lock/TTL machinery. Injectable for tests. */
export type SpawnDaemonFn = (projectRoot: string) => void;

export interface DaemonSpawnPlan {
  command: string;
  args: string[];
  options: Record<string, unknown>;
}

/**
 * Build the exact spawn plan for the detached `daemon start` launcher.
 *
 * Root resolution must agree BY CONSTRUCTION, not by coincidence (issue #10).
 * The daemon's own `daemon start` action (commands/daemon.ts) resolves its
 * workspace as `resolveWorkspaceFlag(ctx.flags.workspace) ?? process.cwd()`
 * — it never reads CLAUDE_FLOW_CWD. Previously we relied on the spawn's
 * `cwd:` option (the child's OS working directory) happening to equal the
 * caller's already-resolved `projectRoot`, with the inherited
 * CLAUDE_FLOW_CWD env var along for the ride but unread by anything in the
 * chain — correct today only because nothing consults it. Stamping
 * `--workspace <root>` explicitly removes that coincidence: the child's own
 * flag resolution outranks its cwd, so root selection no longer depends on
 * the two staying in sync. We also overwrite CLAUDE_FLOW_CWD in the child's
 * env to match, so any other code in the daemon process that reads that var
 * (now or later) agrees with the same root rather than a stale inherited
 * value.
 */
export function buildDaemonSpawnPlan(projectRoot: string): DaemonSpawnPlan {
  const resolvedRoot = path.resolve(projectRoot);
  const cliBin = process.argv[1]; // the running bin/cli.js
  return {
    command: process.execPath,
    args: [cliBin, 'daemon', 'start', '--quiet', '--workspace', resolvedRoot],
    options: {
      cwd: resolvedRoot,
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, CLAUDE_FLOW_CWD: resolvedRoot },
    },
  };
}

const defaultSpawn: SpawnDaemonFn = (projectRoot) => {
  const plan = buildDaemonSpawnPlan(projectRoot);
  const child = spawn(plan.command, plan.args, plan.options);
  child.unref();
};

/**
 * Ensure a daemon is running for `projectRoot`. No-op unless explicitly
 * opted in (issue #10 — default OFF) or one is already alive. Best-effort;
 * never throws.
 */
export function ensureDaemonRunning(
  projectRoot: string,
  opts: { spawnFn?: SpawnDaemonFn; isAlive?: (root: string) => boolean } = {},
): EnsureResult {
  try {
    if (!autostartEnabled(projectRoot)) {
      return {
        started: false,
        reason: 'autostart is opt-in, default off (set RUFLO_DAEMON_AUTOSTART=1 or daemon.autostart:true in claude-flow.config.json to enable)',
      };
    }
    if (!isRufloProject(projectRoot)) {
      return { started: false, reason: 'not a ruflo project' };
    }
    const alive = (opts.isAlive ?? isDaemonAlive)(projectRoot);
    if (alive) return { started: false, reason: 'already running' };
    (opts.spawnFn ?? defaultSpawn)(projectRoot);
    return { started: true };
  } catch (e) {
    return { started: false, reason: `error: ${(e as Error)?.message ?? e}` };
  }
}
