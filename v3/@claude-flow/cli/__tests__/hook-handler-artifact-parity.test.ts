/**
 * Drift guard: `.claude/helpers/hook-handler.cjs` (root) vs.
 * `v3/@claude-flow/cli/.claude/helpers/hook-handler.cjs` (package).
 *
 * These are two committed copies of the same critical helper (ADR-174) — the
 * package copy is what ships; the root copy is this repo's own dogfood
 * install. They are NOT generated from `helpers-generator.ts`'s
 * `generateHookHandler()` — that function is a deliberately simpler inline
 * fallback used only when copying the real file from the package fails
 * (see its own doc comment), so comparing against it would be the wrong
 * guard. The two committed .cjs files themselves must simply never diverge:
 * a prior session's hand-edits DID diverge, and the drift went unnoticed
 * until this test was written, which is exactly the failure mode this guards
 * against.
 *
 * ── Fork note ────────────────────────────────────────────────────────────
 * This suite previously asserted the PRESENCE of upstream's product-funnel
 * machinery: `resolveCliBinForHook()`, `spawnDetachedHookRefresh()` with an
 * npx fallback, and `spawnFunnelRefresh()` in the generator's output. That
 * subsystem has been removed from this fork (GitHub issue #11), so those
 * assertions have been INVERTED rather than deleted. They now guard the
 * removal: if a future upstream rebase reintroduces the funnel, these fail
 * loudly instead of the funnel quietly coming back.
 *
 * The two properties being protected:
 *   1. No outbound network / npx-into-a-published-package from the hook.
 *   2. Nothing that writes to `~/.claude/settings.json` (Claude Code's own
 *      global config, which is not this tool's file to edit).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  generateHookHandler,
  generatePreCommitHook,
  generatePostCommitHook,
  generateRufloHookCjs,
} from '../src/init/helpers-generator.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const rootArtifact = path.resolve(here, '../../../../.claude/helpers/hook-handler.cjs');
const pkgArtifact = path.resolve(here, '../.claude/helpers/hook-handler.cjs');

describe('hook-handler.cjs — root/package artifact parity', () => {
  it('the root and package copies are byte-identical', () => {
    if (!existsSync(rootArtifact)) return; // package tested in isolation; nothing to guard
    expect(readFileSync(rootArtifact, 'utf-8')).toBe(readFileSync(pkgArtifact, 'utf-8'));
  });
});

/**
 * Shared expectations for "a hook handler that does not phone home". Applied
 * to BOTH the committed artifacts and the generator's output, so the two can
 * never drift into the state where one is clean and the other is not —
 * which is worse than both being wrong, because it looks fixed.
 */
function expectNoFunnelMachinery(source: string, label: string): void {
  // Removed function names — the funnel refresh, the advisor refresh, the
  // CLI-bin resolver that existed only to feed them, and the first-run
  // auto-enable that wrote to Claude Code's global settings.
  for (const symbol of [
    'firstRunAutoEnableIfEligible',
    'spawnDetachedFunnelRefresh',
    'spawnDetachedAdvisorRefresh',
    'spawnDetachedHookRefresh',
    'spawnFunnelRefresh',
    'resolveCliBinForHook',
  ]) {
    expect(source, `${label} must not define or call ${symbol}`).not.toContain(symbol);
  }

  // Endpoints and subcommands of the removed subsystem.
  for (const needle of ['ruv.io', 'refresh-funnel', 'refresh-advisor', 'first-run-enabled']) {
    expect(source, `${label} must not reference ${needle}`).not.toContain(needle);
  }

  // No npx: it resolves the PUBLISHED upstream package, which still ships the
  // funnel. A cut that a registry package can undo is not a cut.
  expect(source, `${label} must not shell out via npx`).not.toContain('npx');

  // Never Claude Code's own global config.
  expect(source, `${label} must not touch Claude Code's settings.json`).not.toContain('settings.json');
  expect(source, `${label} must not manage spinnerVerbs`).not.toContain('spinnerVerbs');

  // The in-transcript sponsor ad that rode the rate-limit path.
  expect(source, `${label} must not carry sponsor ad copy`).not.toContain('COGNITUM');
  expect(source, `${label} must not carry sponsor ad copy`).not.toContain('cognitum.one');
}

describe('hook-handler.cjs — committed artifacts carry no funnel machinery', () => {
  const artifacts: Array<[string, string]> = [
    ['package copy', pkgArtifact],
    ...(existsSync(rootArtifact) ? ([['root copy', rootArtifact]] as Array<[string, string]>) : []),
  ];

  for (const [label, file] of artifacts) {
    it(`${label} has no funnel/first-run/npx/settings.json surface`, () => {
      expectNoFunnelMachinery(readFileSync(file, 'utf-8'), label);
    });
  }
});

describe('generateHookHandler() fallback — must meet the same bar as the committed artifact', () => {
  // This is the inline fallback template used when copying the real helper
  // from the package fails (helper-refresh.ts). It is generated, not
  // committed, so it needs its own guard: the committed .cjs being clean says
  // nothing about what `ruflo init` actually writes to a user's project.
  //
  // Upstream this emitted `spawnFunnelRefresh()`, which fired
  // `npx --prefer-offline @claude-flow/cli hooks refresh-funnel` detached on
  // every session-restore — resolving the PUBLISHED package, so it ran
  // upstream's funnel regardless of anything this fork does to its own
  // sources. We assert against the generator's OUTPUT, not its template, so
  // the check cannot be satisfied by a comment that merely looks right.
  const source = generateHookHandler();

  it('emits no funnel/first-run/npx/settings.json surface', () => {
    expectNoFunnelMachinery(source, 'generateHookHandler() output');
  });

  it('does not require child_process at all', () => {
    // `spawn` existed in the emitted preamble for exactly one caller. Leaving
    // the require out enforces the property structurally: a reintroduced
    // spawn call throws ReferenceError instead of silently phoning home.
    expect(source).not.toContain('child_process');
    expect(source).not.toContain('spawn(');
  });

  it('still wires the real session-restore work (session + intelligence)', () => {
    // Guard against over-cutting: removing the funnel spawn must not have
    // taken the handler's actual job with it.
    const idx = source.indexOf("'session-restore':");
    expect(idx).toBeGreaterThan(-1);
    const handlerBody = source.slice(idx, idx + 600);
    expect(handlerBody).toContain('session.restore');
    expect(handlerBody).toContain('intelligence.init');
  });

  it('is syntactically valid JavaScript', () => {
    const withoutShebang = source.replace(/^#!.*\n/, '');
    expect(() => new Function(withoutShebang)).not.toThrow();
  });
});

describe('every generated artifact — no npx into a published package', () => {
  // `ruflo init` writes these into a user's project. Each one previously
  // ended its dispatch chain with npx against the PUBLISHED upstream package
  // (`@claude-flow/cli` or `ruflo@latest`), which executes upstream's code —
  // including the funnel — no matter what this fork does to its own sources.
  //
  // A cut that a registry package can undo is not a cut, so this asserts on
  // the emitted text of every generator, not just the hook handler.
  const artifacts: Array<[string, string]> = [
    ['generateHookHandler', generateHookHandler()],
    ['generatePreCommitHook', generatePreCommitHook()],
    ['generatePostCommitHook', generatePostCommitHook()],
    ['generateRufloHookCjs', generateRufloHookCjs()],
  ];

  for (const [name, source] of artifacts) {
    it(`${name}() emits no npx invocation`, () => {
      // Strip comments first: the generators legitimately explain in prose
      // why the npx fallback was removed, and that prose names npx.
      const code = source
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*(\/\/|#).*$/gm, '');
      expect(code, `${name}() must not shell out via npx`).not.toMatch(/\bnpx\b/);
    });
  }

  it('the shell hooks still dispatch when a local binary IS on PATH', () => {
    // Guard against over-cutting: removing npx must not have removed the
    // ability to run the hook at all.
    for (const [name, source] of artifacts.slice(1, 3)) {
      expect(source, `${name}() must still resolve a local binary`).toMatch(/command -v ruflo/);
      expect(source, `${name}() must still fall back to claude-flow`).toMatch(/command -v claude-flow/);
    }
  });
});
