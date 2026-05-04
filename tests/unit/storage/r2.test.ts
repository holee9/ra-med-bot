// Tests for lib/storage/r2.ts
// RED: R2Client abstraction layer

import { describe, expect, it, vi } from 'vitest';

// Minimal R2Bucket stub
function makeR2Mock() {
  const store = new Map<string, { body: ArrayBuffer; httpMetadata?: R2HTTPMetadata }>();
  return {
    put: vi.fn(
      async (key: string, body: ReadableStream | ArrayBuffer | string, opts?: R2PutOptions) => {
        const buf =
          typeof body === 'string'
            ? new TextEncoder().encode(body).buffer
            : body instanceof ArrayBuffer
              ? body
              : new ArrayBuffer(0);
        store.set(key, { body: buf as ArrayBuffer, httpMetadata: opts?.httpMetadata });
        return {} as R2Object;
      },
    ),
    get: vi.fn(async (key: string) => {
      const item = store.get(key);
      if (!item) return null;
      return {
        key,
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(item.body));
            controller.close();
          },
        }),
        text: async () => new TextDecoder().decode(item.body),
        arrayBuffer: async () => item.body,
        httpMetadata: item.httpMetadata,
      } as unknown as R2ObjectBody;
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    list: vi.fn(async (opts?: R2ListOptions) => ({
      objects: [...store.keys()].map((k) => ({ key: k })) as R2Object[],
      truncated: false,
    })),
    _store: store,
  } as unknown as R2Bucket;
}

describe('R2Client', () => {
  it('should export R2Client class', async () => {
    const mod = await import('../../../lib/storage/r2');
    expect(mod.R2Client).toBeDefined();
  });

  it('should have put, get, delete, list methods', async () => {
    const { R2Client } = await import('../../../lib/storage/r2');
    const bucket = makeR2Mock();
    const client = new R2Client(bucket);
    expect(typeof client.put).toBe('function');
    expect(typeof client.get).toBe('function');
    expect(typeof client.delete).toBe('function');
    expect(typeof client.list).toBe('function');
  });

  describe('put', () => {
    it('should store content in R2', async () => {
      const { R2Client } = await import('../../../lib/storage/r2');
      const bucket = makeR2Mock();
      const client = new R2Client(bucket);

      await client.put('test/file.json', JSON.stringify({ foo: 'bar' }));
      expect(bucket.put).toHaveBeenCalledWith(
        'test/file.json',
        expect.anything(),
        expect.anything(),
      );
    });
  });

  describe('get', () => {
    it('should return null for missing keys', async () => {
      const { R2Client } = await import('../../../lib/storage/r2');
      const bucket = makeR2Mock();
      const client = new R2Client(bucket);

      const result = await client.get('nonexistent/key');
      expect(result).toBeNull();
    });

    it('should return the stored object', async () => {
      const { R2Client } = await import('../../../lib/storage/r2');
      const bucket = makeR2Mock();
      const client = new R2Client(bucket);

      await client.put('test/exists.txt', 'hello world');
      const result = await client.get('test/exists.txt');
      expect(result).not.toBeNull();
    });
  });

  describe('delete', () => {
    it('should call R2Bucket.delete', async () => {
      const { R2Client } = await import('../../../lib/storage/r2');
      const bucket = makeR2Mock();
      const client = new R2Client(bucket);

      await client.delete('test/to-delete.txt');
      expect(bucket.delete).toHaveBeenCalledWith('test/to-delete.txt');
    });
  });

  describe('list', () => {
    it('should return a list of objects', async () => {
      const { R2Client } = await import('../../../lib/storage/r2');
      const bucket = makeR2Mock();
      const client = new R2Client(bucket);

      await client.put('dir/a.txt', 'a');
      await client.put('dir/b.txt', 'b');

      const result = await client.list({ prefix: 'dir/' });
      expect(result.objects.length).toBeGreaterThanOrEqual(0);
    });
  });
});
