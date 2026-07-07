/**
 * 轻量级虚拟化诊断事件收集器。
 *
 * 仅在浏览器环境把事件追加到 window.__DATA_TABLE_VIRTUAL_EVENTS__，便于测试和线上排查；
 * 任何异常都会被吞掉，不能因为诊断逻辑影响表格渲染。
 */
export function emitDataTableVirtualEvent(evt: Record<string, unknown>) {
  if (typeof window === 'undefined') return;

  try {
    const w = window as unknown as Record<string, unknown>;
    if (!w.__DATA_TABLE_VIRTUAL_EVENTS__) {
      w.__DATA_TABLE_VIRTUAL_EVENTS__ = [];
    }
    const events = w.__DATA_TABLE_VIRTUAL_EVENTS__ as Array<Record<string, unknown>>;
    events.push({ ...evt, timestamp: Date.now() });
  } catch {
    // 诊断事件绝不能影响表格主流程。
  }
}
