import type { Logger } from 'pino';
import { vi } from 'vitest';

export function createMockLogger(): Logger {
  return {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    silent: vi.fn(),
    level: 'info',
    addChild: vi.fn(() => ({} as any)),
    on: vi.fn(),
    once: vi.fn(),
    emit: vi.fn(),
    flush: vi.fn().mockResolvedValue(undefined),
    isLevelEnabled: vi.fn(() => true),
  } as unknown as Logger;
}
