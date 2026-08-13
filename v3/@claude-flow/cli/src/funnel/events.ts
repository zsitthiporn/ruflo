/**
 * Funnel events — ADR-305 attribution / ADR-309 constrained schema.
 *
 * LOCAL-ONLY by design: this module performs no network I/O. Events are
 * appended to a bounded local queue only when the telemetry consent domain
 * is granted (ADR-302). Server-side ingestion (POST /v1/events, ADR-308)
 * is a separate opt-in transport that does not exist in this build — until
 * it does, the queue is simply a bounded local record the user can inspect
 * and delete.
 *
 * Constraints enforced here, permanently (ADR-309): closed event set, daily
 * timestamp buckets (never full timestamps), no raw prompts/commands/paths/
 * repo names — the schema has no field that could carry them.
 */

import * as fs from 'fs';
import { randomUUID } from 'crypto';
import type { FunnelEvent, FunnelEventName, FunnelSurface } from './types.js';
import { hasConsent } from './consent.js';
import { deleteStateFile, funnelStateDir, readStateJson, statePath, writeStateJson } from './state.js';

const EVENTS_FILE = 'funnel-events.jsonl';
const FUNNEL_ID_FILE = 'funnel-id.json';

/** Bounded queue: ≤ 1000 events / ≤ 256 KiB — telemetry never grows unbounded. */
const MAX_QUEUE_BYTES = 256 * 1024;
const MAX_QUEUE_EVENTS = 1000;

const EVENT_NAMES: readonly FunnelEventName[] = [
  'disclosure_shown',
  'funnel_disabled',
  'signup_opened',
  'account_created',
  'proxy_activated',
  'promo_impression',
  'promo_open',
  'sponsor_mode_enabled',
  'sponsor_mode_disabled',
  'sponsor_capacity_exhausted',
  'power_saver_enabled',
  'power_saver_disabled',
  'toggle_cooldown_blocked',
  'training_share_enabled',
  'training_share_disabled',
  'advisor_tip_enabled',
  'advisor_tip_disabled',
];
const SURFACES: readonly FunnelSurface[] = ['statusline', 'init', 'credit_exhaustion'];

interface FunnelIdRecord {
  id: string;
  createdAt: string;
}

/** Rotate the pseudonymous ID every 90 days (ADR-305). */
const FUNNEL_ID_TTL_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * Lazily created pseudonymous funnel ID — random UUID, derived from nothing
 * (no hardware, account, email, or path). Exists only when attribution
 * consent (telemetry domain) is granted; deleted on opt-out.
 */
export function getFunnelId(now: Date = new Date()): string | null {
  if (!hasConsent('telemetry')) return null;
  const existing = readStateJson<FunnelIdRecord>(FUNNEL_ID_FILE);
  if (existing?.id) {
    const created = Date.parse(existing.createdAt);
    if (!Number.isNaN(created) && now.getTime() - created < FUNNEL_ID_TTL_MS) return existing.id;
  }
  const record: FunnelIdRecord = { id: randomUUID(), createdAt: now.toISOString() };
  writeStateJson(FUNNEL_ID_FILE, record);
  return record.id;
}

/** Opt-out: stop emission, delete the ID and the local queue (ADR-305). */
export function deleteFunnelData(): void {
  deleteStateFile(FUNNEL_ID_FILE);
  deleteStateFile(EVENTS_FILE);
}

/**
 * Most recent local record of `event`, as a daily bucket (`YYYY-MM-DD`) —
 * events never carry a full timestamp (ADR-309). Returns null when nothing
 * is recorded, which is also what you get with telemetry consent off (the
 * queue is never written at all in that case) — this can't distinguish
 * "never happened" from "not being recorded," by design.
 */
export function lastRecordedEvent(event: FunnelEventName): string | null {
  try {
    const raw = fs.readFileSync(statePath(EVENTS_FILE), 'utf-8');
    const lines = raw.split('\n').filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      const parsed = JSON.parse(lines[i]) as FunnelEvent;
      if (parsed.event === event) return parsed.timestampBucket;
    }
    return null;
  } catch {
    return null;
  }
}

function dailyBucket(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Record a funnel event — WRITE PATH REMOVED IN THIS FORK.
 *
 * This queue existed to be shipped: `event-transport.ts` batched it and
 * POSTed it to `https://funnel.ruv.io/v1/events`. That transport is deleted,
 * so anything appended here can only accumulate on disk with no reader.
 *
 * Two reasons the write goes rather than just the transport:
 *   1. A local file nobody reads is not telemetry, it is litter — bounded at
 *      256 KiB, but still a record of the user's activity kept for no
 *      purpose the user can benefit from.
 *   2. If a future upstream rebase restores the transport, it would find a
 *      pre-populated queue and ship the backlog on first run. Keeping the
 *      queue full is the part that makes that dangerous.
 *
 * The symbol is RETAINED and its signature unchanged: `commands/proxy.ts`
 * calls it at six sites and is outside the scope of this change. It now
 * always returns false — the same value it already returned for every user
 * without telemetry consent, which is the default. Callers already treat
 * false as normal.
 *
 * The read/delete side of this module stays FUNCTIONAL on purpose:
 * `deleteFunnelData()` is what `settings.json`'s "delete my data" path uses
 * to clear any queue written by a previous install, `getFunnelId()` backs
 * the status display, and `lastRecordedEvent()` is read by `doctor`.
 * Removing them would strip the user's ability to clean up pre-existing
 * state — the opposite of the intent.
 */
export function recordFunnelEvent(
  _event: FunnelEventName,
  _surface: FunnelSurface,
  _release: string,
  _optsOrNow: Date | { now?: Date; messageId?: string } = new Date(),
): boolean {
  return false;
}
