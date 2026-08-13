/**
 * Post-initialization capability enrollment — ADR-302.
 *
 * One-time, non-blocking, skippable. Gates, all of which must pass:
 *   - interactive TTY (never in CI / piped / automation)
 *   - not skipped via --no-signup
 *   - funnel enabled under the ADR-305 precedence chain
 *   - never shown before (user-level record, not per-project)
 *
 * Accepting authorizes exactly ONE thing: a pointer to `ruflo auth login`.
 * It does not install the proxy, does not enable telemetry, and does not
 * enable cloud routing (separate consent domains — ADR-302). The enrollment
 * outcome never affects init's exit code.
 */

import { isCI, isInteractive } from './environment.js';
import { resolveFunnelEnabled } from './precedence.js';
import { recordConsent } from './consent.js';
import { readStateJson, writeStateJson } from './state.js';

const ENROLLMENT_FILE = 'enrollment.json';

interface EnrollmentRecord {
  shownAt: string;
  outcome: 'accepted' | 'skipped';
}

export function getEnrollmentRecord(): EnrollmentRecord | null {
  return readStateJson<EnrollmentRecord>(ENROLLMENT_FILE);
}

/**
 * Upsell copy — EMPTIED IN THIS FORK. Upstream this was a post-`ruflo init`
 * signup pitch for a cognitum.one account. `shouldOfferEnrollment()` below
 * now always returns false, so `commands/init.ts` never reaches the point of
 * printing either of these strings; they are retained as empty constants only
 * because that file imports them and is outside the scope of this change.
 */
export const ENROLLMENT_SCREEN = '';

export const ENROLLMENT_SKIP_TEXT = '';

export interface EnrollmentGateContext {
  noSignup: boolean;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

/**
 * Always false in this fork — the post-init account upsell is not offered,
 * under any flag, env var, or consent state. This is the single choke point
 * for the ADR-302 screen, so returning false here removes the prompt without
 * editing `commands/init.ts`.
 *
 * Retained (rather than deleted) because `commands/init.ts` imports it; the
 * `ctx` parameter is kept for call-site compatibility and is not consulted.
 */
export function shouldOfferEnrollment(_ctx: EnrollmentGateContext): boolean {
  return false;
}

/**
 * Record the user's decision. Both accept and skip are terminal — the
 * prompt never reappears (ADR-302). Accepting records the `account`
 * consent receipt; skipping records the decline.
 */
export function recordEnrollmentOutcome(accepted: boolean, now: Date = new Date()): void {
  writeStateJson(ENROLLMENT_FILE, {
    shownAt: now.toISOString(),
    outcome: accepted ? 'accepted' : 'skipped',
  } satisfies EnrollmentRecord);
  recordConsent('account', accepted, 'post-init', now);
}
