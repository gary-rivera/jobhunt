import { extractWithLLM, preCleanHtml } from './llmExtractor';

describe('preCleanHtml', () => {
  it('strips <script>, <style>, <nav>, <footer> blocks', () => {
    const input = `
      <html><body>
        <nav>navbar</nav>
        <script>var x = 1;</script>
        <style>.a {}</style>
        <main>real content</main>
        <footer>foot</footer>
      </body></html>`;
    const out = preCleanHtml(input);
    expect(out).toContain('real content');
    expect(out).not.toContain('navbar');
    expect(out).not.toContain('var x');
    expect(out).not.toContain('.a {}');
    expect(out).not.toContain('foot');
  });

  it('collapses whitespace', () => {
    expect(preCleanHtml('  a\n\n  b  ')).toBe('a b');
  });

  it('truncates to maxChars', () => {
    const big = 'x'.repeat(1000);
    expect(preCleanHtml(big, 100).length).toBe(100);
  });
});

describe('extractWithLLM', () => {
  const ORIGINAL_FETCH = global.fetch;
  afterEach(() => {
    global.fetch = ORIGINAL_FETCH;
  });

  it('posts the schema as the format parameter and returns parsed JSON', async () => {
    const calls: { url: string; body: unknown }[] = [];
    global.fetch = jest.fn(async (url: string, init?: { body?: string }) => {
      calls.push({ url, body: JSON.parse(init?.body ?? '{}') });
      return {
        ok: true,
        status: 200,
        json: async () => ({ response: JSON.stringify({ title: 'Sr Eng', salary: 150000 }) }),
      };
    }) as unknown as typeof fetch;

    const schema = {
      type: 'object',
      properties: { title: { type: 'string' }, salary: { type: 'number' } },
      required: ['title'],
    };
    const result = await extractWithLLM<{ title: string; salary: number }>(
      '<html><body>some job</body></html>',
      schema,
    );

    expect(result).toEqual({ title: 'Sr Eng', salary: 150000 });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toMatch(/\/api\/generate$/);
    const body = calls[0].body as Record<string, unknown>;
    expect(body.format).toEqual(schema);
    expect(body.stream).toBe(false);
    expect(body.model).toBe('llama3.1:8b');
    expect((body.options as Record<string, number>).num_ctx).toBe(8192);
  });

  it('uses overridden model when opts.model is provided', async () => {
    let capturedModel = '';
    global.fetch = jest.fn(async (_url: string, init?: { body?: string }) => {
      capturedModel = JSON.parse(init?.body ?? '{}').model;
      return { ok: true, status: 200, json: async () => ({ response: '{"x":1}' }) };
    }) as unknown as typeof fetch;
    await extractWithLLM('<p>x</p>', { type: 'object' }, { model: 'custom-model' });
    expect(capturedModel).toBe('custom-model');
  });

  it('throws a clear error when Ollama returns malformed JSON', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ response: 'not-json{' }),
    })) as unknown as typeof fetch;
    await expect(extractWithLLM('<p>x</p>', { type: 'object' })).rejects.toThrow(/parse|JSON/i);
  });

  it('throws when Ollama returns non-2xx', async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 500,
      text: async () => 'boom',
    })) as unknown as typeof fetch;
    await expect(extractWithLLM('<p>x</p>', { type: 'object' })).rejects.toThrow(/500|Ollama/i);
  });
});
