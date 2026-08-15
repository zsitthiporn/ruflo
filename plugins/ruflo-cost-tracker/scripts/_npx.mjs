import { spawnSync } from 'node:child_process';

// FORK NOTE: this helper used to run `npx -y <pkg>`, where <pkg> was
// `@claude-flow/cli@latest` — the package published on the npm registry, i.e.
// UPSTREAM's build rather than this fork's. Every cost-tracker CLI call
// therefore executed a different codebase than the one it shipped with.
//
// Resolution is local now. The first element of `args` is still the legacy
// package spec and is dropped: callers keep their existing shape, and this
// helper decides how the CLI is actually reached — RUFLO_CLI_ENTRY (absolute
// path to this checkout's bin/cli.js) when set, otherwise the `ruflo` binary
// on PATH. Neither resolves anything from the registry.
//
// The name is kept so call sites and their tests do not churn; it no longer
// involves npx. See docs/fork-maintenance.md §3.
export function spawnNpxSync(args, options = {}) {
  const withoutFlag = args[0] === '-y' ? args.slice(1) : args;
  // Drop the leading package spec. Historically that was a registry name such
  // as '@claude-flow/cli@latest'; call sites now pass the 'ruflo-local'
  // sentinel instead. Both are recognised so a plugin script that has not been
  // updated still works. A real subcommand ('memory', 'hooks', …) contains
  // neither '@' nor '/' and is never the sentinel, so it passes through.
  const head = withoutFlag[0] ?? '';
  const cliArgs = head === 'ruflo-local' || /[@/]/.test(head)
    ? withoutFlag.slice(1)
    : withoutFlag;

  const entry = process.env.RUFLO_CLI_ENTRY;
  const { shell: _ignoredShell, ...safeOptions } = options;

  if (entry) {
    // process.execPath is a real executable on every platform, so argv is
    // passed through verbatim — no shell re-tokenization of JSON values.
    return spawnSync(process.execPath, [entry, ...cliArgs], { ...safeOptions, shell: false });
  }

  // Fall back to the installed binary. On Windows that is a .cmd shim, which
  // CreateProcess cannot execute directly, so a shell is required there.
  return spawnSync('ruflo', cliArgs, { ...safeOptions, shell: process.platform === 'win32' });
}
