/**
 * advisor-tip.ts — the ADR-316 co-pilot advisor tip, REMOVED IN THIS FORK.
 *
 * Upstream, `refreshAdvisorTipIfStale()` was the one insight source that spent
 * real money and made a real outbound call: it spawned a `claude -p` run via
 * the Fable Advisor Harness with a ~$0.40 budget cap, fired detached from
 * every SessionStart, to produce a one-line tip for the statusline promo row.
 * This suite used to verify that spend was correctly gated (consent + TTL).
 *
 * The row is gone, the SessionStart spawn is gone from hook-handler.cjs, and
 * the refresh is inert. The suite is INVERTED rather than deleted: gating a
 * spend path is a weaker guarantee than not having one, and these tests now
 * assert the stronger property — the harness is never constructed, never
 * called, and never writes, no matter what consent or cache state says.
 *
 * `readAdvisorTip()` is deliberately still FUNCTIONAL (a synchronous, $0,
 * network-free cache read), so its coverage is retained — but it now seeds
 * the cache file directly instead of going through the removed refresh path.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { recordConsent } from '../src/funnel/consent.js';
import {
  ADVISOR_REFRESH_TTL_MS,
  readAdvisorTip,
  refreshAdvisorTipIfStale,
} from '../src/funnel/advisor-tip.js';

let stateDir: string;
let savedEnv: NodeJS.ProcessEnv;

const CACHE_FILE = 'advisor-tip.json';

/** Write the cache the way the (now removed) refresh path used to. */
function seedCache(entry: { _ts: number; headline?: string; detail?: string }): void {
  fs.writeFileSync(path.join(stateDir, CACHE_FILE), JSON.stringify(entry), 'utf-8');
}

beforeEach(() => {
  stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'advisor-tip-test-'));
  savedEnv = { ...process.env };
  process.env.RUFLO_STATE_DIR = stateDir;
});

afterEach(() => {
  process.env = savedEnv;
  fs.rmSync(stateDir, { recursive: true, force: true });
});

describe('refreshAdvisorTipIfStale — the spend/network path is removed, not gated', () => {
  it('never calls an injected harness, even with consent granted and no cache', async () => {
    recordConsent('advisor-tips', true, 'test');
    let called = false;
    const harness = { adviseCoPilotTip: async () => { called = true; return { headline: 'x', detail: 'y' }; } };
    const result = await refreshAdvisorTipIfStale({}, { harness });
    expect(called).toBe(false);
    expect(result).toEqual({ refreshed: false, reason: 'removed-in-fork' });
  });

  it('never calls the harness even when the cache is long past its TTL', async () => {
    // The old TTL gate was the thing standing between "consented" and "spends
    // money". A stale cache was precisely the condition that opened the spend.
    recordConsent('advisor-tips', true, 'test');
    seedCache({ _ts: 0 });
    let calls = 0;
    const harness = { adviseCoPilotTip: async () => { calls++; return { headline: 'tip', detail: 'd' }; } };
    const afterTtl = new Date(ADVISOR_REFRESH_TTL_MS * 10);
    const result = await refreshAdvisorTipIfStale({}, { now: afterTtl, harness });
    expect(calls).toBe(0);
    expect(result.refreshed).toBe(false);
  });

  it('writes nothing to the state dir', async () => {
    recordConsent('advisor-tips', true, 'test');
    const before = fs.readdirSync(stateDir).sort();
    await refreshAdvisorTipIfStale({ gitUncommittedCount: 50 }, { now: new Date() });
    expect(fs.readdirSync(stateDir).sort()).toEqual(before);
  });

  it('does not construct a real FableHarness when none is injected', async () => {
    // Upstream defaulted to `new FableHarness({ maxBudgetUsd: ... })` when no
    // harness was passed. The module no longer imports FableHarness at all, so
    // this call must resolve without spawning or throwing.
    recordConsent('advisor-tips', true, 'test');
    await expect(refreshAdvisorTipIfStale({})).resolves.toEqual({
      refreshed: false,
      reason: 'removed-in-fork',
    });
  });
});

describe('advisor-tip.ts — carries no model-spawn surface', () => {
  // Assert on CODE, not prose: the module's doc comment legitimately explains
  // what was removed and names FableHarness while doing so. Strip comments
  // first, then check what actually executes.
  it('does not import the Fable harness or invoke it', () => {
    const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
    const raw = fs.readFileSync(path.resolve(here, '../src/funnel/advisor-tip.ts'), 'utf-8');
    const code = raw
      .replace(/\/\*[\s\S]*?\*\//g, '') // block comments
      .replace(/^\s*\/\/.*$/gm, '');    // line comments

    expect(code).not.toMatch(/^\s*import\s[\s\S]*?fable-harness/m);
    expect(code).not.toContain('FableHarness');
    expect(code).not.toContain('adviseCoPilotTip');
    expect(code).not.toContain('spawn');
  });
});

describe('readAdvisorTip — pure cache reader (retained, still functional)', () => {
  it('returns null when nothing has been cached', () => {
    expect(readAdvisorTip()).toBeNull();
  });

  it('reads a cached headline+detail within the TTL', () => {
    const now = new Date();
    seedCache({ _ts: now.getTime(), headline: 'Commit your work', detail: '50 files uncommitted.' });
    expect(readAdvisorTip(now)).toEqual({ headline: 'Commit your work', detail: '50 files uncommitted.' });
  });

  it('returns null for an expired cache entry', () => {
    const t0 = new Date(0);
    seedCache({ _ts: t0.getTime(), headline: 'tip', detail: 'd' });
    expect(readAdvisorTip(new Date(t0.getTime() + ADVISOR_REFRESH_TTL_MS + 1))).toBeNull();
  });

  it('treats an epoch-zero timestamp as present, not absent', () => {
    // Regression: `!cache._ts` would wrongly discard a legitimate _ts of 0.
    seedCache({ _ts: 0, headline: 'tip', detail: 'd' });
    expect(readAdvisorTip(new Date(1000))).toEqual({ headline: 'tip', detail: 'd' });
  });
});
