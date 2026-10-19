// @vitest-environment node

import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const polyfillsUrl = new URL('./polyfills.ts', import.meta.url).href;

// 隔离原生 API 的删除与模块缓存，避免影响 Vitest 和其他测试。
function runWithPolyfills(setup: string, assertions: string) {
  return spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '--eval',
      `
        import assert from 'node:assert/strict';
        ${setup}
        await import(${JSON.stringify(polyfillsUrl)});
        ${assertions}
      `
    ],
    { encoding: 'utf8', timeout: 10_000 }
  );
}

describe('browser polyfills', () => {
  it('supports sorting and reversing without mutating state when native methods are absent', () => {
    const result = runWithPolyfills(
      `
        Reflect.deleteProperty(Array.prototype, 'toSorted');
        Reflect.deleteProperty(Array.prototype, 'toReversed');
      `,
      `
        const keys = new Map([[3, 'third'], [1, 'first'], [2, 'second']]);
        assert.deepEqual([...keys.keys()].toSorted((a, b) => a - b), [1, 2, 3]);
        assert.deepEqual([...keys.keys()], [3, 1, 2]);

        const rows = Object.freeze([
          { id: 'a', order: 2 },
          { id: 'b', order: 1 },
          { id: 'c', order: 2 }
        ]);
        assert.deepEqual(rows.toSorted((a, b) => a.order - b.order).map(row => row.id), ['b', 'a', 'c']);
        assert.deepEqual(rows.toReversed().map(row => row.id), ['c', 'b', 'a']);
        assert.deepEqual(rows.map(row => row.id), ['a', 'b', 'c']);
      `
    );

    expect(result.status, result.stderr || result.error?.message).toBe(0);
  });

  it('preserves existing native implementations', () => {
    const result = runWithPolyfills(
      `
        const nativeToSorted = Array.prototype.toSorted;
        const nativeToReversed = Array.prototype.toReversed;
        const nativeAny = AbortSignal.any;
      `,
      `
        assert.equal(Array.prototype.toSorted, nativeToSorted);
        assert.equal(Array.prototype.toReversed, nativeToReversed);
        assert.equal(AbortSignal.any, nativeAny);
      `
    );

    expect(result.status, result.stderr || result.error?.message).toBe(0);
  });

  it('combines native signals, preserves the first reason and releases source listeners', () => {
    const result = runWithPolyfills(
      `Reflect.deleteProperty(AbortSignal, 'any');`,
      `
      const { getEventListeners } = await import('node:events');
      const upstream = new AbortController();
      const timeout = new AbortController();
      const combined = AbortSignal.any([upstream.signal, timeout.signal, upstream.signal]);
      const reason = new Error('timeout');
      assert.equal(combined.aborted, false);
      timeout.abort(reason);
      assert.equal(combined.aborted, true);
      assert.equal(combined.reason, reason);
      upstream.abort('late');
      assert.equal(combined.reason, reason);
      assert.equal(getEventListeners(upstream.signal, 'abort').length, 0);
      assert.equal(getEventListeners(timeout.signal, 'abort').length, 0);
      assert.equal(AbortSignal.any([]).aborted, false);
      assert.equal(AbortSignal.any([upstream.signal, timeout.signal]).reason, 'late');
      assert.throws(() => AbortSignal.any([{}]), TypeError);
    `
    );
    expect(result.status, result.stderr || result.error?.message).toBe(0);
  });

  it('supports generator transport success, upstream cancellation and timeout without native any', () => {
    const result = runWithPolyfills(
      `Reflect.deleteProperty(AbortSignal, 'any');`,
      `
      const { createTransport } = await import('@oig/react-query-generator/core');
      const transport = createTransport({ defaultTimeoutMs: 30 });
      let calls = 0;
      // 模拟真实 fetch：请求结束前持有 signal，避免整个 mock 监听环被 GC。
      const pendingSignals = new Set();
      globalThis.fetch = async (_url, { signal }) => {
        calls++;
        if (calls === 1) return new Response(JSON.stringify({ code: 200, data: ['ok'] }), {
          headers: { 'content-type': 'application/json' }
        });
        return new Promise((_resolve, reject) => {
          if (signal.aborted) reject(signal.reason);
          else {
            pendingSignals.add(signal);
            signal.addEventListener('abort', () => {
              pendingSignals.delete(signal);
              reject(signal.reason);
            }, { once: true });
          }
        });
      };
      const caller = new AbortController();
      await transport.customInstance('/compat', { method: 'GET', signal: caller.signal });
      assert.equal(calls, 1);
      const cancelled = transport.customInstance('/compat', { method: 'GET', signal: caller.signal });
      caller.abort();
      await assert.rejects(cancelled);
      await assert.rejects(transport.customInstance('/compat', { method: 'GET', signal: new AbortController().signal }));
      assert.equal(calls, 3);
      assert.equal(pendingSignals.size, 0);
    `
    );
    expect(result.status, result.stderr || result.error?.message).toBe(0);
  });
});
