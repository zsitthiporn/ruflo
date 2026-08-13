/**
 * Auto-update system for @claude-flow packages
 *
 * Features:
 * - Rate-limited update checks (24h default)
 * - Automatic patch updates for security packages
 * - Compatibility validation before updates
 * - Rollback capability
 * - Update history logging
 *
 * FORK NOTE: this fork deliberately never pulls code from the npm registry
 * at runtime by default — see docs/fork-maintenance.md. The silent startup
 * path (runStartupUpdateCheck, invoked from every ordinary CLI command) is
 * therefore opt-in, not opt-out: set CLAUDE_FLOW_AUTO_UPDATE=true to
 * re-enable it. This does not affect the explicit `ruflo update check` /
 * `ruflo update all` commands (src/commands/update.ts), which a user must
 * deliberately invoke and which keep their existing behavior.
 */

export {
  checkForUpdates,
  checkSinglePackage,
  getInstalledVersion,
  DEFAULT_CONFIG,
} from './checker.js';

export type { UpdateCheckResult, UpdateConfig } from './checker.js';

export {
  shouldCheckForUpdates,
  recordCheck,
  getCachedVersions,
  clearCache,
  loadState,
} from './rate-limiter.js';

export type { RateLimitState } from './rate-limiter.js';

export { validateUpdate, validateBulkUpdate } from './validator.js';

export type { ValidationResult } from './validator.js';

export {
  executeUpdate,
  executeMultipleUpdates,
  rollbackUpdate,
  getUpdateHistory,
  clearHistory,
  loadHistory,
} from './executor.js';

export type { UpdateHistoryEntry, UpdateExecutionResult } from './executor.js';

// Re-export a convenience function for startup
import { checkForUpdates, DEFAULT_CONFIG } from './checker.js';
import type { UpdateCheckResult } from './checker.js';
import { executeMultipleUpdates } from './executor.js';
import { getInstalledVersion } from './checker.js';

/**
 * Run auto-update check on startup
 * This is the main entry point for the auto-update system
 */
export async function runStartupUpdateCheck(options: {
  verbose?: boolean;
  autoUpdate?: boolean;
}): Promise<{
  checked: boolean;
  updatesAvailable: UpdateCheckResult[];
  updatesApplied: string[];
  skippedReason?: string;
}> {
  const result = {
    checked: false,
    updatesAvailable: [] as UpdateCheckResult[],
    updatesApplied: [] as string[],
    skippedReason: undefined as string | undefined,
  };

  // Opt-in gate (fork default: OFF). Short-circuits before any registry
  // contact — checkForUpdates() below is what actually calls
  // registry.npmjs.org and, transitively, executeMultipleUpdates() is what
  // runs `npm install` in process.cwd(). See the file-level FORK NOTE above.
  const autoUpdateOptedIn = /^(1|true|on|yes)$/i.test(String(process.env.CLAUDE_FLOW_AUTO_UPDATE || ''));
  if (!autoUpdateOptedIn) {
    result.skippedReason = 'Auto-update is opt-in in this fork — set CLAUDE_FLOW_AUTO_UPDATE=true to enable (see docs/fork-maintenance.md)';
    return result;
  }

  try {
    const { results, skipped, reason } = await checkForUpdates(DEFAULT_CONFIG);

    if (skipped) {
      result.skippedReason = reason;
      return result;
    }

    result.checked = true;
    result.updatesAvailable = results;

    // Auto-update if enabled
    if (options.autoUpdate !== false) {
      const autoUpdateable = results.filter((r) => r.shouldAutoUpdate);

      if (autoUpdateable.length > 0) {
        // Get current installed packages
        const installedPackages: Record<string, string> = {};
        for (const update of autoUpdateable) {
          const version = getInstalledVersion(update.package);
          if (version) {
            installedPackages[update.package] = version;
          }
        }

        // Execute updates
        const updateResults = await executeMultipleUpdates(
          autoUpdateable,
          installedPackages
        );

        result.updatesApplied = updateResults
          .filter((r) => r.success)
          .map((r) => `${r.package}@${r.version}`);
      }
    }

    return result;
  } catch {
    // Silently fail on startup - don't block CLI usage
    return result;
  }
}
