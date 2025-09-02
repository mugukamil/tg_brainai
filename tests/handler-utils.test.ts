import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/handlers/goapi-handler.js', () => ({
  isValidAspectRatio: (ar: string) => ['1:1', '16:9', '9:16'].includes(ar),
}));

const importUtils = async () => await import('../src/handlers/handler-utils.js');

describe('parseImageCommand', () => {
  it('parses default values', async () => {
    const { parseImageCommand } = await importUtils();
    const params = parseImageCommand('a cat');
    expect(params).toEqual({
      prompt: 'a cat',
      aspect_ratio: '1:1',
      process_mode: 'fast',
      skip_prompt_check: false,
      service_mode: 'public',
    });
  });

  it('extracts aspect ratio and cleans prompt', async () => {
    const { parseImageCommand } = await importUtils();
    const params = parseImageCommand('a cat --ar 16:9 sitting');
    expect(params.aspect_ratio).toBe('16:9');
    expect(params.prompt).toBe('a cat sitting');
  });

  it('extracts process mode and cleans prompt', async () => {
    const { parseImageCommand } = await importUtils();
    const params = parseImageCommand('a cat --turbo running');
    expect(params.process_mode).toBe('turbo');
    expect(params.prompt).toBe('a cat running');
  });
});

describe('formatImageStatus', () => {
  it('formats with emoji', async () => {
    const { formatImageStatus } = await importUtils();
    const s = formatImageStatus('processing', 50);
    expect(s).toContain('🎨');
    expect(s).toContain('50%');
  });
});


