import { beforeEach, describe, expect, it, vi } from 'vitest';

const bridgeSessionEnd = vi.fn();
const shutdownBridge = vi.fn();

vi.mock('../src/memory/memory-bridge.js', () => ({
  bridgeSessionEnd,
  shutdownBridge,
}));

import { hooksSessionEnd } from '../src/mcp-tools/hooks-tools.js';

describe('hooks session-end native resource cleanup (#2691)', () => {
  beforeEach(() => {
    bridgeSessionEnd.mockReset();
    shutdownBridge.mockReset();
    bridgeSessionEnd.mockResolvedValue({ controller: 'test', persisted: true });
    shutdownBridge.mockResolvedValue(undefined);
  });

  it('shuts down the memory bridge after persisting a session', async () => {
    const result = await hooksSessionEnd.handler({ stopDaemon: false });

    expect(bridgeSessionEnd).toHaveBeenCalledOnce();
    expect(shutdownBridge).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      sessionPersistence: { controller: 'test', persisted: true },
    });
    // Issue #15: statePath pointed at a file nothing wrote or read; removed.
    expect(result).not.toHaveProperty('statePath');
    // Issue #17: saveState/exportMetrics were declared but never gated or read
    // anything real; removed. tasksSucceeded/tasksFailed/commandsExecuted were
    // declared by the CLI's result type but never populated by this handler —
    // now wired to real (if best-effort) local-store counts instead of undefined.
    expect(result.summary).toMatchObject({
      tasksSucceeded: expect.any(Number),
      tasksFailed: expect.any(Number),
      commandsExecuted: expect.any(Number),
    });
  });

  it('still shuts down a partially initialized bridge when persistence fails', async () => {
    bridgeSessionEnd.mockRejectedValueOnce(new Error('native initialization failed'));

    const result = await hooksSessionEnd.handler({ stopDaemon: false });

    expect(shutdownBridge).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      sessionPersistence: { controller: 'none', persisted: false },
    });
  });
});
