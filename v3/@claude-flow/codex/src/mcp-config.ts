/**
 * Shared Ruflo MCP configuration for Codex generators, migrations, and init.
 */

import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { McpServerConfig } from './types.js';

export const RUFLO_MCP_SERVER_NAME = 'ruflo';
export const RUFLO_MCP_STARTUP_TIMEOUT_SEC = 120;

/**
 * Absolute path to THIS checkout's Ruflo CLI entry point.
 *
 * FORK NOTE: this module used to export `RUFLO_MCP_PACKAGE = 'ruflo@latest'`
 * and register the Codex-side MCP server as `npx -y ruflo@latest mcp start`.
 * That resolves the package published on the public npm registry — upstream's
 * build, not this tree — so every Codex session initialised here talked to a
 * different codebase than the one that configured it. Resolution is now
 * local-only, matching `docs/fork-maintenance.md` §3.
 *
 * `RUFLO_CLI_ENTRY` overrides the search for unusual layouts. The search
 * itself covers both the monorepo (a `cli` sibling under `@claude-flow/`) and
 * an installed tree (`node_modules/@claude-flow/cli`), and cannot assume a
 * fixed depth because this module sits at `src/` in tests and `dist/` once
 * built.
 */
export function resolveLocalRufloCli(): string {
  const override = process.env.RUFLO_CLI_ENTRY;
  if (override && existsSync(override)) {
    return override.replace(/\\/g, '/');
  }

  let dir = path.dirname(fileURLToPath(import.meta.url));

  for (let depth = 0; depth < 8; depth += 1) {
    const candidates = [
      path.join(dir, 'node_modules', '@claude-flow', 'cli', 'bin', 'cli.js'),
      path.join(dir, '@claude-flow', 'cli', 'bin', 'cli.js'),
      path.join(dir, 'cli', 'bin', 'cli.js'),
    ];

    for (const candidate of candidates) {
      if (existsSync(candidate)) return candidate.replace(/\\/g, '/');
    }

    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  // Deliberately no `npx ruflo@latest` fallback: a missing local path fails
  // loudly here, whereas the npx form succeeds silently against the wrong
  // codebase — the failure mode this function exists to remove.
  throw new Error(
    'Cannot locate @claude-flow/cli bin/cli.js from this package. Set RUFLO_CLI_ENTRY to its absolute path.'
  );
}

export interface CodexMcpRegistration {
  name?: unknown;
  transport?: {
    type?: unknown;
    command?: unknown;
    args?: unknown;
  } | null;
  startup_timeout_sec?: unknown;
}

export interface CodexCliInvocation {
  command: string;
  prefixArgs: string[];
}

export function getCodexCliInvocation(
  lookupOutput: string,
  platform: NodeJS.Platform = process.platform,
  commandShell = process.env.ComSpec || 'cmd.exe',
): CodexCliInvocation {
  const matches = lookupOutput.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
  if (matches.length === 0) {
    throw new Error('Codex CLI path not found');
  }

  if (platform !== 'win32') {
    return { command: matches[0]!, prefixArgs: [] };
  }

  const executable = matches.find(match => /\.exe$/i.test(match));
  if (executable) {
    return { command: executable, prefixArgs: [] };
  }

  // npm installs expose extensionless and .cmd shims, neither of which can
  // be launched reliably with execFileSync on Windows. Resolve the shim via
  // cmd.exe without interpolating any user-controlled arguments.
  return { command: commandShell, prefixArgs: ['/d', '/s', '/c', 'codex'] };
}

/**
 * The `platform` parameter is retained for call-site compatibility but no
 * longer changes the result: the old split existed only because the `npx`
 * shim needs a `cmd /c` wrapper on Windows. `node` is a real executable on
 * every platform, so one shape is correct everywhere.
 */
export function getRufloMcpServerConfig(
  _platform: NodeJS.Platform = process.platform,
  toolTimeout = 120,
): McpServerConfig {
  return {
    name: RUFLO_MCP_SERVER_NAME,
    command: 'node',
    args: [resolveLocalRufloCli(), 'mcp', 'start'],
    enabled: true,
    startupTimeout: RUFLO_MCP_STARTUP_TIMEOUT_SEC,
    toolTimeout,
  };
}

export function renderMcpServerToml(server: McpServerConfig): string[] {
  const lines = [
    `[mcp_servers.${server.name}]`,
    `command = ${tomlString(server.command)}`,
  ];

  if (server.args && server.args.length > 0) {
    lines.push(`args = [${server.args.map(tomlString).join(', ')}]`);
  }

  lines.push(`enabled = ${server.enabled ?? true}`);

  if (server.startupTimeout !== undefined) {
    lines.push(`startup_timeout_sec = ${server.startupTimeout}`);
  }

  if (server.toolTimeout !== undefined) {
    lines.push(`tool_timeout_sec = ${server.toolTimeout}`);
  }

  if (server.env && Object.keys(server.env).length > 0) {
    lines.push('', `[mcp_servers.${server.name}.env]`);
    for (const [key, value] of Object.entries(server.env)) {
      lines.push(`${key} = ${tomlString(value)}`);
    }
  }

  return lines;
}

export function getRufloMcpAddCommand(platform: NodeJS.Platform = process.platform): string {
  const server = getRufloMcpServerConfig(platform);
  return ['codex', 'mcp', 'add', RUFLO_MCP_SERVER_NAME, '--', server.command, ...(server.args ?? [])].join(' ');
}

export function hasExpectedRufloMcpTransport(
  registration: CodexMcpRegistration,
  platform: NodeJS.Platform = process.platform,
): boolean {
  const expected = getRufloMcpServerConfig(platform);
  const transport = registration.transport;
  if (!transport || transport.type !== 'stdio' || transport.command !== expected.command) {
    return false;
  }

  return Array.isArray(transport.args)
    && transport.args.length === expected.args?.length
    && transport.args.every((arg, index) => arg === expected.args?.[index]);
}

export function hasExpectedRufloMcpTimeout(registration: CodexMcpRegistration): boolean {
  return typeof registration.startup_timeout_sec === 'number'
    && registration.startup_timeout_sec >= RUFLO_MCP_STARTUP_TIMEOUT_SEC;
}

export function upsertMcpServerStartupTimeout(
  config: string,
  serverName = RUFLO_MCP_SERVER_NAME,
  timeoutSec = RUFLO_MCP_STARTUP_TIMEOUT_SEC,
): string {
  const eol = config.includes('\r\n') ? '\r\n' : '\n';
  const lines = config.split(/\r?\n/);
  const header = `[mcp_servers.${serverName}]`;
  const start = lines.findIndex(line => line.trim() === header);

  if (start < 0) {
    throw new Error(`${header} not found in Codex config`);
  }

  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (lines[index]?.trim().startsWith('[')) {
      end = index;
      break;
    }
  }

  const timeoutPattern = /^\s*startup_timeout_sec\s*=/;
  for (let index = start + 1; index < end; index += 1) {
    const line = lines[index] ?? '';
    if (timeoutPattern.test(line)) {
      const parsed = line.match(/^(\s*startup_timeout_sec\s*=\s*)([0-9][0-9_]*)(.*)$/);
      const currentValue = parsed ? Number(parsed[2]!.replace(/_/g, '')) : Number.NaN;
      if (Number.isFinite(currentValue) && currentValue >= timeoutSec) {
        return config;
      }
      lines[index] = parsed
        ? `${parsed[1]}${timeoutSec}${parsed[3]}`
        : `startup_timeout_sec = ${timeoutSec}`;
      return lines.join(eol);
    }
  }

  lines.splice(end, 0, `startup_timeout_sec = ${timeoutSec}`);
  return lines.join(eol);
}

function tomlString(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}
