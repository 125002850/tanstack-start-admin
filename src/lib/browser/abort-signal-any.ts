// Chrome 109 已有 AbortController、reason 和事件监听器的 signal 选项，仅缺 any。
const controllers = new WeakMap<AbortSignal, AbortController>();
const cleanup = new FinalizationRegistry<AbortController>((listeners) => listeners.abort());

function forwardAbort(
  source: AbortSignal,
  target: WeakRef<AbortController>,
  listeners: AbortController
) {
  source.addEventListener(
    'abort',
    () => {
      target.deref()?.abort(source.reason);
      listeners.abort();
    },
    { once: true, signal: listeners.signal }
  );
}

if (typeof AbortSignal.any !== 'function') {
  Object.defineProperty(AbortSignal, 'any', {
    configurable: true,
    writable: true,
    value(signals: Iterable<AbortSignal>) {
      if (signals == null || typeof signals[Symbol.iterator] !== 'function') {
        throw new TypeError('AbortSignal.any expects an iterable');
      }
      const sources = Array.from(signals);
      const abortedGetter = Object.getOwnPropertyDescriptor(AbortSignal.prototype, 'aborted')!.get!;
      for (const signal of sources) {
        // 原生 getter 做品牌检查，也接受 iframe 中创建的原生 signal。
        abortedGetter.call(signal);
      }

      const controller = new AbortController();
      const aborted = sources.find((signal) => signal.aborted);
      if (aborted) {
        controller.abort(aborted.reason);
        return controller.signal;
      }

      // 弱引用避免长寿命的上游 signal 持有已经完成的请求；任一源取消时移除全部监听。
      const target = new WeakRef(controller);
      const listeners = new AbortController();
      for (const source of new Set(sources)) {
        forwardAbort(source, target, listeners);
      }
      // 使用合成 signal 的请求存活期间必须保留 controller。
      controllers.set(controller.signal, controller);
      cleanup.register(controller.signal, listeners);
      return controller.signal;
    }
  });
}
