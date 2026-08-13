/**
 * Ed25519 provenance for the auto-refreshed critical helpers (ADR-174 security).
 *
 * The helper auto-refresh copies auto-EXECUTING hook code (`hook-handler.cjs`
 * etc.) from the installed package into a project. npm verifies the tarball at
 * INSTALL time, but not the files on disk afterward — a sibling package's
 * postinstall (or disk tampering) could overwrite them, and the refresh would
 * faithfully propagate the tampered code. This gate closes that: every helper
 * is verified against a ruflo-signed manifest before install, and a mismatch is
 * REFUSED (fail-closed). The public key is baked in below; the private key is
 * never in the repo (see scripts/sign-helpers.mjs).
 *
 * Native Node crypto (RFC 8032 Ed25519), zero external deps — same primitive as
 * src/appliance/rvfa-signing.ts.
 */
import { createHash, verify as edVerify } from 'crypto';

/**
 * Helper-signing PUBLIC key (safe to commit). The matching private key is held
 * out-of-repo and provided to scripts/sign-helpers.mjs via
 * $RUFLO_HELPERS_SIGNING_KEY (default path `~/.ruflo/helpers-signing.key`).
 * Rotating the key = replace this constant + re-sign.
 *
 * ROTATED TWICE on 2026-08-14. The first fork-owned key was generated, used to
 * sign, and then lost the same day: the private half sat at
 * `~/.ruflo/helpers-signing.key`, and that directory was swept during a cleanup
 * of ruflo artifacts from the user profile — understandably, since `~/.ruflo`
 * looks exactly like tool litter. It is not; it is the one directory there that
 * cannot be regenerated. `~/.ruflo/DO-NOT-DELETE.md` now says so on disk, which
 * is the only place a person doing that cleanup would actually read it.
 *
 * ROTATED 2026-08-14 — FORK OWNERSHIP. This fork previously carried upstream's
 * public key, which meant upstream-signed helpers verified as legitimate here
 * and could overwrite hand-maintained ones. The private half of that pair is
 * held by upstream, so trusting it made the fork's helper-provenance gate a
 * gate on someone else's key. This key is ours; upstream-signed manifests now
 * fail verification, which is the intended outcome. See docs/fork-maintenance.md
 * and zsitthiporn/ruflo#2.
 *
 * Consequence to remember on every upstream rebase: a merge that restores
 * upstream's constant silently re-opens that trust. It is on the rebase
 * checklist for that reason.
 *
 * ROTATED 2026-07-14 (v3.29.0, upstream): the key before that was accidentally
 * exposed in a session transcript; the old GCP secret version was destroyed.
 * Kept here as history — that key is not ours either.
 */
export const RUFLO_HELPERS_PUBKEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEARue6JDRW2NyhElZC3WL4Ep2iez4tgjI1yOgzZWHsnio=
-----END PUBLIC KEY-----`;

export const HELPERS_MANIFEST_FILE = 'helpers.manifest.json';

export interface HelpersManifest {
  version: string;
  files: Record<string, string>; // helper name -> sha256 hex
}
export interface SignedHelpersManifest {
  manifest: HelpersManifest;
  signature: string; // base64 Ed25519 signature over canonicalManifestBytes(manifest)
  algorithm: 'ed25519';
}

export function sha256Hex(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Deterministic canonical bytes of a manifest — file keys sorted so the signer
 * and verifier agree byte-for-byte regardless of object insertion order.
 */
export function canonicalManifestBytes(m: HelpersManifest): Buffer {
  const files: Record<string, string> = {};
  for (const k of Object.keys(m.files).sort()) files[k] = m.files[k];
  return Buffer.from(JSON.stringify({ version: m.version, files }), 'utf-8');
}

/**
 * Verify a signed helpers manifest against ruflo's public key. Returns the
 * trusted file->sha256 manifest, or null on ANY failure (bad signature,
 * malformed JSON, wrong algorithm). Fail-closed — the caller MUST refuse to
 * install unverified helpers.
 */
export function verifyHelpersManifest(
  signedJson: string,
  pubkeyPem: string = RUFLO_HELPERS_PUBKEY,
): HelpersManifest | null {
  try {
    const signed = JSON.parse(signedJson) as SignedHelpersManifest;
    if (!signed || signed.algorithm !== 'ed25519' || !signed.signature || !signed.manifest) return null;
    if (!signed.manifest.files || typeof signed.manifest.files !== 'object') return null;
    const bytes = canonicalManifestBytes(signed.manifest);
    const ok = edVerify(null, bytes, pubkeyPem, Buffer.from(signed.signature, 'base64'));
    return ok ? signed.manifest : null;
  } catch {
    return null;
  }
}
