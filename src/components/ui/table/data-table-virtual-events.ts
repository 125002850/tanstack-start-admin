export function emitDataTableVirtualEvent(evt: Record<string, unknown>) {
  if (typeof window === 'undefined') return

  try {
    const w = window as unknown as Record<string, unknown>
    if (!w.__DATA_TABLE_VIRTUAL_EVENTS__) {
      w.__DATA_TABLE_VIRTUAL_EVENTS__ = []
    }
    const events = w.__DATA_TABLE_VIRTUAL_EVENTS__ as Array<Record<string, unknown>>
    events.push({ ...evt, timestamp: Date.now() })
  } catch {
    // telemetry must never break the table
  }
}
