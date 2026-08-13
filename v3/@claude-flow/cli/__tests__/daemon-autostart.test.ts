/**
 * Self-running daemon auto-start — single-instance, opt-IN (default OFF,
 * issue #10), safe.
 *
 * Updated for the #10 default flip: RUFLO_DAEMON_AUTOSTART now means "turn
 * it ON" (1|true|on|yes) instead of "turn it off" (0|false|no|off), and the
 * default with nothing set is OFF. Tests below that exist to exercise a
 * DIFFERENT gate (alive-check, isRufloProject, …) now explicitly opt in via
 * RUFLO_DAEMON_AUTOSTART=1 so they still reach the gate they're testing.
 * Tests for the opt-in gate itself are new/rewritten.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  ensureDaemonRunning,
  isDaemonAlive,
  isRufloProject,
} from '../src/services/daemon-autostart.js';
import { applyChampion } from '../src/config/harness-feedback-applier.js';

function project(): string {
  const cwd = mkdtempSync(join(tmpdir(), 'daemon-as-'));
  mkdirSync(join(cwd, '.claude-flow'), { recursive: true });
  writeFileSync(join(cwd, '.claude-flow', 'config.yaml'), 'version: 3\n');
  return cwd;
}

describe('ensureDaemonRunning', () => {
  const saved = process.env.RUFLO_DAEMON_AUTOSTART;
  afterEach(() => { if (saved === undefined) delete process.env.RUFLO_DAEMON_AUTOSTART; else process.env.RUFLO_DAEMON_AUTOSTART = saved; });

  it('issue #10: default is OFF — nothing set means no spawn, even in a ruflo project with no daemon alive', () => {
    delete process.env.RUFLO_DAEMON_AUTOSTART;
    const cwd = project();
    let spawned = 0;
    const r = ensureDaemonRunning(cwd, { isAlive: () => false, spawnFn: () => { spawned++; } });
    expect(r.started).toBe(false);
    expect(r.reason).toMatch(/opt-in/);
    expect(spawned).toBe(0);
  });

  it('opts in via RUFLO_DAEMON_AUTOSTART=1 and starts (spawns) when no daemon is alive', () => {
    process.env.RUFLO_DAEMON_AUTOSTART = '1';
    const cwd = project();
    let spawned = 0;
    const r = ensureDaemonRunning(cwd, { isAlive: () => false, spawnFn: () => { spawned++; } });
    expect(r.started).toBe(true);
    expect(spawned).toBe(1);
  });

  it('accepts true/on/yes (case-insensitive) as opt-in, same as 1', () => {
    const cwd = project();
    for (const value of ['true', 'On', 'YES']) {
      process.env.RUFLO_DAEMON_AUTOSTART = value;
      let spawned = 0;
      const r = ensureDaemonRunning(cwd, { isAlive: () => false, spawnFn: () => { spawned++; } });
      expect(r.started).toBe(true);
      expect(spawned).toBe(1);
    }
  });

  it('is a no-op when a daemon is already alive (single-instance) — opted in, testing the alive-check gate specifically', () => {
    process.env.RUFLO_DAEMON_AUTOSTART = '1';
    let spawned = 0;
    const r = ensureDaemonRunning(project(), { isAlive: () => true, spawnFn: () => { spawned++; } });
    expect(r.started).toBe(false);
    expect(r.reason).toMatch(/already running/);
    expect(spawned).toBe(0);
  });

  it('RUFLO_DAEMON_AUTOSTART=0 still means off (unchanged for anyone who already set it pre-#10)', () => {
    process.env.RUFLO_DAEMON_AUTOSTART = '0';
    let spawned = 0;
    const r = ensureDaemonRunning(project(), { isAlive: () => false, spawnFn: () => { spawned++; } });
    expect(r.started).toBe(false);
    expect(r.reason).toMatch(/opt-in/);
    expect(spawned).toBe(0);
  });

  it('does not spawn in a non-ruflo directory — opted in, testing the isRufloProject gate specifically', () => {
    process.env.RUFLO_DAEMON_AUTOSTART = '1';
    const cwd = mkdtempSync(join(tmpdir(), 'not-ruflo-'));
    let spawned = 0;
    const r = ensureDaemonRunning(cwd, { isAlive: () => false, spawnFn: () => { spawned++; } });
    expect(r.started).toBe(false);
    expect(spawned).toBe(0);
  });

  it('does not treat a Claude Code-only .claude directory as Ruflo initialization (#2834)', () => {
    process.env.RUFLO_DAEMON_AUTOSTART = '1';
    const cwd = mkdtempSync(join(tmpdir(), 'claude-only-'));
    mkdirSync(join(cwd, '.claude'), { recursive: true });
    writeFileSync(join(cwd, '.claude', 'settings.json'), '{}');
    let spawned = 0;
    const r = ensureDaemonRunning(cwd, { isAlive: () => false, spawnFn: () => { spawned++; } });
    expect(r).toEqual({ started: false, reason: 'not a ruflo project' });
    expect(spawned).toBe(0);
    expect(existsSync(join(cwd, '.claude-flow'))).toBe(false);
  });

  it('does not let startup-created policy state authorize daemon auto-start (#2852)', () => {
    process.env.RUFLO_DAEMON_AUTOSTART = '1';
    const cwd = mkdtempSync(join(tmpdir(), 'claude-policy-only-'));
    mkdirSync(join(cwd, '.claude'), { recursive: true });
    writeFileSync(
      join(cwd, '.claude', 'proven-config.json'),
      JSON.stringify({ championId: `sha256:${'a'.repeat(64)}` }),
    );

    // This mirrors the startup ordering in CLI.run(): applying a shipped
    // champion creates .claude-flow before daemon auto-start is evaluated.
    expect(applyChampion(cwd).applied).toBe(true);
    expect(existsSync(join(cwd, '.claude-flow'))).toBe(true);
    expect(isRufloProject(cwd)).toBe(false);

    let spawned = 0;
    const result = ensureDaemonRunning(cwd, {
      isAlive: () => false,
      spawnFn: () => { spawned++; },
    });
    expect(result).toEqual({ started: false, reason: 'not a ruflo project' });
    expect(spawned).toBe(0);
  });

  it('recognizes only explicit Ruflo markers, not generic state directories', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'ruflo-markers-'));
    mkdirSync(join(cwd, '.claude-flow'), { recursive: true });
    expect(isRufloProject(cwd)).toBe(false);

    writeFileSync(join(cwd, '.claude-flow', 'config.json'), '{}');
    expect(isRufloProject(cwd)).toBe(true);
  });

  it('project config daemon.autostart:true opts in even with the env var unset (new capability, #10)', () => {
    delete process.env.RUFLO_DAEMON_AUTOSTART;
    const cwd = project();
    writeFileSync(join(cwd, 'claude-flow.config.json'), JSON.stringify({ daemon: { autostart: true } }));
    let spawned = 0;
    const r = ensureDaemonRunning(cwd, { isAlive: () => false, spawnFn: () => { spawned++; } });
    expect(r.started).toBe(true);
    expect(spawned).toBe(1);
  });

  it('project config daemon.autostart:false still forces it off, even under a globally-exported opt-in env var (unchanged behavior, just inverted default)', () => {
    process.env.RUFLO_DAEMON_AUTOSTART = '1';
    const cwd = project();
    writeFileSync(join(cwd, 'claude-flow.config.json'), JSON.stringify({ daemon: { autostart: false } }));
    let spawned = 0;
    const r = ensureDaemonRunning(cwd, { isAlive: () => false, spawnFn: () => { spawned++; } });
    expect(r.started).toBe(false);
    expect(r.reason).toMatch(/opt-in/);
    expect(spawned).toBe(0);
  });

  it('a malformed claude-flow.config.json fails open to "no opinion" and falls back to the env var, rather than getting stuck either on or off', () => {
    const cwd = project();
    writeFileSync(join(cwd, 'claude-flow.config.json'), 'this is not valid json {{{');

    // Falls back to the (unset) env var -> off.
    delete process.env.RUFLO_DAEMON_AUTOSTART;
    let spawnedOff = 0;
    const rOff = ensureDaemonRunning(cwd, { isAlive: () => false, spawnFn: () => { spawnedOff++; } });
    expect(rOff.started).toBe(false);
    expect(spawnedOff).toBe(0);

    // Falls back to the env var when it IS set -> on. Proves the malformed
    // file doesn't silently pin the result to "disabled" regardless of intent.
    process.env.RUFLO_DAEMON_AUTOSTART = '1';
    let spawnedOn = 0;
    const rOn = ensureDaemonRunning(cwd, { isAlive: () => false, spawnFn: () => { spawnedOn++; } });
    expect(rOn.started).toBe(true);
    expect(spawnedOn).toBe(1);
  });

  it('a config file present but without a daemon.autostart key falls back to the env var (unrelated keys do not force a state)', () => {
    const cwd = project();
    writeFileSync(join(cwd, 'claude-flow.config.json'), JSON.stringify({ funnel: { enabled: false } }));

    delete process.env.RUFLO_DAEMON_AUTOSTART;
    let spawnedOff = 0;
    expect(ensureDaemonRunning(cwd, { isAlive: () => false, spawnFn: () => { spawnedOff++; } }).started).toBe(false);
    expect(spawnedOff).toBe(0);

    process.env.RUFLO_DAEMON_AUTOSTART = '1';
    let spawnedOn = 0;
    expect(ensureDaemonRunning(cwd, { isAlive: () => false, spawnFn: () => { spawnedOn++; } }).started).toBe(true);
    expect(spawnedOn).toBe(1);
  });
});

describe('isDaemonAlive', () => {
  it('false + cleans a stale pidfile for a dead pid', () => {
    const cwd = project();
    const pidFile = join(cwd, '.claude-flow', 'daemon.pid');
    writeFileSync(pidFile, '999999999'); // almost certainly not a live pid
    expect(isDaemonAlive(cwd)).toBe(false);
    expect(existsSync(pidFile)).toBe(false); // stale file cleaned
  });

  it('false when no pidfile', () => {
    expect(isDaemonAlive(project())).toBe(false);
  });

  it('true for a live pid (our own test process, written as the pid)', () => {
    // Using a DIFFERENT live pid: the test can only prove liveness of a real pid.
    // process.ppid is alive and != our pid, so it should read as alive.
    const cwd = project();
    writeFileSync(join(cwd, '.claude-flow', 'daemon.pid'), String(process.ppid));
    expect(isDaemonAlive(cwd)).toBe(true);
  });
});
