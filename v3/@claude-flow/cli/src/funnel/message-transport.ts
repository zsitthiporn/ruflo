/**
 * Remote message transport — REMOVED IN THIS FORK.
 *
 * Upstream this module fetched the ADR-311 promotional/disclosure message
 * feed from `https://funnel.ruv.io/v1/messages` on every session (spawned
 * detached from the SessionStart hook), validated it, and cached it under
 * `~/.ruflo/funnel-messages-cache.json` for the statusline's promo row.
 *
 * This fork does not reach outside the project workspace, and it does not
 * carry upstream's product funnel. The `https` import, the fetch, the cache
 * write, and the endpoint constant's network role are all gone.
 *
 * The three exports below are RETAINED as inert stubs, not because they do
 * anything, but because callers outside this module's ownership still import
 * them by name — `funnel/index.ts` re-exports all three, and
 * `commands/hooks.ts`'s `refresh-funnel` action dynamically imports
 * `refreshRemoteMessages`. Deleting the symbols would break those files,
 * which are outside the scope of this change. They now do nothing:
 *
 *   - `refreshRemoteMessages()` performs no I/O and always reports skipped.
 *   - `getRemoteMessages()` always returns an empty pool.
 *   - `DEFAULT_MESSAGES_ENDPOINT` is a documentation-only string; nothing
 *     reads it to make a request.
 *
 * Because the pool is permanently empty, every downstream consumer
 * (`disclosure.ts`, `rotation.ts`) fails closed and renders nothing — which
 * is exactly the upstream-documented behavior for a cold cache.
 */

import type { FunnelMessage } from './types.js';

/**
 * Retained for API compatibility only. No code path issues a request to this
 * or any other endpoint — see the module doc comment.
 */
export const DEFAULT_MESSAGES_ENDPOINT = '';

/**
 * Inert. Never performs network I/O, never writes a cache file. The return
 * shape matches upstream so existing callers keep type-checking.
 */
export async function refreshRemoteMessages(_opts?: {
  endpoint?: string;
  force?: boolean;
  env?: NodeJS.ProcessEnv;
}): Promise<{ refreshed: boolean; skipped?: string; accepted?: number; rejected?: number; status?: number }> {
  return { refreshed: false, skipped: 'removed-in-fork' };
}

/** Inert. The remote pool does not exist in this fork. */
export function getRemoteMessages(): FunnelMessage[] {
  return [];
}
