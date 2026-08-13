/**
 * Advisor co-pilot tip — REFRESH PATH REMOVED IN THIS FORK (was ADR-316).
 *
 * Upstream this was the one insight source that spent real money and made a
 * real outbound call: `refreshAdvisorTipIfStale()` spawned a `claude -p` run
 * via the Fable Advisor Harness with a ~$0.40 budget cap, invoked from a
 * detached process on every SessionStart, to produce a one-line tip for the
 * statusline's promo/insight row.
 *
 * That row no longer exists in this fork and the SessionStart spawn that
 * drove this is gone from `hook-handler.cjs`, so the refresh has no caller
 * and no surface. It is removed rather than gated: a spend-and-network path
 * kept alive behind a flag is exactly the thing an upstream merge flips back
 * on quietly.
 *
 * RETAINED as inert stubs, because `commands/advisor.ts` and `insights.ts`
 * import them by name and both are outside the scope of this change:
 *   - `readAdvisorTip()` — kept FUNCTIONAL. It is a synchronous local cache
 *     read, $0, no network. With nothing left to write the cache it returns
 *     null in practice, but it does not lie about what it does.
 *   - `refreshAdvisorTipIfStale()` — inert; never spawns, never spends.
 *   - `ADVISOR_REFRESH_TTL_MS` / `ADVISOR_DEFAULT_BUDGET_USD` — retained
 *     constants; no code path spends against the budget figure.
 *
 * The `FableHarness` import is deliberately dropped so this module cannot
 * reach the spawn path even by accident.
 */

import { readStateJson } from './state.js';

const ADVISOR_CACHE_FILE = 'advisor-tip.json';
/** Retained for API compatibility. Still bounds the read-side staleness check. */
export const ADVISOR_REFRESH_TTL_MS = 24 * 60 * 60 * 1000;
/** Retained for API compatibility. Nothing spends against this in this fork. */
export const ADVISOR_DEFAULT_BUDGET_USD = 0.4;

interface AdvisorTipCache {
  _ts: number;
  headline?: string;
  detail?: string;
}

export interface CachedAdvisorTip {
  headline: string;
  detail: string;
}

/** Synchronous, $0, no network — a plain local cache read. */
export function readAdvisorTip(now: Date = new Date()): CachedAdvisorTip | null {
  const cache = readStateJson<AdvisorTipCache>(ADVISOR_CACHE_FILE);
  // `!cache._ts` would wrongly treat a legitimate epoch-zero timestamp as
  // absent (0 is falsy) — check the type explicitly instead.
  if (!cache || !cache.headline || typeof cache._ts !== 'number') return null;
  if (now.getTime() - cache._ts >= ADVISOR_REFRESH_TTL_MS) return null;
  return { headline: cache.headline, detail: cache.detail ?? '' };
}

export interface AdvisorRefreshResult {
  refreshed: boolean;
  reason?: 'not-consented' | 'fresh' | 'no-tip' | 'error' | 'removed-in-fork';
}

/**
 * Inert. Never spawns a model call, never spends, never writes the cache.
 * Retained only so `commands/advisor.ts` keeps type-checking.
 */
export async function refreshAdvisorTipIfStale(
  _snapshot: unknown,
  _opts: { now?: Date; harness?: unknown } = {},
): Promise<AdvisorRefreshResult> {
  return { refreshed: false, reason: 'removed-in-fork' };
}
