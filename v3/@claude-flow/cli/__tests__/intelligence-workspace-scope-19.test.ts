/**
 * #19 — learned neural patterns must not cross project boundaries.
 *
 * The store used to resolve from raw `process.cwd()` and, when that directory
 * had no `.claude-flow`, fall back to a single unnamespaced
 * `~/.claude-flow/neural` shared by every project on the machine. Under MCP the
 * server's cwd is not the workspace, so that fallback was the normal path, not
 * an edge case: patterns distilled from one repo were retrieved as "relevant"
 * while working in an unrelated one.
 */

import { describe, expect, it, afterEach, beforeEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { getNeuralDataDir } from '../src/memory/intelligence.js';

const HOME_NEURAL = resolve(join(homedir(), '.claude-flow', 'neural'));

describe('#19 — neural pattern store is scoped to the workspace', () => {
  const originalCwd = process.cwd();
  const originalPin = process.env.CLAUDE_FLOW_CWD;
  let scratch: string;

  beforeEach(() => {
    scratch = mkdtempSync(join(tmpdir(), 'ruflo-neural-scope-'));
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (originalPin === undefined) delete process.env.CLAUDE_FLOW_CWD;
    else process.env.CLAUDE_FLOW_CWD = originalPin;
    rmSync(scratch, { recursive: true, force: true });
  });

  it('honours CLAUDE_FLOW_CWD even before .claude-flow exists on disk', () => {
    // A freshly wired workspace on its first run. The pin is an instruction,
    // not a hint — the old code required the directory to already exist and
    // therefore silently ignored the pin exactly when it mattered most.
    process.env.CLAUDE_FLOW_CWD = scratch;
    process.chdir(tmpdir());

    expect(resolve(getNeuralDataDir())).toBe(resolve(join(scratch, '.claude-flow', 'neural')));
  });

  it('uses the project directory when cwd already has .claude-flow', () => {
    delete process.env.CLAUDE_FLOW_CWD;
    mkdirSync(join(scratch, '.claude-flow'), { recursive: true });
    process.chdir(scratch);

    expect(resolve(getNeuralDataDir())).toBe(resolve(join(scratch, '.claude-flow', 'neural')));
  });

  it('never returns the shared home store, and keeps two project-less roots apart', () => {
    delete process.env.CLAUDE_FLOW_CWD;

    const a = mkdtempSync(join(tmpdir(), 'ruflo-neural-a-'));
    const b = mkdtempSync(join(tmpdir(), 'ruflo-neural-b-'));
    try {
      process.chdir(a);
      const dirA = resolve(getNeuralDataDir());
      process.chdir(b);
      const dirB = resolve(getNeuralDataDir());

      // The regression itself: both used to be exactly HOME_NEURAL.
      expect(dirA).not.toBe(HOME_NEURAL);
      expect(dirB).not.toBe(HOME_NEURAL);
      expect(dirA).not.toBe(dirB);

      // Still under the home store, just namespaced per workspace.
      expect(dirA.startsWith(HOME_NEURAL)).toBe(true);
      expect(dirB.startsWith(HOME_NEURAL)).toBe(true);
    } finally {
      process.chdir(originalCwd);
      rmSync(a, { recursive: true, force: true });
      rmSync(b, { recursive: true, force: true });
    }
  });

  it('is stable across calls for the same root', () => {
    process.env.CLAUDE_FLOW_CWD = scratch;
    expect(getNeuralDataDir()).toBe(getNeuralDataDir());
  });
});
