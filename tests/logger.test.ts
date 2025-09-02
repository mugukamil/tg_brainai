import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import os from 'os';
import path from 'path';
import { promises as fs } from 'fs';

vi.mock('../src/handlers/supabase-handler.js', () => ({
  insertInteractionLog: vi.fn().mockResolvedValue(undefined),
}));

describe('logger.logInteraction', () => {
  const originalCwd = process.cwd();
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tg-brainai-tests-'));
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
  });

  it('writes JSONL file with timestamp', async () => {
    const { logInteraction } = await import('../src/utils/logger.js');
    await logInteraction({ userId: 1, chatId: 2, direction: 'user', type: 'text', content: 'hi' });

    const logsDir = path.join(tmpDir, 'logs');
    const files = await fs.readdir(logsDir);
    expect(files.length).toBe(1);
    const content = await fs.readFile(path.join(logsDir, files[0]!), 'utf8');
    const line = content.trim();
    const parsed = JSON.parse(line);
    expect(parsed.userId).toBe(1);
    expect(typeof parsed.timestamp).toBe('string');
  });
});


