/**
 * Promo-row orchestrator — REMOVED IN THIS FORK.
 *
 * Upstream this selected the statusline's third row: a rotating mix of
 * sponsor promos, disclosure notices, and educational tips, each wrapped in a
 * `funnel.ruv.io/v1/click` redirect so opens and coarse geo were captured
 * before the 302 to the real destination (ADR-301/311/313).
 *
 * This fork does not carry that funnel. The row is gone from the renderer
 * (`.claude/helpers/statusline.cjs` no longer has a line 3), the click-
 * attribution module is deleted, and the remote message pool is permanently
 * empty. `getFunnelPromo()` is retained as an inert stub only because
 * `funnel/index.ts` re-exports it and `commands/hooks.ts` dynamically imports
 * it for the `hooks statusline --json` payload — both outside the scope of
 * this change. It now always returns null, so the payload simply carries no
 * `promo` field and the renderer has nothing to draw.
 *
 * COLLATERAL, recorded deliberately: upstream rode a genuinely useful
 * local-insight ticker (`insights.ts`) on this same row — security findings,
 * uncommitted-change count, power-saver state. That ticker went with the row.
 * It is nearly all duplicative of what the statusline already shows without
 * it: security status is on line 2 (`🛡 findings` / `🛡 scan pending`) and the
 * uncommitted count is on line 1 (`~N ?N`). `insights.ts` is left in the tree,
 * unreferenced and network-free, so an honest local-only row can be rebuilt
 * on it later without recovering any of the funnel machinery.
 */

import type { PromoRow } from './types.js';
import type { LocalInsightContext } from './insights.js';

export interface PromoContext {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  now?: Date;
  /**
   * Whether the calling surface is an interactive session. Retained so
   * existing call sites keep type-checking; no longer consulted.
   */
  interactive: boolean;
  /** Retained for call-site compatibility; no longer consulted. */
  localInsights?: LocalInsightContext;
}

/**
 * Inert. Always null — this fork renders no promo/disclosure row, under any
 * env var, consent state, or config.
 */
export function getFunnelPromo(_ctx: PromoContext): PromoRow | null {
  return null;
}
