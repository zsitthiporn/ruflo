/**
 * Funnel module invariants — post-removal (GitHub issue #11).
 *
 * Upstream this file gated the product funnel: rotation ratios, the disclosure
 * gate, click attribution, the /v1/events transport, and the statusline promo
 * row. That subsystem is removed from this fork, so those suites are gone and
 * the surviving ones split in two:
 *
 *   1. REMOVAL GUARDS — assert the funnel stays gone. An upstream rebase that
 *      quietly reintroduces it fails here rather than shipping. The final
 *      describe in this file is the consolidated version of that.
 *
 *   2. RETAINED COVERAGE — the parts of `src/funnel/` that were never
 *      promotional and are still load-bearing for auth / proxy / doctor /
 *      settings: consent receipts, control precedence, the credit-error
 *      classifier, the rate-limit and power-saver notifiers, toggle cooldown,
 *      CI detection, and the message-content sanitizer (kept because it is a
 *      trust boundary, even though there is no longer any message to sanitize).
 *
 * The distinction matters: "the funnel is gone" and "the code that shared a
 * directory with the funnel still works" are different claims, and both need
 * to hold.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
  isValidMessage,
  isAllowedUrl,
  containsForbiddenSequences,
  displayWidth,
  MESSAGES,
  MAX_MESSAGE_COLUMNS,
} from '../src/funnel/messages.js';
import { resolveFunnelEnabled } from '../src/funnel/precedence.js';
import {
  DISCLOSURE_GRACE_MS,
  recordDisclosureShown,
  selectDisclosureMessage,
} from '../src/funnel/disclosure.js';
import { getConsent, hasConsent, recordConsent } from '../src/funnel/consent.js';
import { CONSENT_POLICY_VERSION, CreditErrorCode } from '../src/funnel/types.js';
import {
  classifyCreditError,
  shouldShowCreditRecovery,
  renderCreditRecovery,
} from '../src/funnel/credit-errors.js';
import { recordFunnelEvent } from '../src/funnel/events.js';
import { getRemoteMessages, refreshRemoteMessages } from '../src/funnel/message-transport.js';
import { getFunnelPromo } from '../src/funnel/promo.js';
import { isCI } from '../src/funnel/environment.js';
import {
  RATE_LIMIT_TTL_MS,
  clearRateLimitStatus,
  markRateLimited,
  rateLimitNotice,
  readRateLimitStatus,
} from '../src/funnel/rate-limit-notifier.js';
import {
  QUOTA_LOW_TTL_MS,
  clearQuotaLowStatus,
  markQuotaLow,
  quotaLowNotice,
  readQuotaLowStatus,
} from '../src/funnel/power-saver-notifier.js';
import { TOGGLE_COOLDOWN_MS, cooldownActive, cooldownRemainingMin } from '../src/funnel/toggle-cooldown.js';
import { computeLocalInsights, selectLocalInsight } from '../src/funnel/insights.js';
import { shouldOfferEnrollment } from '../src/funnel/enrollment.js';

let stateDir: string;
let savedEnv: NodeJS.ProcessEnv;

const CLEAN_ENV_KEYS = [
  'RUFLO_FUNNEL', 'RUFLO_ENTERPRISE_POLICY', 'CI', 'GITHUB_ACTIONS', 'GITLAB_CI',
  'CIRCLECI', 'TRAVIS', 'BUILDKITE', 'JENKINS_URL', 'TEAMCITY_VERSION', 'TF_BUILD',
];

beforeEach(() => {
  stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'funnel-test-'));
  savedEnv = { ...process.env };
  process.env.RUFLO_STATE_DIR = stateDir;
  for (const k of CLEAN_ENV_KEYS) delete process.env[k];
});

/**
 * Seed the local remote-message cache exactly the way message-transport.ts's
 * writeCache() would after a successful GET /v1/messages. The remote pool is
 * authoritative and overrides the in-code seed pool by id, so tests that need
 * remote-specific content seed this cache; cold-start tests deliberately do not.
 */
function seedRemoteMessages(messages: unknown[]): void {
  fs.writeFileSync(
    path.join(stateDir, 'funnel-messages-cache.json'),
    JSON.stringify({ _ts: Date.now(), messages }),
    'utf-8',
  );
}

const TEST_DISCLOSURE_POOL = [
  { id: 'disclosure-1', schemaVersion: 1, class: 'disclosure', text: '✨ Tips, features and Cognitum updates here · manage: ruflo settings', url: 'https://cognitum.one/ruflo' },
  { id: 'disclosure-2', schemaVersion: 1, class: 'disclosure', text: '✨ Additional AI capabilities from Cognitum · manage: ruflo settings', url: 'https://cognitum.one/ruflo' },
  { id: 'disclosure-3', schemaVersion: 1, class: 'disclosure', text: '✨ Tips and Cognitum updates appear here · manage: ruflo settings', url: 'https://cognitum.one/ruflo' },
];

const TEST_ROTATION_POOL = [
  { id: 'edu-test-1', schemaVersion: 1, class: 'educational', text: 'edu tip one' },
  { id: 'edu-test-2', schemaVersion: 1, class: 'educational', text: 'edu tip two' },
  { id: 'edu-test-3', schemaVersion: 1, class: 'educational', text: 'edu tip three' },
  { id: 'edu-test-4', schemaVersion: 1, class: 'educational', text: 'edu tip four' },
  { id: 'promo-test-1', schemaVersion: 1, class: 'promotional', text: 'promo one', url: 'https://cognitum.one' },
];

afterEach(() => {
  process.env = savedEnv;
  fs.rmSync(stateDir, { recursive: true, force: true });
});

// ─── ADR-301: signed content boundaries ─────────────────────────────────────

describe('message content boundaries (ADR-301)', () => {
  const base = { id: 'test', schemaVersion: 1 as const, class: 'educational' as const };

  it('accepts a plain valid message', () => {
    expect(isValidMessage({ ...base, text: 'hello world' })).toBe(true);
  });

  it('drops ANSI escape sequences', () => {
    expect(isValidMessage({ ...base, text: 'hi \u001b[31mred\u001b[0m' })).toBe(false);
  });

  it('drops OSC sequences (terminal title / hyperlink injection)', () => {
    expect(isValidMessage({ ...base, text: 'x\u001b]0;pwned\u0007' })).toBe(false);
  });

  it('drops C0/C1 control characters', () => {
    expect(isValidMessage({ ...base, text: 'a\u0008b' })).toBe(false);
    expect(isValidMessage({ ...base, text: 'a\u009bb' })).toBe(false);
  });

  it('drops bidirectional override characters', () => {
    expect(isValidMessage({ ...base, text: 'a‮evil' })).toBe(false);
    expect(isValidMessage({ ...base, text: 'a⁦evil⁩' })).toBe(false);
  });

  it('drops over-length messages instead of truncating', () => {
    expect(isValidMessage({ ...base, text: 'x'.repeat(MAX_MESSAGE_COLUMNS + 1) })).toBe(false);
    expect(isValidMessage({ ...base, text: 'x'.repeat(MAX_MESSAGE_COLUMNS) })).toBe(true);
  });

  it('counts wide characters as 2 columns', () => {
    expect(displayWidth('あ')).toBe(2);
    expect(displayWidth('ab')).toBe(2);
    // 41 CJK chars = 82 display columns > 80 even though length is 41
    expect(isValidMessage({ ...base, text: 'あ'.repeat(41) })).toBe(false);
  });

  it('drops wrong schema version and bad class', () => {
    expect(isValidMessage({ ...base, schemaVersion: 2, text: 'x' })).toBe(false);
    expect(isValidMessage({ ...base, class: 'urgent', text: 'x' })).toBe(false);
  });

  it('drops expired messages', () => {
    const past = new Date(Date.now() - 1000).toISOString();
    expect(isValidMessage({ ...base, text: 'x', expiresAt: past })).toBe(false);
  });

  it('URL allowlist: exact hosts only, https only, no lookalikes', () => {
    expect(isAllowedUrl('https://cognitum.one/routing')).toBe(true);
    expect(isAllowedUrl('https://github.com/ruvnet/ruflo')).toBe(true);
    expect(isAllowedUrl('http://cognitum.one')).toBe(false); // not https
    expect(isAllowedUrl('https://cognitum.one.evil.com')).toBe(false); // lookalike
    expect(isAllowedUrl('https://evilcognitum.one')).toBe(false);
    expect(isAllowedUrl('https://github.com/attacker/repo')).toBe(false); // wrong org
    expect(isAllowedUrl('https://1.2.3.4/')).toBe(false); // IP literal
    expect(isAllowedUrl('javascript:alert(1)')).toBe(false);
    expect(isAllowedUrl('not a url')).toBe(false);
  });

  // INVERTED (fork): upstream shipped a baked seed pool of sponsor-linked
  // tips + one promo so the statusline row had content before the remote
  // fetch landed. It rendered with ZERO network, so emptying it was a
  // separate, necessary step from cutting the transports. This guards the
  // pool staying empty on a future rebase.
  it('ships NO local message pool — sponsor content is not baked into the binary', () => {
    expect(MESSAGES).toHaveLength(0);
  });

  // The validation pipeline is deliberately KEPT: it is a content-sanitizing
  // trust boundary, makes no network call, and other modules import it. It
  // must keep working even with nothing to validate.
  it('still validates ad-hoc messages even with an empty pool', () => {
    expect(isValidMessage({ id: 'x', schemaVersion: 1, class: 'educational', text: 'a tip' })).toBe(true);
    expect(isValidMessage({ id: 'y', schemaVersion: 1, class: 'educational', text: 'x'.repeat(500) })).toBe(false);
  });

  it('a disclosure-class message without the manage tail is rejected, never repaired', () => {
    const base = { id: 'disclosure-x', schemaVersion: 1 as const, class: 'disclosure' as const };
    expect(isValidMessage({ ...base, text: '✨ Missing the tail entirely' })).toBe(false);
    expect(isValidMessage({ ...base, text: '✨ Has it · manage: ruflo settings' })).toBe(true);
  });

  // INVERTED (fork): upstream selected a rotating disclosure message for the
  // statusline row. There is no row and no pool, so this must always be null.
  it('selectDisclosureMessage returns null — there is no disclosure row', () => {
    expect(selectDisclosureMessage(new Date())).toBeNull();
  });

  // The strongest guard in this file: even if someone repopulates the LOCAL
  // cache file by hand (or a stale one survives from a pre-fork install), the
  // transport is inert and nothing is surfaced.
  it('ignores a hand-seeded remote cache — the transport is inert', () => {
    seedRemoteMessages(TEST_DISCLOSURE_POOL);
    expect(getRemoteMessages()).toHaveLength(0);
    expect(selectDisclosureMessage(new Date('2026-07-10T12:00:00.000Z'))).toBeNull();
  });
});

// ─── ADR-301: rotation ratio ────────────────────────────────────────────────

// ─── ADR-305: control precedence ────────────────────────────────────────────

describe('control precedence (ADR-305)', () => {
  it('defaults to enabled by package default', () => {
    expect(resolveFunnelEnabled(stateDir)).toEqual({ enabled: true, decidedBy: 'package-default' });
  });

  it('RUFLO_FUNNEL=0 disables at the top of the chain', () => {
    for (const v of ['0', 'false', 'off', 'no', 'FALSE']) {
      expect(resolveFunnelEnabled(stateDir, { ...process.env, RUFLO_FUNNEL: v }).decidedBy).toBe('env');
    }
  });

  it('enterprise policy disables below env', () => {
    const policyFile = path.join(stateDir, 'policy.json');
    fs.writeFileSync(policyFile, JSON.stringify({ funnel: { enabled: false } }));
    const decision = resolveFunnelEnabled(stateDir, { ...process.env, RUFLO_ENTERPRISE_POLICY: policyFile });
    expect(decision).toEqual({ enabled: false, decidedBy: 'enterprise-policy' });
  });

  it('a lower-precedence source never re-enables a higher-precedence disable', () => {
    // user config says enabled=true, env says off → env wins
    fs.writeFileSync(path.join(stateDir, 'funnel.json'), JSON.stringify({ enabled: true }));
    const decision = resolveFunnelEnabled(stateDir, { ...process.env, RUFLO_FUNNEL: '0' });
    expect(decision.enabled).toBe(false);
    expect(decision.decidedBy).toBe('env');
  });

  it('user config disable wins over project config and default', () => {
    fs.writeFileSync(path.join(stateDir, 'funnel.json'), JSON.stringify({ enabled: false }));
    expect(resolveFunnelEnabled(stateDir).decidedBy).toBe('user-config');
  });

  it('project claude-flow.config.json funnel.enabled=false disables', () => {
    fs.writeFileSync(path.join(stateDir, 'claude-flow.config.json'), JSON.stringify({ funnel: { enabled: false } }));
    expect(resolveFunnelEnabled(stateDir).decidedBy).toBe('project-config');
  });

  it('a stored remote policy can disable but sits at the bottom', () => {
    fs.writeFileSync(path.join(stateDir, 'funnel-remote-policy.json'), JSON.stringify({ funnelEnabled: false }));
    expect(resolveFunnelEnabled(stateDir).decidedBy).toBe('remote-policy');
    // remote enable=true must NOT override user disable
    fs.writeFileSync(path.join(stateDir, 'funnel-remote-policy.json'), JSON.stringify({ funnelEnabled: true }));
    fs.writeFileSync(path.join(stateDir, 'funnel.json'), JSON.stringify({ enabled: false }));
    expect(resolveFunnelEnabled(stateDir).decidedBy).toBe('user-config');
  });
});

// ─── ADR-301: disclosure gate ───────────────────────────────────────────────

// ─── ADR-301/305: promo orchestrator gates ──────────────────────────────────

// ─── ADR-302: consent receipts ──────────────────────────────────────────────

describe('consent receipts (ADR-302)', () => {
  it('unasked domains are not consented and have a null timestamp', () => {
    expect(hasConsent('account')).toBe(false);
    expect(getConsent('account').at).toBeNull();
  });

  it('records grant AND decline as decisions', () => {
    recordConsent('account', true, 'post-init');
    recordConsent('telemetry', false, 'post-init');
    expect(hasConsent('account')).toBe(true);
    expect(hasConsent('telemetry')).toBe(false);
    expect(getConsent('telemetry').at).not.toBeNull(); // decline is recorded
  });

  it('a stale policyVersion is not consent (re-ask, never carry forward)', () => {
    recordConsent('cloud-routing', true, 'test');
    // simulate a policy bump by rewriting the receipt with an older version
    const file = path.join(stateDir, 'consent.json');
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    data['cloud-routing'].policyVersion = CONSENT_POLICY_VERSION - 1;
    fs.writeFileSync(file, JSON.stringify(data));
    expect(hasConsent('cloud-routing')).toBe(false);
  });

  it('accepting account consent enables nothing else (domains are separate)', () => {
    recordConsent('account', true, 'post-init');
    expect(hasConsent('cloud-routing')).toBe(false);
    expect(hasConsent('telemetry')).toBe(false);
    expect(hasConsent('proxy-install')).toBe(false);
  });
});

describe('training-data-sharing consent domain (ADR-315 Tier 2)', () => {
  it('is unconsented by default, independent of sponsored-downtime', () => {
    recordConsent('sponsored-downtime', true, 'proxy-sponsor-enable');
    expect(hasConsent('sponsored-downtime')).toBe(true);
    expect(hasConsent('training-data-sharing')).toBe(false);
  });

  it('granting sponsored-downtime never implicitly grants training-data-sharing', () => {
    recordConsent('sponsored-downtime', true, 'proxy-sponsor-enable');
    recordConsent('power-saver', true, 'proxy-power-saver-enable');
    expect(hasConsent('training-data-sharing')).toBe(false);
  });

  it('records grant and decline as explicit decisions, same as every other domain', () => {
    recordConsent('training-data-sharing', true, 'proxy-training-share-enable');
    expect(hasConsent('training-data-sharing')).toBe(true);
    recordConsent('training-data-sharing', false, 'proxy-training-share-disable');
    expect(hasConsent('training-data-sharing')).toBe(false);
    expect(getConsent('training-data-sharing').at).not.toBeNull(); // decline recorded, not absent
  });

  it('granting training-data-sharing does not implicitly grant sponsored-downtime', () => {
    recordConsent('training-data-sharing', true, 'proxy-training-share-enable');
    expect(hasConsent('sponsored-downtime')).toBe(false);
  });

  // INVERTED (fork): the event queue existed to be POSTed to
  // funnel.ruv.io/v1/events. That transport is deleted, so the write path is
  // gone too — a queue nobody reads is litter, and a repopulated queue would
  // be shipped wholesale if a rebase ever restored the transport.
  it('records NO event even with telemetry consent granted', () => {
    recordConsent('telemetry', true, 'test');
    expect(recordFunnelEvent('training_share_enabled', 'statusline', '3.25.6')).toBe(false);
    expect(recordFunnelEvent('training_share_disabled', 'statusline', '3.25.6')).toBe(false);
  });
});

describe('advisor-tips consent domain (ADR-316)', () => {
  it('is unconsented by default, independent of every other domain', () => {
    recordConsent('sponsored-downtime', true, 'proxy-sponsor-enable');
    recordConsent('power-saver', true, 'proxy-power-saver-enable');
    recordConsent('training-data-sharing', true, 'proxy-training-share-enable');
    expect(hasConsent('advisor-tips')).toBe(false);
  });

  it('granting advisor-tips does not implicitly grant any other domain', () => {
    recordConsent('advisor-tips', true, 'advisor-enable');
    expect(hasConsent('sponsored-downtime')).toBe(false);
    expect(hasConsent('power-saver')).toBe(false);
    expect(hasConsent('training-data-sharing')).toBe(false);
  });

  it('records grant and decline as explicit decisions', () => {
    recordConsent('advisor-tips', true, 'advisor-enable');
    expect(hasConsent('advisor-tips')).toBe(true);
    recordConsent('advisor-tips', false, 'advisor-disable');
    expect(hasConsent('advisor-tips')).toBe(false);
    expect(getConsent('advisor-tips').at).not.toBeNull();
  });

  // INVERTED (fork) — see the training_share equivalent above.
  it('records NO advisor event even with telemetry consent granted', () => {
    recordConsent('telemetry', true, 'test');
    expect(recordFunnelEvent('advisor_tip_enabled', 'statusline', '3.25.6')).toBe(false);
    expect(recordFunnelEvent('advisor_tip_disabled', 'statusline', '3.25.6')).toBe(false);
  });
});

// ─── ADR-303: credit-error classifier ───────────────────────────────────────

describe('credit-error classifier (ADR-303, fail-closed)', () => {
  it('only COGNITUM_CREDIT_EXHAUSTED triggers the recovery surface', () => {
    const session = { creditPromptShown: false };
    const fire = classifyCreditError({ providerCode: 'cognitum_credit_exhausted' });
    expect(fire.code).toBe(CreditErrorCode.COGNITUM_CREDIT_EXHAUSTED);
    expect(shouldShowCreditRecovery(fire, session)).toBe(true);

    for (const code of ['insufficient_quota', 'rate_limit_exceeded', 'authentication_error', 'api_error']) {
      const e = classifyCreditError({ providerCode: code });
      expect(shouldShowCreditRecovery(e, session), `${code} must not fire`).toBe(false);
    }
  });

  it('provider quota exhaustion maps to PROVIDER_QUOTA_EXHAUSTED, never Cognitum', () => {
    const e = classifyCreditError({ providerCode: 'insufficient_quota' });
    expect(e.code).toBe(CreditErrorCode.PROVIDER_QUOTA_EXHAUSTED);
  });

  it('unmapped codes stay unclassified with confidence 0', () => {
    const e = classifyCreditError({ providerCode: 'weird_new_error' });
    expect(e.code).toBeNull();
    expect(e.confidence).toBe(0);
    expect(shouldShowCreditRecovery(e, { creditPromptShown: false })).toBe(false);
  });

  it('a bare 429 with no code is ambiguous → unmapped', () => {
    const e = classifyCreditError({ status: 429 });
    expect(e.code).toBeNull();
    expect(e.confidence).toBe(0);
  });

  it('never parses message text (only codes and status)', () => {
    const e = classifyCreditError({
      providerCode: undefined,
      // message text saying "credits exhausted" is NOT a signal
    } as never);
    expect(e.code).toBeNull();
  });

  it('caps at one prompt per session', () => {
    const fire = classifyCreditError({ providerCode: 'cognitum_credit_exhausted' });
    expect(shouldShowCreditRecovery(fire, { creditPromptShown: true })).toBe(false);
  });

  it('recovery screen distinguishes signed-in vs signed-out', () => {
    expect(renderCreditRecovery(false)).toContain('ruflo auth login');
    expect(renderCreditRecovery(true)).toContain('ruflo proxy enable');
  });
});

// ─── ADR-305/309: events, consent-gated, bucketed ───────────────────────────

// ─── ADR-302: enrollment gates ──────────────────────────────────────────────

// ─── environment gates ──────────────────────────────────────────────────────

describe('CI detection', () => {
  it('recognizes the common CI environments', () => {
    for (const v of ['CI', 'GITHUB_ACTIONS', 'GITLAB_CI', 'JENKINS_URL', 'TF_BUILD']) {
      expect(isCI({ [v]: 'true' } as NodeJS.ProcessEnv), v).toBe(true);
    }
    expect(isCI({} as NodeJS.ProcessEnv)).toBe(false);
    expect(isCI({ CI: 'false' } as NodeJS.ProcessEnv)).toBe(false);
  });
});

// ─── generated statusline renderer (defense-in-depth) ──────────────────────

// ─── ADR-301/305 attribution — network-free fallback discipline ─────────────
// The funnel row must render correctly even when the API is completely down.
// These tests pin that invariant.

// ─── ADR-308 client transport — consent-gated + failure-safe ────────────────

// ─── ADR-312/313: rate-limit notifier + sponsored downtime override ────────

describe('rate-limit notifier (ADR-312 Phase 0 — manual, self-reported)', () => {
  it('starts not-limited', () => {
    expect(readRateLimitStatus().limited).toBe(false);
    expect(rateLimitNotice()).toBeNull();
  });

  it('markRateLimited is idempotent — stable `since`', () => {
    const t0 = new Date('2026-07-10T12:00:00.000Z');
    markRateLimited(t0);
    const first = readRateLimitStatus(t0);
    expect(first.limited).toBe(true);
    expect(first.since).toBe(t0.toISOString());
    // Marking again later must not move `since`.
    markRateLimited(new Date(t0.getTime() + 60_000));
    const second = readRateLimitStatus(new Date(t0.getTime() + 60_000));
    expect(second.since).toBe(t0.toISOString());
  });

  it('clearRateLimitStatus stamps `cleared` and flips `limited` false', () => {
    const t0 = new Date('2026-07-10T12:00:00.000Z');
    markRateLimited(t0);
    // Past the ADR-314 §D1 toggle cooldown (10 min) — a clear inside that
    // window is deliberately refused (covered separately below).
    const t1 = new Date(t0.getTime() + 11 * 60 * 1000);
    clearRateLimitStatus(t1);
    const status = readRateLimitStatus(t1);
    expect(status.limited).toBe(false);
    expect(status.cleared).not.toBeNull();
  });

  it('auto-expires the flag after the TTL (a stale manual mark self-heals)', () => {
    const t0 = new Date('2026-07-10T12:00:00.000Z');
    markRateLimited(t0);
    const justBefore = readRateLimitStatus(new Date(t0.getTime() + RATE_LIMIT_TTL_MS - 1000));
    expect(justBefore.limited).toBe(true);
    const justAfter = readRateLimitStatus(new Date(t0.getTime() + RATE_LIMIT_TTL_MS + 1000));
    expect(justAfter.limited).toBe(false);
  });

  it('rateLimitNotice humanizes age and points at the sponsor command', () => {
    const t0 = new Date('2026-07-10T12:00:00.000Z');
    markRateLimited(t0);
    const notice = rateLimitNotice(new Date(t0.getTime() + 5 * 60 * 1000));
    expect(notice).toContain('5m ago');
    expect(notice).toContain('ruflo proxy sponsor-enable');
  });
});

describe('toggle cooldown (ADR-314 §D1 — anti-abuse friction)', () => {
  it('is inactive with no prior toggle', () => {
    expect(cooldownActive(null, new Date())).toBe(false);
  });

  it('is active just before the cooldown window elapses', () => {
    const t0 = new Date('2026-07-10T12:00:00.000Z');
    const justBefore = new Date(t0.getTime() + TOGGLE_COOLDOWN_MS - 1000);
    expect(cooldownActive(t0.toISOString(), justBefore)).toBe(true);
  });

  it('clears just after the cooldown window elapses', () => {
    const t0 = new Date('2026-07-10T12:00:00.000Z');
    const justAfter = new Date(t0.getTime() + TOGGLE_COOLDOWN_MS + 1000);
    expect(cooldownActive(t0.toISOString(), justAfter)).toBe(false);
  });

  it('reports remaining minutes, floored to zero once elapsed', () => {
    const t0 = new Date('2026-07-10T12:00:00.000Z');
    const fiveMinIn = new Date(t0.getTime() + 5 * 60 * 1000);
    expect(cooldownRemainingMin(t0.toISOString(), fiveMinIn)).toBe(5);
    expect(cooldownRemainingMin(t0.toISOString(), new Date(t0.getTime() + TOGGLE_COOLDOWN_MS + 1000))).toBe(0);
  });

  it('rate-limit mark→clear inside the cooldown window is refused', () => {
    const t0 = new Date('2026-07-10T12:30:00.000Z');
    expect(markRateLimited(t0)).toBe(true);
    const stillCoolingDown = new Date(t0.getTime() + 1000);
    expect(clearRateLimitStatus(stillCoolingDown)).toBe(false);
    // The refusal must not have silently applied — still limited.
    expect(readRateLimitStatus(stillCoolingDown).limited).toBe(true);
  });

  it('rate-limit mark→clear after the cooldown window succeeds', () => {
    const t0 = new Date('2026-07-10T12:31:00.000Z');
    expect(markRateLimited(t0)).toBe(true);
    const afterCooldown = new Date(t0.getTime() + TOGGLE_COOLDOWN_MS + 1000);
    expect(clearRateLimitStatus(afterCooldown)).toBe(true);
    expect(readRateLimitStatus(afterCooldown).limited).toBe(false);
  });

  it('re-marking an already-limited flag is not a state change — cooldown does not apply', () => {
    const t0 = new Date('2026-07-10T12:32:00.000Z');
    expect(markRateLimited(t0)).toBe(true);
    // Immediately re-marking (still limited) must succeed — it's a no-op idempotent call.
    expect(markRateLimited(new Date(t0.getTime() + 1000))).toBe(true);
  });
});

describe('power-saver notifier (ADR-314 §A — manual, self-reported, mirrors rate-limit)', () => {
  it('starts not-low', () => {
    expect(readQuotaLowStatus().low).toBe(false);
    expect(quotaLowNotice()).toBeNull();
  });

  it('markQuotaLow is idempotent — stable `since`', () => {
    const t0 = new Date('2026-07-10T13:00:00.000Z');
    markQuotaLow(t0);
    const first = readQuotaLowStatus(t0);
    expect(first.low).toBe(true);
    expect(first.since).toBe(t0.toISOString());
    markQuotaLow(new Date(t0.getTime() + 60_000));
    const second = readQuotaLowStatus(new Date(t0.getTime() + 60_000));
    expect(second.since).toBe(t0.toISOString());
  });

  it('clearQuotaLowStatus stamps `cleared` and flips `low` false, past the cooldown', () => {
    const t0 = new Date('2026-07-10T13:01:00.000Z');
    markQuotaLow(t0);
    const t1 = new Date(t0.getTime() + TOGGLE_COOLDOWN_MS + 1000);
    expect(clearQuotaLowStatus(t1)).toBe(true);
    const status = readQuotaLowStatus(t1);
    expect(status.low).toBe(false);
    expect(status.cleared).not.toBeNull();
  });

  it('auto-expires the flag after the TTL', () => {
    const t0 = new Date('2026-07-10T13:02:00.000Z');
    markQuotaLow(t0);
    const justBefore = readQuotaLowStatus(new Date(t0.getTime() + QUOTA_LOW_TTL_MS - 1000));
    expect(justBefore.low).toBe(true);
    const justAfter = readQuotaLowStatus(new Date(t0.getTime() + QUOTA_LOW_TTL_MS + 1000));
    expect(justAfter.low).toBe(false);
  });

  it('quotaLowNotice humanizes age and points at power-saver-disable', () => {
    const t0 = new Date('2026-07-10T13:03:00.000Z');
    markQuotaLow(t0);
    const notice = quotaLowNotice(new Date(t0.getTime() + 5 * 60 * 1000));
    expect(notice).toContain('5m ago');
    expect(notice).toContain('ruflo proxy power-saver-disable');
  });

  it('mark→clear inside the cooldown window is refused, same as rate-limit', () => {
    const t0 = new Date('2026-07-10T13:04:00.000Z');
    expect(markQuotaLow(t0)).toBe(true);
    expect(clearQuotaLowStatus(new Date(t0.getTime() + 1000))).toBe(false);
    expect(readQuotaLowStatus(new Date(t0.getTime() + 1000)).low).toBe(true);
  });
});

describe('local insight ticker (computeLocalInsights / selectLocalInsight)', () => {
  it('returns nothing when no context signal applies', () => {
    expect(computeLocalInsights({})).toEqual([]);
    expect(selectLocalInsight({})).toBeNull();
  });

  it('surfaces scanner findings at the highest priority without calling them CVEs', () => {
    const insights = computeLocalInsights({ security: { status: 'ISSUES', findings: 2, cvesFixed: 0, totalCves: 0 } });
    expect(insights).toHaveLength(1);
    expect(insights[0].text).toContain('2 security findings');
    expect(insights[0].text).not.toContain('CVE');
  });

  it('singularizes "1 security finding" correctly', () => {
    const insight = selectLocalInsight({ security: { status: 'ISSUES', findings: 1, cvesFixed: 0, totalCves: 0 } });
    expect(insight!.text).toContain('1 security finding');
    expect(insight!.text).not.toContain('1 security findings');
  });

  it('falls back to "scan pending" when no scan result exists', () => {
    const insight = selectLocalInsight({ security: { status: 'PENDING', findings: 0, cvesFixed: 0, totalCves: 0 } });
    expect(insight!.text).toContain('Security scan pending');
  });

  it('is silent when security is CLEAN', () => {
    expect(selectLocalInsight({ security: { status: 'CLEAN', findings: 0, cvesFixed: 0, totalCves: 0 } })).toBeNull();
  });

  it('surfaces uncommitted changes only above the threshold', () => {
    expect(selectLocalInsight({ gitUncommittedCount: 20 })).toBeNull(); // at threshold, not over
    const insight = selectLocalInsight({ gitUncommittedCount: 21 });
    expect(insight!.text).toContain('21 uncommitted changes');
  });

  it('picks the highest-priority candidate when several apply at once', () => {
    const insight = selectLocalInsight({
      security: { status: 'ISSUES', findings: 1, cvesFixed: 0, totalCves: 0 }, // priority 90
      gitUncommittedCount: 50, // priority 50
    });
    expect(insight!.id).toBe('insight-security-findings');
  });

  it('surfaces power-saver mode only when both consented and flagged low', () => {
    expect(selectLocalInsight({})).toBeNull();
    recordConsent('power-saver', true, 'test');
    expect(selectLocalInsight({})).toBeNull(); // consented but not flagged low
    markQuotaLow(new Date());
    const insight = selectLocalInsight({});
    expect(insight!.text).toContain('Power saver mode active');
  });

  it('reads the ADR-315 flywheel-status cache when present and fresh', () => {
    fs.writeFileSync(
      path.join(stateDir, 'flywheel-status.json'),
      JSON.stringify({ _ts: Date.now(), headline: 'test headline' }),
      'utf-8',
    );
    const insight = selectLocalInsight({});
    expect(insight!.text).toContain('test headline');
  });

  it('ignores an expired flywheel-status cache', () => {
    fs.writeFileSync(
      path.join(stateDir, 'flywheel-status.json'),
      JSON.stringify({ _ts: Date.now() - 25 * 60 * 60 * 1000, headline: 'stale headline' }),
      'utf-8',
    );
    expect(selectLocalInsight({})).toBeNull();
  });

  it('surfaces the ADR-316 advisor tip only when consented, and never a stale-past-TTL cache', () => {
    fs.writeFileSync(
      path.join(stateDir, 'advisor-tip.json'),
      JSON.stringify({ _ts: Date.now(), headline: 'commit your work' }),
      'utf-8',
    );
    expect(selectLocalInsight({})).toBeNull(); // not consented — cache is ignored regardless
    recordConsent('advisor-tips', true, 'test');
    const insight = selectLocalInsight({});
    expect(insight!.id).toBe('insight-advisor-tip');
    expect(insight!.text).toContain('commit your work');
  });

  it('an expired advisor-tip cache is silent even when consented', () => {
    recordConsent('advisor-tips', true, 'test');
    fs.writeFileSync(
      path.join(stateDir, 'advisor-tip.json'),
      JSON.stringify({ _ts: Date.now() - 25 * 60 * 60 * 1000, headline: 'stale tip' }),
      'utf-8',
    );
    expect(selectLocalInsight({})).toBeNull();
  });

  it('security findings still outrank the advisor tip', () => {
    recordConsent('advisor-tips', true, 'test');
    fs.writeFileSync(
      path.join(stateDir, 'advisor-tip.json'),
      JSON.stringify({ _ts: Date.now(), headline: 'a tip' }),
      'utf-8',
    );
    const insight = selectLocalInsight({ security: { status: 'ISSUES', findings: 1, cvesFixed: 0, totalCves: 0 } });
    expect(insight!.id).toBe('insight-security-findings');
  });

  it('the advisor tip outranks the flywheel-status placeholder', () => {
    recordConsent('advisor-tips', true, 'test');
    fs.writeFileSync(
      path.join(stateDir, 'advisor-tip.json'),
      JSON.stringify({ _ts: Date.now(), headline: 'a tip' }),
      'utf-8',
    );
    fs.writeFileSync(
      path.join(stateDir, 'flywheel-status.json'),
      JSON.stringify({ _ts: Date.now(), headline: 'flywheel news' }),
      'utf-8',
    );
    const insight = selectLocalInsight({});
    expect(insight!.id).toBe('insight-advisor-tip');
  });
});

// ─── Fork removal guards (GitHub issue #11) ─────────────────────────────────
//
// These are the tests that must never be "fixed" by relaxing them. Everything
// above verifies retained behaviour; this describe verifies ABSENCE, which is
// the property an upstream rebase is most likely to silently undo.

describe('fork removal guards — the funnel stays gone', () => {
  const funnelDir = path.resolve(
    path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')),
    '../src/funnel',
  );

  it('deleted modules are still deleted', () => {
    // attribution.ts built funnel.ruv.io/v1/click redirect URLs.
    // event-transport.ts POSTed the local event queue to /v1/events.
    // credit-notifier.ts was orphaned when that transport went.
    for (const gone of ['attribution.ts', 'event-transport.ts', 'credit-notifier.ts']) {
      expect(fs.existsSync(path.join(funnelDir, gone)), gone + ' must stay deleted').toBe(false);
    }
  });

  it('no module under src/funnel/ can make an outbound request', () => {
    // Structural, not behavioural: a module that never imports an HTTP client
    // cannot regress into making a call. This is the guard that would have
    // caught the original subsystem.
    //
    // `local-signals.ts` is the one allowed `child_process` user: it shells
    // out to local `git` and `sqlite3` to read working-tree and swarm state
    // for the statusline. That is a local read, not an outbound request, and
    // it is explicitly one of the non-promotional pieces this fork keeps.
    const SUBPROCESS_ALLOWED = new Set(['local-signals.ts']);

    for (const file of fs.readdirSync(funnelDir).filter((f) => f.endsWith('.ts'))) {
      const code = fs
        .readFileSync(path.join(funnelDir, file), 'utf-8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      expect(code, file + ' must not import an HTTP client').not.toMatch(/from '(node:)?https?'/);
      expect(code, file + ' must not call fetch()').not.toMatch(/\bfetch\s*\(/);
      expect(code, file + ' must not reference ruv.io').not.toContain('ruv.io');
      if (!SUBPROCESS_ALLOWED.has(file)) {
        expect(code, file + ' must not spawn a subprocess').not.toMatch(/child_process/);
      }
    }
  });

  it('getFunnelPromo returns null under every condition that used to show a row', () => {
    // Consent granted, not CI, interactive, disclosure already accepted —
    // upstream's happy path. Still nothing.
    recordConsent('telemetry', true, 'test');
    recordConsent('sponsored-downtime', true, 'test');
    recordDisclosureShown(new Date(0));
    seedRemoteMessages(TEST_ROTATION_POOL);
    const later = new Date(DISCLOSURE_GRACE_MS * 4);
    expect(getFunnelPromo({ interactive: true, now: later })).toBeNull();
    expect(getFunnelPromo({ interactive: true, now: later, localInsights: { gitUncommittedCount: 999 } })).toBeNull();
  });

  it('the remote message transport is inert in both directions', async () => {
    seedRemoteMessages(TEST_ROTATION_POOL);
    expect(getRemoteMessages()).toHaveLength(0);
    const result = await refreshRemoteMessages({ force: true });
    expect(result.refreshed).toBe(false);
  });

  it('the enrollment upsell is never offered', () => {
    expect(shouldOfferEnrollment({ noSignup: false })).toBe(false);
  });
});
